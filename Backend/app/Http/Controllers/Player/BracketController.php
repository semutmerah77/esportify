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
 *
 * - Hanya peserta (anggota aktif Squad yang pendaftarannya diterima) dan
 *   Penyelenggara yang dapat melihat bracket, baik draft maupun dipublikasikan.
 * - R6.29: sebelum dipublikasikan, peserta melihat struktur bracket; hanya
 *   Squad miliknya yang tampil, Squad lain dikirim sebagai "Squad tersembunyi".
 * - Setelah dipublikasikan, identitas seluruh Squad ditampilkan.
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

        $penyelenggara = $this->pendaftaran->isPenyelenggara($turnamen, $player);
        $milikSaya = $this->bracket->pendaftaranPesertaPlayer($turnamen, $player->id_player);

        if (!$penyelenggara && $milikSaya->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Bracket hanya dapat dilihat oleh peserta turnamen ini.',
            ], 403);
        }

        $bracket = BracketTurnamen::where('id_turnamen', $turnamen->id_turnamen)->first();
        $dipublikasikan = $bracket !== null && !$bracket->isDraft();
        $samarkan = !$dipublikasikan && !$penyelenggara;
        $utama = $milikSaya->first();

        $keterangan = match (true) {
            $bracket === null => 'Bracket belum tersedia.',
            !$dipublikasikan => 'Bracket belum dipublikasikan. Identitas Squad lain masih disamarkan dan posisi dapat berubah.',
            default => null,
        };

        return response()->json([
            'success' => true,
            'message' => $dipublikasikan ? 'Bracket berhasil diambil.' : 'Bracket belum dipublikasikan.',
            'data' => [
                'turnamen' => [
                    'id_turnamen' => $turnamen->id_turnamen,
                    'nama_turnamen' => $turnamen->pengajuan->nama_turnamen,
                    'status' => $turnamen->status,
                ] + $this->bracket->infoPersiapan($turnamen),
                'dipublikasikan' => $dipublikasikan,
                'disamarkan' => $bracket !== null && $samarkan,
                'keterangan' => $keterangan,
                'squad_saya' => $utama ? [
                    'id_pendaftaran' => $utama->id_pendaftaran,
                    'id_squad' => $utama->id_squad,
                    'nama_squad' => $utama->squad?->nama_squad,
                ] : null,
                'bracket' => $bracket
                    ? $this->bracket->formatBracket($bracket, $milikSaya->pluck('id_pendaftaran')->all(), false, $samarkan)
                    : null,
            ],
        ]);
    }
}
