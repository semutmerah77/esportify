<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Riwayat kepemimpinan Squad.
 * Leader yang sedang menjabat = baris dengan tanggal_berakhir NULL.
 */
class LeaderSquad extends Model
{
    protected $table = 'leader_squad';

    protected $primaryKey = 'id_leader_squad';

    protected $fillable = [
        'id_player',
        'id_squad',
        'tanggal_pengangkatan',
        'tanggal_berakhir',
    ];

    protected $casts = [
        'tanggal_pengangkatan' => 'datetime',
        'tanggal_berakhir' => 'datetime',
    ];

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'id_player', 'id_player');
    }

    public function squad(): BelongsTo
    {
        return $this->belongsTo(Squad::class, 'id_squad', 'id_squad');
    }
}
?>