<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PermintaanBergabung extends Model
{
    protected $table = 'permintaan_bergabung';

    protected $primaryKey = 'id_permintaan';

    protected $fillable = [
        'id_squad',
        'id_player',
        'id_leader_squad',
        'status_permintaan',
        'tanggal_diproses',
    ];

    protected $casts = [
        'tanggal_diproses' => 'datetime',
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