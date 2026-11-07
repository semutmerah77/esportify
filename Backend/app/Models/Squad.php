<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Squad extends Model
{
    protected $table = 'squad';

    protected $primaryKey = 'id_squad';

    protected $fillable = [
        'id_leader_squad',
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

    public function leader(): BelongsTo
    {
        return $this->belongsTo(LeaderSquad::class, 'id_leader_squad', 'id_leader_squad');
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
     * R2.01–R2.05: roster terkunci selama Squad terdaftar pada turnamen
     * yang belum selesai.
     *
     * TODO PB-06/PB-09: isi pengecekan ke tabel pendaftaran_turnamen
     * setelah fitur pendaftaran turnamen dibuat. Untuk sekarang roster
     * selalu dianggap tidak terkunci.
     */
    public function isRosterLocked(): bool
    {
        return false;
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