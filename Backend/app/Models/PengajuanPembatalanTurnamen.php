<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Pengajuan pembatalan turnamen oleh Penyelenggara (PB-25, US59 & US60).
 */
class PengajuanPembatalanTurnamen extends Model
{
    protected $table = 'pengajuan_pembatalan_turnamen';
    protected $primaryKey = 'id_pengajuan_pembatalan';
    public $timestamps = false;

    public const STATUS_MENUNGGU = 'menunggu';
    public const STATUS_DISETUJUI = 'disetujui';
    public const STATUS_DITOLAK = 'ditolak';

    protected $fillable = [
        'id_turnamen',
        'id_penyelenggara',
        'id_admin',
        'alasan_pembatalan',
        'penjelasan_pembatalan',
        'status_pengajuan',
        'catatan_admin',
        'rencana_pengembalian_dana',
        'tanggal_pengajuan',
        'tanggal_verifikasi',
    ];

    protected $casts = [
        'rencana_pengembalian_dana' => 'datetime',
        'tanggal_pengajuan' => 'datetime',
        'tanggal_verifikasi' => 'datetime',
    ];

    public function turnamen(): BelongsTo
    {
        return $this->belongsTo(Turnamen::class, 'id_turnamen', 'id_turnamen');
    }

    public function penyelenggara(): BelongsTo
    {
        return $this->belongsTo(Penyelenggara::class, 'id_penyelenggara', 'id_penyelenggara');
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'id_admin', 'id_admin');
    }

    public function bukti(): HasMany
    {
        return $this->hasMany(BuktiPembatalanTurnamen::class, 'id_pengajuan_pembatalan', 'id_pengajuan_pembatalan')
            ->orderBy('id_bukti_pembatalan');
    }

    public function scopeMenunggu($query)
    {
        return $query->where('status_pengajuan', self::STATUS_MENUNGGU);
    }
}
