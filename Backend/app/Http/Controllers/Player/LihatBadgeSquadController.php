<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Models\PendaftaranTurnamen;
use App\Models\Squad;

/**
 * PB-21 — SD Lihat Badge Squad (sekaligus riwayat turnamen Squad).
 * Semua Player bisa melihat dari Detail Squad.
 * Badge dari peringkat_akhir (1/2/3) pada turnamen berstatus selesai
 * dengan pendaftaran diterima. Tidak ada tabel badge.
 */
class LihatBadgeSquadController extends Controller
{
    /** GET /squad/{id}/badge — koleksi badge Juara 1-3 */
    public function getBadgePrestasiJuara($id)
    {
        if (!$squad = $this->squad($id)) {
            return $this->squadNotFound();
        }

        $dataBadgeJuara = PendaftaranTurnamen::getBadgePrestasiJuara($squad->id_squad);

        return response()->json([
            'success' => true,
            'message' => 'Badge prestasi Squad berhasil ditampilkan.',
            'data' => ['id_squad' => $squad->id_squad] + $dataBadgeJuara,
        ]);
    }

    /** GET /squad/{id}/pencapaian — semua pencapaian / riwayat turnamen selesai ("Lihat Semua") */
    public function getDaftarPencapaianSquad($id)
    {
        if (!$squad = $this->squad($id)) {
            return $this->squadNotFound();
        }

        $daftarPencapaian = PendaftaranTurnamen::getDaftarPencapaianSquad($squad->id_squad);

        return response()->json([
            'success' => true,
            'message' => $daftarPencapaian->isEmpty() ? 'Belum ada data.' : 'Daftar pencapaian Squad berhasil ditampilkan.',
            'data' => $daftarPencapaian->map(fn ($baris) => $this->formatPencapaian($baris))->values(),
        ]);
    }

    /** GET /squad/{id}/pencapaian/daftar-game (dropdown Filter Game) */
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

    /** GET /squad/{id}/pencapaian/game/{idGame} */
    public function getPencapaianSquadByGame($id, $idGame)
    {
        if (!$squad = $this->squad($id)) {
            return $this->squadNotFound();
        }

        $daftarPencapaianGame = ctype_digit((string) $idGame)
            ? PendaftaranTurnamen::getPencapaianSquadByGame($squad->id_squad, (int) $idGame)
            : collect();

        return response()->json([
            'success' => true,
            'message' => $daftarPencapaianGame->isEmpty() ? 'Belum ada data.' : 'Pencapaian Squad per game berhasil ditampilkan.',
            'data' => $daftarPencapaianGame->map(fn ($baris) => $this->formatPencapaian($baris))->values(),
        ]);
    }

    private function formatPencapaian(object $baris): array
    {
        $peringkat = $baris->peringkat_akhir !== null ? (int) $baris->peringkat_akhir : null;

        return [
            'id_turnamen' => (int) $baris->id_turnamen,
            'nama_turnamen' => $baris->nama_turnamen,
            'poster_url' => $baris->poster ? asset('storage/' . $baris->poster) : null,
            'jadwal_main' => $baris->jadwal_main_aktif,
            'game' => [
                'id_game' => $baris->id_game !== null ? (int) $baris->id_game : null,
                'nama_game' => $baris->nama_game,
                'avatar_url' => $baris->avatar_game ? asset('storage/' . $baris->avatar_game) : null,
            ],
            'peringkat_akhir' => $peringkat,
            // null = ikut turnamen tetapi tidak juara
            'label_peringkat' => $peringkat !== null && $peringkat <= 3 ? "Juara {$peringkat}" : 'Peserta',
        ];
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