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

    // ==========================================
    // PB-29 — SD Melihat Home Player
    // Setiap bagian Home dibatasi 5 data (keputusan SA); sisanya lewat "Lihat semua".
    // ==========================================

    public const BATAS_HOME = 5;

    /**
     * SD: lihatTurnamenDiikuti(id_player).
     * Sama dengan /turnamen-saya: turnamen yang roster pendaftarannya memuat Player.
     */
    public static function lihatTurnamenDiikuti(int $idPlayer): array
    {
        $query = PendaftaranTurnamen::whereHas('anggota', fn ($q) => $q->where('id_player', $idPlayer));

        return [
            'total' => (clone $query)->count(),
            'data' => $query
                ->with([
                    'turnamen:id_turnamen,id_pengajuan,status,jadwal_main,jadwal_main_baru',
                    'turnamen.pengajuan:id_pengajuan,id_game,nama_turnamen,poster,jadwal_main',
                    'turnamen.pengajuan.game:id_game,nama_game',
                    'squad:id_squad,nama_squad,logo_squad',
                ])
                ->latest('tanggal_daftar')
                ->limit(self::BATAS_HOME)
                ->get(),
        ];
    }

    /**
     * SD: lihatKomunitasDiikuti(id_player).
     * Tabel Komunitas baru ada di Fase 3; sementara selalu kosong (keputusan SA).
     */
    public static function lihatKomunitasDiikuti(int $idPlayer): array
    {
        return ['total' => 0, 'data' => collect()];
    }

    /**
     * SD: lihatSquadSaya(id_player). Memakai Squad::getSquadByPlayer (PB-23).
     */
    public static function lihatSquadSaya(int $idPlayer): array
    {
        $squad = Squad::getSquadByPlayer($idPlayer);

        return [
            'total' => $squad->count(),
            'data' => $squad->take(self::BATAS_HOME)->values(),
        ];
    }
}
?>