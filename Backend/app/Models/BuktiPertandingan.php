<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BuktiPertandingan extends Model
{
    protected $table = 'bukti_pertandingan';

    protected $primaryKey = 'id_bukti';

    // PDM: hanya created_at
    public const UPDATED_AT = null;

    protected $fillable = [
        'id_laporan',
        'file_bukti',
        'catatan',
        'tanggal_upload',
        'tanggal_verifikasi',
    ];

    protected $hidden = [
        'file_bukti',
    ];

    protected $casts = [
        'tanggal_upload' => 'datetime',
        'tanggal_verifikasi' => 'datetime',
    ];

    public function laporan(): BelongsTo
    {
        return $this->belongsTo(LaporanHasilPertandingan::class, 'id_laporan', 'id_laporan');
    }
}
