<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BuktiPembatalanTurnamen extends Model
{
    protected $table = 'bukti_pembatalan_turnamen';
    protected $primaryKey = 'id_bukti_pembatalan';

    const UPDATED_AT = null;

    protected $fillable = [
        'id_pengajuan_pembatalan',
        'id_penyelenggara',
        'file_bukti_pendukung',
    ];

    protected $hidden = ['file_bukti_pendukung'];

    public function pengajuan(): BelongsTo
    {
        return $this->belongsTo(PengajuanPembatalanTurnamen::class, 'id_pengajuan_pembatalan', 'id_pengajuan_pembatalan');
    }
}
