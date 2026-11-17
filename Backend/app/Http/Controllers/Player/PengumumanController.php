<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\Pengumuman;
use App\Models\Turnamen;
use App\Services\PengumumanService;
use Illuminate\Http\Request;

/**
 * Sisi Player: tab Pengumuman di Turnamen Saya (PB-20, US57).
 * Hanya anggota aktif Squad yang pendaftarannya diterima (dan Penyelenggara).
 */
class PengumumanController extends Controller
{
    public function __construct(private PengumumanService $pengumuman)
    {
    }

    /**
     * GET /turnamen/{id}/pengumuman
     */
    public function index(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenDiikuti($request, $id);
        if ($error) {
            return $error;
        }

        $data = $this->pengumuman->daftar($turnamen)
            ->map(fn (Pengumuman $p) => $this->pengumuman->format($p))
            ->values();

        return response()->json([
            'success' => true,
            'message' => $data->isEmpty() ? 'Belum ada pengumuman.' : 'Daftar pengumuman berhasil diambil.',
            'data' => $data,
        ]);
    }

    /**
     * GET /turnamen/{id}/pengumuman/{idPengumuman}
     */
    public function show(Request $request, $id, $idPengumuman)
    {
        [$turnamen, $error] = $this->turnamenDiikuti($request, $id);
        if ($error) {
            return $error;
        }

        $pengumuman = $this->pengumuman->cari($turnamen, $idPengumuman);
        if (!$pengumuman) {
            return response()->json([
                'success' => false,
                'message' => 'Pengumuman tidak ditemukan.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail pengumuman berhasil diambil.',
            'data' => $this->pengumuman->format($pengumuman),
        ]);
    }

    private function turnamenDiikuti(Request $request, $id): array
    {
        $player = $request->user()->player;
        if (!$player) {
            return [null, response()->json([
                'success' => false,
                'message' => 'Profil Player tidak ditemukan.',
            ], 404)];
        }

        $turnamen = Turnamen::with(['pengajuan', 'penyelenggara'])->find($id);
        if (!$turnamen || !$turnamen->pengajuan) {
            return [null, response()->json([
                'success' => false,
                'message' => 'Turnamen tidak ditemukan.',
            ], 404)];
        }

        if (!$this->pengumuman->bolehMelihat($turnamen, $player)) {
            return [null, response()->json([
                'success' => false,
                'message' => 'Pengumuman hanya dapat dilihat oleh anggota Squad yang terdaftar di turnamen ini.',
            ], 403)];
        }

        return [$turnamen, null];
    }
}
?>