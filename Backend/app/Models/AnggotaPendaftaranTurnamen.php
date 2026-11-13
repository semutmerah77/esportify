<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnggotaPendaftaranTurnamen extends Model
{
    protected $table = 'anggota_pendaftaran_turnamen';

    protected $primaryKey = 'id_anggota_pendaftaran';

    public $timestamps = false;

        protected $fillable = [
        'id_pendaftaran',
        'id_player',
        'id_turnamen',
        'status_roster',
        'tanggal_penguncian',
        'tanggal_pembukaan',
    ];

    protected $casts = [
        'tanggal_penguncian' => 'datetime',
        'tanggal_pembukaan' => 'datetime',
    ];

    public function pendaftaran(): BelongsTo
    {
        return $this->belongsTo(PendaftaranTurnamen::class, 'id_pendaftaran', 'id_pendaftaran');
    }

        public function turnamen(): BelongsTo
    {
        return $this->belongsTo(Turnamen::class, 'id_turnamen', 'id_turnamen');
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'id_player', 'id_player');
    }
}
?>