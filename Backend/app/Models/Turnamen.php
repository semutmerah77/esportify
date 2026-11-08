<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Turnamen extends Model
{
    protected $table = 'turnamen';

    protected $primaryKey = 'id_turnamen';

    protected $fillable = [
        'id_pengajuan',
        'id_penyelenggara',
        'status',
    ];

    public function pengajuan(): BelongsTo
    {
        return $this->belongsTo(
            PengajuanTurnamen::class,
            'id_pengajuan',
            'id_pengajuan'
        );
    }

    public function penyelenggara(): BelongsTo
    {
        return $this->belongsTo(
            Penyelenggara::class,
            'id_penyelenggara',
            'id_penyelenggara'
        );
    }

    public function pendaftaran(): HasMany
    {
        return $this->hasMany(
            PendaftaranTurnamen::class,
            'id_turnamen',
            'id_turnamen'
        );
    }

    /**
     * Jumlah slot yang terisi (pendaftaran menunggu + diterima).
     */
    public function slotTerisi(): int
    {
        return $this->pendaftaran()->aktif()->count();
    }
}
?>