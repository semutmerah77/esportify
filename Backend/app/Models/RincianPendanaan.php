<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RincianPendanaan extends Model
{
    protected $table = 'rincian_pendanaan_pengajuan';

    protected $primaryKey = 'id_rincian';

    public $timestamps = false;

    protected $fillable = [
        'id_pengajuan',
        'peruntukanDana',
        'keterangan',
        'nominal',
    ];

    public function pengajuan(): BelongsTo
    {
        return $this->belongsTo(
            PengajuanTurnamen::class,
            'id_pengajuan',
            'id_pengajuan'
        );
    }
}