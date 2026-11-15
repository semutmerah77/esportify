<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\BracketTurnamen;
use App\Models\Turnamen;
use App\Services\BracketService;
use App\Services\PendaftaranTurnamenService;
use Illuminate\Http\Request;

/**
 * Sisi Player: tab Bracket (PB-14, US42, US43, US47).
 * Isi bracket baru tampil setelah dipublikasikan (R6.29).
 */
class BracketController extends Controller
{
    public function __construct(
        private BracketService $bracket,
        private PendaftaranTurnamenService $pendaftaran
    ) {
    }

    /**
     * GET /turnamen/{id}/bracket
     */
    public function show(Request $request, $id)
    {
        $player = $request->user()->player;
        if (!$player) {
            return response()->json([
                'success' => false,
                'message' => 'Profil Player tidak ditemukan.',
            ], 404);
        }

        $turnamen = Turnamen::with('pengajuan')->find($id);
        if (!$turnamen || !$turnamen->pengajuan) {
            return response()->json([
                'success' => false,
                'message' => 'Turnamen tidak ditemukan.',
            ], 404);
        }

        $bracket = BracketTurnamen::where('id_turnamen', $turnamen->id_turnamen)->first();
        $dipublikasikan = $bracket !== null && !$bracket->isDraft();

        // Pendaftaran diterima yang roster-nya memuat Player login (untuk penanda)
        $pendaftaranSaya = $this->pendaftaran->pendaftaranDiterimaPlayer($turnamen->id_turnamen, $player->id_player);
        $pendaftaranSaya?->loadMissing('squad');

        return response()->json([
            'success' => true,
            'message' => $dipublikasikan
                ? 'Bracket berhasil diambil.'
                : 'Bracket belum dipublikasikan.',
            'data' => [
                'turnamen' => [
                    'id_turnamen' => $turnamen->id_turnamen,
                    'nama_turnamen' => $turnamen->pengajuan->nama_turnamen,
                    'status' => $turnamen->status,
                ] + $this->bracket->infoPersiapan($turnamen),
                'dipublikasikan' => $dipublikasikan,
                'keterangan' => $dipublikasikan ? null : 'Bracket belum dipublikasikan.',
                'squad_saya' => $pendaftaranSaya ? [
                    'id_pendaftaran' => $pendaftaranSaya->id_pendaftaran,
                    'id_squad' => $pendaftaranSaya->id_squad,
                    'nama_squad' => $pendaftaranSaya->squad?->nama_squad,
                ] : null,
                'bracket' => $dipublikasikan
                    ? $this->bracket->formatBracket($bracket, $pendaftaranSaya?->id_pendaftaran)
                    : null,
            ],
        ]);
    }
}
