<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnggotaSquad extends Model
{
    protected $table = 'anggota_squad';

    protected $primaryKey = 'id_anggota_squad';

    protected $fillable = [
        'id_squad',
        'id_player',
        'tanggal_bergabung',
        'status_anggota',
    ];

    protected $casts = [
        'tanggal_bergabung' => 'datetime',
    ];

    public function squad(): BelongsTo
    {
        return $this->belongsTo(Squad::class, 'id_squad', 'id_squad');
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'id_player', 'id_player');
    }
}
?>