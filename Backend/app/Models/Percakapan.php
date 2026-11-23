<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * PB-27/28 — Percakapan chat antara dua Player (R8.03).
 * Hapus Percakapan & Bersihkan Pesan berlaku per Player (kolom *_player_1 / *_player_2).
 */
class Percakapan extends Model
{
    protected $table = 'percakapan';

    protected $primaryKey = 'id_percakapan';

    protected $fillable = [
        'id_player_1',
        'id_player_2',
        'dibersihkan_player_1_pada',
        'dibersihkan_player_2_pada',
        'dihapus_player_1_pada',
        'dihapus_player_2_pada',
    ];

    protected $casts = [
        'dibersihkan_player_1_pada' => 'datetime',
        'dibersihkan_player_2_pada' => 'datetime',
        'dihapus_player_1_pada' => 'datetime',
        'dihapus_player_2_pada' => 'datetime',
    ];

    public function player1(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'id_player_1', 'id_player');
    }

    public function player2(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'id_player_2', 'id_player');
    }

    public function pesan(): HasMany
    {
        return $this->hasMany(Pesan::class, 'id_percakapan', 'id_percakapan');
    }

    // ==========================================
    // HELPER PER PLAYER
    // ==========================================

    /** 1 atau 2 (posisi Player di percakapan), null kalau bukan peserta. */
    public function sisi(int $idPlayer): ?int
    {
        return match ($idPlayer) {
            (int) $this->id_player_1 => 1,
            (int) $this->id_player_2 => 2,
            default => null,
        };
    }

    public function milikPlayer(int $idPlayer): bool
    {
        return $this->sisi($idPlayer) !== null;
    }

    public function idLawan(int $idPlayer): int
    {
        return $this->sisi($idPlayer) === 1 ? (int) $this->id_player_2 : (int) $this->id_player_1;
    }

    public function lawan(int $idPlayer): ?Player
    {
        return $this->sisi($idPlayer) === 1 ? $this->player2 : $this->player1;
    }

    /** Batas pembersihan milik Player: pesan sebelum waktu ini tidak ditampilkan. */
    public function batasBersihkan(int $idPlayer)
    {
        return $this->{'dibersihkan_player_' . $this->sisi($idPlayer) . '_pada'};
    }

    /** Pasangan disimpan urut (id kecil = player_1) supaya tidak ada percakapan dobel. */
    private static function pasangan(int $a, int $b): array
    {
        return [min($a, $b), max($a, $b)];
    }

    // ==========================================
    // METHOD SESUAI SD
    // ==========================================

    /**
     * SD: getDaftarPercakapanByPlayer(id_player)
     * Percakapan yang memiliki pesan dan belum dihapus oleh Player,
     * beserta id pesan terakhir & jumlah belum dibaca (dihitung di query, bukan per percakapan).
     */
    public static function getDaftarPercakapanByPlayer(int $idPlayer)
    {
        // Batas bersihkan sesuai sisi Player di tiap baris
        $batas = "COALESCE(CASE WHEN percakapan.id_player_1 = {$idPlayer} THEN percakapan.dibersihkan_player_1_pada "
            . "ELSE percakapan.dibersihkan_player_2_pada END, '1970-01-01 00:00:00')";

        return static::query()
            ->select('percakapan.*')
            ->where(function ($q) use ($idPlayer) {
                $q->where(fn ($s) => $s->where('id_player_1', $idPlayer)->whereNull('dihapus_player_1_pada'))
                    ->orWhere(fn ($s) => $s->where('id_player_2', $idPlayer)->whereNull('dihapus_player_2_pada'));
            })
            ->whereExists(fn ($q) => $q->select(DB::raw(1))->from('pesan')
                ->whereColumn('pesan.id_percakapan', 'percakapan.id_percakapan'))
            ->selectSub(fn ($q) => $q->from('pesan')->selectRaw('MAX(pesan.id_pesan)')
                ->whereColumn('pesan.id_percakapan', 'percakapan.id_percakapan')
                ->whereRaw("pesan.created_at > {$batas}"), 'id_pesan_terakhir')
            ->selectSub(fn ($q) => $q->from('pesan')->selectRaw('COUNT(*)')
                ->whereColumn('pesan.id_percakapan', 'percakapan.id_percakapan')
                ->where('pesan.id_player_pengirim', '!=', $idPlayer)
                ->whereNull('pesan.dibaca_pada')
                ->whereRaw("pesan.created_at > {$batas}"), 'jumlah_belum_dibaca')
            ->with(['player1.user', 'player2.user'])
            ->orderByDesc('percakapan.updated_at')
            ->orderByDesc('percakapan.id_percakapan')
            ->get();
    }

    /** SD: getDetailPercakapan(id_percakapan) */
    public static function getDetailPercakapan(int $idPercakapan): ?self
    {
        return static::with(['player1.user', 'player2.user'])->find($idPercakapan);
    }

    /** SD: cekPercakapan(id_pengirim, id_player_tujuan) */
    public static function cekPercakapan(int $idPengirim, int $idPlayerTujuan): ?self
    {
        [$p1, $p2] = self::pasangan($idPengirim, $idPlayerTujuan);

        return static::where('id_player_1', $p1)->where('id_player_2', $p2)->first();
    }

    /** SD: createPercakapan(id_pengirim, id_player_tujuan) */
    public static function createPercakapan(int $idPengirim, int $idPlayerTujuan): self
    {
        [$p1, $p2] = self::pasangan($idPengirim, $idPlayerTujuan);

        try {
            return static::create(['id_player_1' => $p1, 'id_player_2' => $p2]);
        } catch (QueryException $e) {
            // Dua request bersamaan: pakai yang sudah dibuat duluan (unique pasangan)
            return self::cekPercakapan($p1, $p2) ?? throw $e;
        }
    }

    /**
     * SD: hapusDariDaftarPercakapan(id_percakapan, id_player)
     * Hanya di sisi Player ini: disembunyikan dari daftar + riwayat lama ikut disembunyikan.
     * Record & pesan tidak dihapus; muncul lagi kalau ada pesan baru.
     */
    public static function hapusDariDaftarPercakapan(int $idPercakapan, int $idPlayer): bool
    {
        $percakapan = static::find($idPercakapan);
        $sisi = $percakapan?->sisi($idPlayer);

        if (!$sisi) {
            return false;
        }

        $percakapan->timestamps = false; // urutan daftar lawan bicara tidak berubah
        $percakapan->forceFill([
            "dihapus_player_{$sisi}_pada" => now(),
            "dibersihkan_player_{$sisi}_pada" => now(),
        ])->save();

        return true;
    }
}