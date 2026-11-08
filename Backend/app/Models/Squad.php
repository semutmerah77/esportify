<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class Squad extends Model
{
    protected $table = 'squad';

    protected $primaryKey = 'id_squad';

    protected $fillable = [
        'id_player_pembuat',
        'kode_squad',
        'logo_squad',
        'nama_squad',
        'deskripsi',
        'maks_anggota',
        'status_squad',
    ];

    protected $casts = [
        'maks_anggota' => 'integer',
    ];

    /**
     * Leader yang sedang menjabat (tanggal_berakhir NULL).
     */
    public function leader(): HasOne
    {
        return $this->hasOne(LeaderSquad::class, 'id_squad', 'id_squad')
            ->whereNull('tanggal_berakhir');
    }

    /**
     * Seluruh riwayat kepemimpinan Squad.
     */
    public function riwayatLeader(): HasMany
    {
        return $this->hasMany(LeaderSquad::class, 'id_squad', 'id_squad');
    }

    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'id_player_pembuat', 'id_player');
    }

    /**
     * Seluruh baris keanggotaan, termasuk yang sudah keluar (riwayat).
     */
    public function anggota(): HasMany
    {
        return $this->hasMany(AnggotaSquad::class, 'id_squad', 'id_squad');
    }

    public function anggotaAktif(): HasMany
    {
        return $this->anggota()->where('status_anggota', 'aktif');
    }

    public function permintaan(): HasMany
    {
        return $this->hasMany(PermintaanBergabung::class, 'id_squad', 'id_squad');
    }

    public function undangan(): HasMany
    {
        return $this->hasMany(UndanganSquad::class, 'id_squad', 'id_squad');
    }

    public function pendaftaranTurnamen(): HasMany
    {
        return $this->hasMany(PendaftaranTurnamen::class, 'id_squad', 'id_squad');
    }

    public function scopeAktif(Builder $query): Builder
    {
        return $query->where('status_squad', 'aktif');
    }

    public function isLeader(?Player $player): bool
    {
        return $player !== null
            && $this->leader
            && (int) $this->leader->id_player === (int) $player->id_player;
    }

    public function isAnggotaAktif(?Player $player): bool
    {
        return $player !== null
            && $this->anggotaAktif()->where('id_player', $player->id_player)->exists();
    }

    /**
     * Mengakhiri masa jabatan Leader saat ini dan (opsional) mengangkat Leader baru.
     * Panggil di dalam DB::transaction.
     */
    public function gantiLeader(?int $idPlayerBaru): ?LeaderSquad
    {
        $this->riwayatLeader()
            ->whereNull('tanggal_berakhir')
            ->update(['tanggal_berakhir' => now()]);

        $leaderBaru = null;

        if ($idPlayerBaru !== null) {
            $leaderBaru = $this->riwayatLeader()->create([
                'id_player' => $idPlayerBaru,
                'tanggal_pengangkatan' => now(),
            ]);
        }

        $this->unsetRelation('leader');

        return $leaderBaru;
    }

    public function isFull(): bool
    {
        return $this->anggotaAktif()->count() >= $this->maks_anggota;
    }

    /**
     * Mencari Squad berdasarkan id_squad (angka) atau kode_squad (contoh: SQD-7K2M9Q).
     */
    public static function cariDenganKunci($key): ?self
    {
        $query = static::with('leader');

        return ctype_digit((string) $key)
            ? $query->find($key)
            : $query->where('kode_squad', strtoupper(ltrim((string) $key, '#')))->first();
    }

    /**
     * R2.01–R2.05: roster terkunci sejak Squad mendaftar turnamen
     * (menunggu atau diterima) sampai roster dibuka kembali
     * (pendaftaran ditolak / turnamen selesai, PB-09 & PB-10).
     */
    public function isRosterLocked(): bool
    {
        return $this->pendaftaranTurnamen()
            ->aktif()
            ->where('status_roster', 'terkunci')
            ->exists();
    }

    /**
     * Membuat Squad ID unik, contoh: SQD-7K2M9Q
     */
    public static function generateKode(): string
    {
        do {
            $kode = 'SQD-' . strtoupper(Str::random(6));
        } while (static::where('kode_squad', $kode)->exists());

        return $kode;
    }
}
?>