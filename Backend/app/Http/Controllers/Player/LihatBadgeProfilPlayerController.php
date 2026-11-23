<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\PendaftaranTurnamen;
use App\Models\Player;
use App\Models\Squad;
use Illuminate\Http\Request;

/**
 * PB-23 — SD Lihat Badge Profil Player (Piala Individu Player).
 * Membuka profil Player lain (dari Cari Player / daftar anggota Squad).
 * Dipakai ulang oleh PB-27 (tombol Kirim Pesan di profil).
 */
class LihatBadgeProfilPlayerController extends Controller
{
    /** GET /players/{id}/profil */
    public function getProfilePlayer(Request $request, $id)
    {
        $dataPlayer = ctype_digit((string) $id) ? Player::getPlayerById((int) $id) : null;

        if (!$dataPlayer) {
            return response()->json([
                'success' => false,
                'message' => 'Player tidak ditemukan.',
            ], 404);
        }

        // Mengambil Informasi Squad
        $dataSquad = Squad::getSquadByPlayer($dataPlayer->id_player);

        // Mengambil Informasi Piala Individu
        $dataPrestasi = PendaftaranTurnamen::getPrestasiByPlayer($dataPlayer->id_player);

        return response()->json([
            'success' => true,
            'message' => 'Profil Player berhasil ditampilkan.',
            'data' => [
                'id_player' => $dataPlayer->id_player,
                'username' => $dataPlayer->user->username,
                'avatar_url' => $dataPlayer->avatar ? asset('storage/' . $dataPlayer->avatar) : null,
                'bio' => $dataPlayer->bio,
                'jenis_kelamin' => $dataPlayer->jenis_kelamin,
                'squad' => $dataSquad->map(fn (Squad $squad) => [
                    'id_squad' => $squad->id_squad,
                    'kode_squad' => $squad->kode_squad,
                    'nama_squad' => $squad->nama_squad,
                    'logo_url' => $squad->logo_squad ? asset('storage/' . $squad->logo_squad) : null,
                ])->values(),
                'piala' => $dataPrestasi,
                // true → FE menyembunyikan tombol Kirim Pesan
                'profil_sendiri' => (int) $request->user()->player?->id_player === (int) $dataPlayer->id_player,
            ],
        ]);
    }
}