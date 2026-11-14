<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PendaftaranTurnamen extends Model
{
    protected $table = 'pendaftaran_turnamen';

    protected $primaryKey = 'id_pendaftaran';

    /**
     * Status yang dihitung untuk slot, daftar dobel, dan player di squad lain.
     * Pendaftaran "ditolak" dianggap tidak ada.
     */
    public const STATUS_AKTIF = ['menunggu', 'diterima'];

    protected $fillable = [
        'id_squad',
        'id_turnamen',
        'id_player',
        'nickname_game',
        'uid_game',
        'bukti_pembayaran',
        'status_pendaftaran',
        'tanggal_daftar',
        'tanggal_verifikasi',
        'alasan_penolakan',
    ];

    protected $hidden = [
        'bukti_pembayaran',
    ];

    protected $casts = [
        'tanggal_daftar' => 'datetime',
        'tanggal_verifikasi' => 'datetime',
    ];

    public function squad(): BelongsTo
    {
        return $this->belongsTo(Squad::class, 'id_squad', 'id_squad');
    }

    public function turnamen(): BelongsTo
    {
        return $this->belongsTo(Turnamen::class, 'id_turnamen', 'id_turnamen');
    }

    /**
     * Player yang mendaftarkan (perwakilan).
     */
    public function pendaftar(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'id_player', 'id_player');
    }

    /**
     * Roster yang didaftarkan (snapshot anggota saat mendaftar).
     */
    public function anggota(): HasMany
    {
        return $this->hasMany(AnggotaPendaftaranTurnamen::class, 'id_pendaftaran', 'id_pendaftaran');
    }

    /**
     * "terkunci" kalau masih ada pemain di roster ini yang terkunci.
     */
    public function statusRoster(): string
    {
        return $this->anggota()->where('status_roster', 'terkunci')->exists()
            ? 'terkunci'
            : 'terbuka';
    }

    public function scopeAktif(Builder $query): Builder
    {
        return $query->whereIn('status_pendaftaran', self::STATUS_AKTIF);
    }
}
?>