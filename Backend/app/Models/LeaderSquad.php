<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeaderSquad extends Model
{
    protected $table = 'leader_squad';

    protected $primaryKey = 'id_leader_squad';

    protected $fillable = [
        'id_player',
    ];

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'id_player', 'id_player');
    }

    public function squad(): HasMany
    {
        return $this->hasMany(Squad::class, 'id_leader_squad', 'id_leader_squad');
    }
}
?>