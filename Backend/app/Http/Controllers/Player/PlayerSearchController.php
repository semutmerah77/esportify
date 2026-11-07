<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\Player;
use Illuminate\Http\Request;

class PlayerSearchController extends Controller
{
    /**
     * Batas jumlah hasil pencarian Player agar response tetap ringan.
     */
    private const MAKS_HASIL = 20;

    /**
     * F2-US34 — Mencari Player berdasarkan username
     * GET /players?q=<username>
     * Hanya Player dengan akun aktif; Player yang sedang login tidak ditampilkan.
     */
    public function index(Request $request)
    {
        $player = $request->user()->player;

        $q = trim((string) $request->query('q', ''));

        if ($q === '') {
            return response()->json([
                'success' => true,
                'message' => 'Masukkan username untuk mencari Player.',
                'data' => [],
            ], 200);

        }

        $like = '%' . addcslashes($q, '%_\\') . '%';

        $players = Player::query()
            ->whereHas('user', function ($query) use ($like) {
                $query->where('status', 'aktif')
                    ->where('username', 'like', $like);
            })
            ->when($player, fn ($query) => $query->where('id_player', '!=', $player->id_player))
            ->with('user')
            ->get()
            ->sortBy(fn (Player $p) => strtolower($p->user->username))
            ->take(self::MAKS_HASIL)
            ->values()
            ->map(fn (Player $p) => [
                'id_player' => $p->id_player,
                'username' => $p->user->username,
                'avatar' => $p->avatar,
                'avatar_url' => $p->avatar ? asset('storage/' . $p->avatar) : null,
            ]);

        return response()->json([
            'success' => true,
            'message' => $players->isEmpty()
                ? 'Hasil tidak ditemukan.'
                : 'Daftar Player berhasil ditampilkan.',
            'data' => $players,
        ], 200);
    }
}
?>