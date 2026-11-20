<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RefundTurnamen extends Model
{
    protected $table = 'refund_turnamen';

    protected $primaryKey = 'id_refund';

    public $timestamps = false;

    public const STATUS_MENUNGGU_DATA = 'menunggu_data';
    public const STATUS_MENUNGGU_TRANSFER = 'menunggu_transfer';
    public const STATUS_SELESAI = 'selesai';

    protected $fillable = [
        'id_pendaftaran',
        'metode_refund',
        'nomor_rekening',
        'file_qris',
        'atas_nama',
        'bukti_transfer',
        'status_refund',
        'tanggal_pengajuan',
        'tanggal_refund',
    ];

    protected $hidden = [
        'file_qris',
        'bukti_transfer',
    ];

    protected $casts = [
        'tanggal_pengajuan' => 'datetime',
        'tanggal_refund' => 'datetime',
    ];

    public function pendaftaran(): BelongsTo
    {
        return $this->belongsTo(PendaftaranTurnamen::class, 'id_pendaftaran', 'id_pendaftaran');
    }
}
