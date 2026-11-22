<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Models\PendaftaranTurnamen;
use App\Models\Squad;
use App\Models\Turnamen;

/**
 * PB-21 — SD Lihat Win Rate Squad.
 * Semua Player (anggota maupun bukan) bisa melihat dari Detail Squad.
 * Win Rate = (Jumlah Juara 1 / Total Turnamen Selesai yang Diikuti) x 100%.
 * Hanya turnamen berstatus selesai dengan pendaftaran diterima.
 */
class LihatWinRateSquadController extends Controller
{
    /** GET /squad/{id}/win-rate */
    public function getWinRateSquad($id)
    {
        if (!$squad = $this->squad($id)) {
            return $this->squadNotFound();
        }

        $dataWinRate = PendaftaranTurnamen::getWinRateBySquad($squad->id_squad);

        return response()->json([
            'success' => true,
            'message' => 'Win rate Squad berhasil ditampilkan.',
            'data' => [
                'id_squad' => $squad->id_squad,
                'total_turnamen' => $dataWinRate['total_turnamen'],
                'total_juara_1' => $dataWinRate['total_juara_1'],
                'win_rate' => $this->calculateWinRate($dataWinRate['total_juara_1'], $dataWinRate['total_turnamen']),
                'ada_data' => $dataWinRate['total_turnamen'] > 0,
            ],
        ]);
    }

    /** GET /squad/{id}/win-rate/detail ("Lihat Semua") */
    public function getDetailWinRateSquad($id)
    {
        if (!$squad = $this->squad($id)) {
            return $this->squadNotFound();
        }

        $totalTurnamen = Turnamen::getTotalTurnamenBySquad($squad->id_squad);
        $totalKemenangan = PendaftaranTurnamen::getStatistikKemenanganBySquad($squad->id_squad);
        $daftarGame = Game::getDaftarGameBySquad($squad->id_squad);

        // Untuk setiap Game yang pernah diikuti Squad
        $dataGame = $daftarGame->map(function (Game $game) use ($squad) {
            $statistikGame = PendaftaranTurnamen::getStatistikByGame($squad->id_squad, $game->id_game);

            return $this->formatGame($game) + [
                'total_turnamen' => $statistikGame['total_turnamen'],
                'total_juara_1' => $statistikGame['total_juara_1'],
                'win_rate' => $this->calculateWinRate($statistikGame['total_juara_1'], $statistikGame['total_turnamen']),
            ];
        })->values();

        return response()->json([
            'success' => true,
            'message' => 'Detail win rate Squad berhasil ditampilkan.',
            'data' => [
                'id_squad' => $squad->id_squad,
                'total_turnamen' => $totalTurnamen,
                'total_kemenangan' => $totalKemenangan,
                'win_rate' => $this->calculateWinRate($totalKemenangan, $totalTurnamen),
                'ada_data' => $totalTurnamen > 0,
                'daftar_game' => $dataGame,
            ],
        ]);
    }

    /** GET /squad/{id}/win-rate/daftar-game (dropdown Filter Game) */
    public function getDaftarGameBySquad($id)
    {
        if (!$squad = $this->squad($id)) {
            return $this->squadNotFound();
        }

        return response()->json([
            'success' => true,
            'message' => 'Daftar game berhasil ditampilkan.',
            'data' => Game::getDaftarGameBySquad($squad->id_squad)
                ->map(fn (Game $game) => $this->formatGame($game))
                ->values(),
        ]);
    }

    /** GET /squad/{id}/win-rate/game/{idGame} */
    public function getWinRateByGame($id, $idGame)
    {
        if (!$squad = $this->squad($id)) {
            return $this->squadNotFound();
        }

        $dataGame = Game::getGameById((int) $idGame);
        if (!$dataGame) {
            return response()->json(['success' => false, 'message' => 'Game tidak ditemukan.'], 404);
        }

        $totalTurnamenGame = Turnamen::getTotalTurnamenBySquadAndGame($squad->id_squad, $dataGame->id_game);
        $statistikGame = PendaftaranTurnamen::getStatistikByGame($squad->id_squad, $dataGame->id_game);

        // Belum pernah mengikuti turnamen selesai pada game tersebut
        if ($totalTurnamenGame === 0) {
            return response()->json([
                'success' => true,
                'message' => 'Belum ada data.',
                'data' => [
                    'id_squad' => $squad->id_squad,
                    'game' => $this->formatGame($dataGame),
                    'ada_data' => false,
                    'total_turnamen' => 0,
                    'total_juara_1' => 0,
                    'win_rate' => null,
                ],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Win rate Squad per game berhasil ditampilkan.',
            'data' => [
                'id_squad' => $squad->id_squad,
                'game' => $this->formatGame($dataGame),
                'ada_data' => true,
                'total_turnamen' => $totalTurnamenGame,
                'total_juara_1' => $statistikGame['total_juara_1'],
                'win_rate' => $this->calculateWinRate($statistikGame['total_juara_1'], $totalTurnamenGame),
            ],
        ]);
    }

    /**
     * SD: calculateWinRate()
     * Win Rate = (Jumlah Juara 1 / Total Turnamen Selesai) x 100%, dibulatkan 2 desimal.
     */
    private function calculateWinRate(int $jumlahJuara1, int $totalTurnamen): float
    {
        return $totalTurnamen > 0 ? round($jumlahJuara1 / $totalTurnamen * 100, 2) : 0.0;
    }

    private function squad($id): ?Squad
    {
        return ctype_digit((string) $id) ? Squad::find($id) : null;
    }

    private function squadNotFound()
    {
        return response()->json(['success' => false, 'message' => 'Squad tidak ditemukan.'], 404);
    }

    private function formatGame(Game $game): array
    {
        return [
            'id_game' => $game->id_game,
            'nama_game' => $game->nama_game,
            'avatar_url' => $game->avatar ? asset('storage/' . $game->avatar) : null,
        ];
    }
}