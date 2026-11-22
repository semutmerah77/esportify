<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Game extends Model
{
    protected $table = 'games';

    protected $primaryKey = 'id_game';

    protected $fillable = [
        'id_admin',
        'avatar',
        'nama_game',
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'id_admin', 'id_admin');
    }

    public function kategoris(): BelongsToMany
    {
        return $this->belongsToMany(
            Kategori::class,
            'kategori_game',
            'id_game',
            'id_kategori',
            'id_game',
            'id_kategori'
        );
    }

    // ==========================================
    // PB-21: game yang pernah diikuti Squad (turnamen selesai)
    // ==========================================

    /** SD: getDaftarGameBySquad(id_squad) */
    public static function getDaftarGameBySquad(int $idSquad)
    {
        $idGame = PendaftaranTurnamen::hasilAkhirSquad($idSquad)->select('pg.id_game')->toBase();

        return static::whereIn('id_game', $idGame)
            ->orderBy('nama_game')
            ->get(['id_game', 'nama_game', 'avatar']);
    }

    /** SD: getGameById(id_game) */
    public static function getGameById(int $idGame): ?self
    {
        return static::find($idGame, ['id_game', 'nama_game', 'avatar']);
    }
}
?>