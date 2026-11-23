<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * PB-27/28 — Pesan teks dalam Percakapan (R8.04, R8.05, R8.06).
 */
class Pesan extends Model
{
    protected $table = 'pesan';

    protected $primaryKey = 'id_pesan';

    public const UPDATED_AT = null;

    public const MAKS_KARAKTER = 1000;
    public const MASA_SIMPAN_BULAN = 6;
    private const BATAS_RIWAYAT = 100;

    protected $fillable = [
        'id_percakapan',
        'id_player_pengirim',
        'isi_pesan',
        'dibaca_pada',
    ];

    protected $casts = [
        'dibaca_pada' => 'datetime',
    ];

    public function percakapan(): BelongsTo
    {
        return $this->belongsTo(Percakapan::class, 'id_percakapan', 'id_percakapan');
    }

    /** Pesan yang terlihat oleh Player (setelah batas pembersihan miliknya). */
    private static function terlihat(Percakapan $percakapan, int $idPlayer)
    {
        return static::where('id_percakapan', $percakapan->id_percakapan)
            ->when($percakapan->batasBersihkan($idPlayer), fn ($q, $batas) => $q->where('created_at', '>', $batas));
    }

    /**
     * SD: getRiwayatPesan(id_percakapan, id_player)
     * 100 pesan terbaru (urut lama → baru). sebelumId untuk memuat pesan lebih lama.
     */
    public static function getRiwayatPesan(int $idPercakapan, int $idPlayer, ?int $sebelumId = null)
    {
        $percakapan = Percakapan::findOrFail($idPercakapan);

        return self::terlihat($percakapan, $idPlayer)
            ->when($sebelumId, fn ($q) => $q->where('id_pesan', '<', $sebelumId))
            ->orderByDesc('id_pesan')
            ->limit(self::BATAS_RIWAYAT)
            ->get()
            ->reverse()
            ->values();
    }

    /**
     * SD: savePesan(id_percakapan, id_pengirim, isi_pesan)
     * Pesan baru memunculkan lagi percakapan yang sudah dihapus (reset dihapus_*);
     * dibersihkan_* tetap, jadi riwayat lama tetap tersembunyi.
     */
    public static function savePesan(int $idPercakapan, int $idPengirim, string $isiPesan): self
    {
        $pesan = static::create([
            'id_percakapan' => $idPercakapan,
            'id_player_pengirim' => $idPengirim,
            'isi_pesan' => $isiPesan,
        ]);

        Percakapan::whereKey($idPercakapan)->update([
            'dihapus_player_1_pada' => null,
            'dihapus_player_2_pada' => null,
            'updated_at' => now(), // percakapan naik ke atas daftar
        ]);

        return $pesan;
    }

    /**
     * SD: getPesanTerbaru(id_percakapan, id_player, waktuTerakhir) — dipakai polling FE.
     * Memakai >= supaya pesan di detik yang sama tidak terlewat (FE menyaring id_pesan yang sudah ada).
     */
    public static function getPesanTerbaru(int $idPercakapan, int $idPlayer, $waktuTerakhir = null)
    {
        $percakapan = Percakapan::findOrFail($idPercakapan);

        return self::terlihat($percakapan, $idPlayer)
            ->when($waktuTerakhir, fn ($q) => $q->where('created_at', '>=', $waktuTerakhir))
            ->orderBy('id_pesan')
            ->limit(self::BATAS_RIWAYAT)
            ->get();
    }

    /**
     * SD: tandaiPesanDibaca(id_percakapan, id_player)
     * Semua pesan dari lawan bicara yang belum dibaca → 1 query.
     */
    public static function tandaiPesanDibaca(int $idPercakapan, int $idPlayer): int
    {
        return static::where('id_percakapan', $idPercakapan)
            ->where('id_player_pengirim', '!=', $idPlayer)
            ->whereNull('dibaca_pada')
            ->update(['dibaca_pada' => now()]);
    }

    /**
     * SD: bersihkanRiwayatPesan(id_percakapan, id_player)
     * Hanya menyembunyikan riwayat di sisi Player ini; pesan tidak dihapus dari database.
     */
    public static function bersihkanRiwayatPesan(int $idPercakapan, int $idPlayer): bool
    {
        $percakapan = Percakapan::find($idPercakapan);
        $sisi = $percakapan?->sisi($idPlayer);

        if (!$sisi) {
            return false;
        }

        $percakapan->timestamps = false;
        $percakapan->forceFill(["dibersihkan_player_{$sisi}_pada" => now()])->save();

        return true;
    }

    /** id pesan terbaru milik Player yang sudah dibaca lawan (indikator Terbaca saat polling). */
    public static function idTerakhirDibacaLawan(int $idPercakapan, int $idPlayer): ?int
    {
        $id = static::where('id_percakapan', $idPercakapan)
            ->where('id_player_pengirim', $idPlayer)
            ->whereNotNull('dibaca_pada')
            ->max('id_pesan');

        return $id !== null ? (int) $id : null;
    }

    /** R8.06: hapus pesan yang lebih dari 6 bulan (scheduler harian). */
    public static function hapusPesanLama(): int
    {
        return static::where('created_at', '<', now()->subMonths(self::MASA_SIMPAN_BULAN))->delete();
    }
}