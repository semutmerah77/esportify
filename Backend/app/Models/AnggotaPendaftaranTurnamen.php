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
    ];

    public function pendaftaran(): BelongsTo
    {
        return $this->belongsTo(PendaftaranTurnamen::class, 'id_pendaftaran', 'id_pendaftaran');
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'id_player', 'id_player');
    }
}
?>