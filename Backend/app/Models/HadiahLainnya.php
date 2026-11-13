<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HadiahLainnya extends Model
{
    protected $table = 'hadiah_lainnya_pengajuan';

    protected $primaryKey = 'id_hadiah';

    public $timestamps = false;

    protected $fillable = [
        'id_pengajuan',
        'nama_hadiah',
        'keterangan',
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