<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\Pengumuman;
use App\Models\Turnamen;
use App\Services\PendaftaranTurnamenService;
use App\Services\PengumumanService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Sisi Penyelenggara: tab Pengumuman di Kelola Turnamen (PB-20, US56).
 * Buat, lihat, edit (batas 30 menit + sesi edit), dan hapus pengumuman.
 */
class KelolaPengumumanController extends Controller
{
    public function __construct(
        private PengumumanService $pengumuman,
        private PendaftaranTurnamenService $pendaftaran
    ) {
    }

    /**
     * GET /turnamen-kelolaan/{id}/pengumuman
     */
    public function index(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $data = $this->pengumuman->daftar($turnamen)
            ->map(fn (Pengumuman $p) => $this->pengumuman->format($p, true))
            ->values();

        $alasan = $this->pengumuman->alasanTidakBisaBuat($turnamen);

        return response()->json([
            'success' => true,
            'message' => $data->isEmpty() ? 'Belum ada pengumuman.' : 'Daftar pengumuman berhasil diambil.',
            'data' => $data,
            'meta' => [
                'bisa_buat' => $alasan === null,
                'alasan_tidak_bisa_buat' => $alasan,
                'durasi_edit_menit' => PengumumanService::DURASI_EDIT_MENIT,
                'waktu_server' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * POST /turnamen-kelolaan/{id}/pengumuman
     */
    public function store(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        if ($alasan = $this->pengumuman->alasanTidakBisaBuat($turnamen)) {
            return $this->gagal($alasan);
        }

        if ($error = $this->validasi($request)) {
            return $error;
        }

        $pengumuman = $this->pengumuman->buat(
            $turnamen,
            trim((string) $request->input('judul')),
            trim((string) $request->input('isi_pengumuman'))
        );

        return response()->json([
            'success' => true,
            'message' => 'Pengumuman berhasil dibuat dan dikirim ke peserta turnamen.',
            'data' => $this->pengumuman->format($pengumuman->fresh(), true),
            'meta' => ['waktu_server' => now()->toIso8601String()],
        ], 201);
    }

    /**
     * GET /turnamen-kelolaan/{id}/pengumuman/{idPengumuman}
     */
    public function show(Request $request, $id, $idPengumuman)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $pengumuman = $this->pengumuman->cari($turnamen, $idPengumuman);
        if (!$pengumuman) {
            return $this->tidakDitemukan();
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail pengumuman berhasil diambil.',
            'data' => $this->pengumuman->format($pengumuman, true),
            'meta' => ['waktu_server' => now()->toIso8601String()],
        ]);
    }

    /**
     * POST /turnamen-kelolaan/{id}/pengumuman/{idPengumuman}/mulai-edit
     * Dipanggil saat tombol Edit diklik. Hanya bisa sebelum 30 menit dari pembuatan.
     */
    public function mulaiEdit(Request $request, $id, $idPengumuman)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $pengumuman = $this->pengumuman->cari($turnamen, $idPengumuman);
        if (!$pengumuman) {
            return $this->tidakDitemukan();
        }

        if (!$this->pengumuman->masihDalamBatasEdit($pengumuman)) {
            return $this->gagal('Batas waktu edit pengumuman sudah habis.');
        }

        [$token, $berakhir] = $this->pengumuman->mulaiEdit($pengumuman);

        return response()->json([
            'success' => true,
            'message' => 'Sesi edit pengumuman dimulai.',
            'data' => [
                'token_edit' => $token,
                'sesi_edit_berakhir' => $berakhir->toIso8601String(),
                'pengumuman' => $this->pengumuman->format($pengumuman, true),
            ],
            'meta' => ['waktu_server' => now()->toIso8601String()],
        ]);
    }

    /**
     * PUT /turnamen-kelolaan/{id}/pengumuman/{idPengumuman}
     * Wajib membawa token_edit dari mulai-edit. Boleh disimpan walau sudah lewat
     * 30 menit dari pembuatan, selama sesi edit masih berlaku.
     */
    public function update(Request $request, $id, $idPengumuman)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $pengumuman = $this->pengumuman->cari($turnamen, $idPengumuman);
        if (!$pengumuman) {
            return $this->tidakDitemukan();
        }

        if (!$this->pengumuman->sesiValid($pengumuman, $request->input('token_edit'))) {
            return $this->gagal('Sesi edit sudah berakhir. Perubahan tidak disimpan.');
        }

        if ($error = $this->validasi($request)) {
            return $error;
        }

        $pengumuman = $this->pengumuman->ubah(
            $pengumuman,
            trim((string) $request->input('judul')),
            trim((string) $request->input('isi_pengumuman'))
        );

        return response()->json([
            'success' => true,
            'message' => 'Pengumuman berhasil diperbarui.',
            'data' => $this->pengumuman->format($pengumuman->fresh(), true),
            'meta' => ['waktu_server' => now()->toIso8601String()],
        ]);
    }

    /**
     * POST /turnamen-kelolaan/{id}/pengumuman/{idPengumuman}/batal-edit
     */
    public function batalEdit(Request $request, $id, $idPengumuman)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $pengumuman = $this->pengumuman->cari($turnamen, $idPengumuman);
        if (!$pengumuman) {
            return $this->tidakDitemukan();
        }

        // Hanya sesi milik token ini yang ditutup (tidak mengganggu sesi baru di tab lain)
        if ($this->pengumuman->sesiValid($pengumuman, $request->input('token_edit'))) {
            $this->pengumuman->akhiriSesi($pengumuman);
        }

        return response()->json([
            'success' => true,
            'message' => 'Edit pengumuman dibatalkan.',
            'data' => $this->pengumuman->format($pengumuman, true),
            'meta' => ['waktu_server' => now()->toIso8601String()],
        ]);
    }

    /**
     * DELETE /turnamen-kelolaan/{id}/pengumuman/{idPengumuman}
     * Boleh kapan saja.
     */
    public function destroy(Request $request, $id, $idPengumuman)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $pengumuman = $this->pengumuman->cari($turnamen, $idPengumuman);
        if (!$pengumuman) {
            return $this->tidakDitemukan();
        }

        $this->pengumuman->hapus($pengumuman);

        return response()->json([
            'success' => true,
            'message' => 'Pengumuman berhasil dihapus.',
            'data' => null,
        ]);
    }

    // ==========================================
    // HELPER
    // ==========================================

    private function validasi(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'judul' => ['required', 'string', 'max:150'],
            'isi_pengumuman' => ['required', 'string', 'max:5000'],
        ], [
            'judul.required' => 'Judul pengumuman wajib diisi.',
            'judul.string' => 'Judul pengumuman tidak valid.',
            'judul.max' => 'Judul pengumuman maksimal 150 karakter.',
            'isi_pengumuman.required' => 'Isi pengumuman wajib diisi.',
            'isi_pengumuman.string' => 'Isi pengumuman tidak valid.',
            'isi_pengumuman.max' => 'Isi pengumuman maksimal 5000 karakter.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        return null;
    }

    private function turnamenKelolaan(Request $request, $id): array
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

        if (!$this->pendaftaran->isPenyelenggara($turnamen, $player)) {
            return [null, response()->json([
                'success' => false,
                'message' => 'Anda bukan penyelenggara turnamen ini.',
            ], 403)];
        }

        return [$turnamen, null];
    }

    private function tidakDitemukan()
    {
        return response()->json([
            'success' => false,
            'message' => 'Pengumuman tidak ditemukan.',
        ], 404);
    }

    private function gagal(string $pesan)
    {
        return response()->json([
            'success' => false,
            'message' => $pesan,
        ], 422);
    }
}
?>