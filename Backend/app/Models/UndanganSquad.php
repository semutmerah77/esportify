<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UndanganSquad extends Model
{
    protected $table = 'undangan_squad';

    protected $primaryKey = 'id_undangan';

    protected $fillable = [
        'id_squad',
        'id_leader_squad',
        'id_player',
        'status_undangan',
    ];

    public function squad(): BelongsTo
    {
        return $this->belongsTo(Squad::class, 'id_squad', 'id_squad');
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'id_player', 'id_player');
    }

    public function leader(): BelongsTo
    {

        return $this->belongsTo(LeaderSquad::class, 'id_leader_squad', 'id_leader_squad');
    }
}
?>