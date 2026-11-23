<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Player extends Model
{
    protected $table = 'players';

    protected $primaryKey = 'id_player';

    protected $fillable = [
        'id_user',
        'avatar',
        'bio',
        'jenis_kelamin',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'id_user', 'id_user');
    }

    
    /**
     * PB-23 — SD Lihat Badge Profil Player: getPlayerById(id_player).
     * Hanya Player dengan akun aktif (sama seperti hasil Cari Player).
     */
    public static function getPlayerById(int $idPlayer): ?self
    {
        return static::with('user')
            ->whereHas('user', fn ($q) => $q->where('status', 'aktif'))
            ->find($idPlayer);
    }
}
?>