<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

/**
 * PB-30 — SD Melihat dan Membuka Notifikasi & SD Notifikasi Tandai Semua Dibaca.
 * Hanya untuk Player (R10.01), termasuk Leader & Penyelenggara.
 * Notifikasi yang lebih dari 30 hari tidak ditampilkan (R10.04).
 */
class NotifikasiController extends Controller
{
    /**
     * GET /notifikasi/penanda
     * SD: cekPenandaNotifikasi() → titik biru tanpa jumlah (R10.03).
     */
    public function cekPenandaNotifikasi(Request $request)
    {
        $jumlahNotifikasi = $request->user()->hitungNotifikasiBelumDibaca();

        return response()->json([
            'success' => true,
            'message' => 'Penanda notifikasi berhasil diambil.',
            'data' => [
                'ada_belum_dibaca' => $jumlahNotifikasi > 0,
            ],
        ]);
    }

    /**
     * GET /notifikasi?page=1
     * SD: tampilkanDaftarNotifikasi() → 30 hari terakhir, terbaru lebih dulu,
     * setiap item membawa kelompok waktu (R10.04).
     */
    public function tampilkanDaftarNotifikasi(Request $request)
    {
        $daftarNotifikasi = $request->user()->lihatDaftarNotifikasi();

        return response()->json([
            'success' => true,
            'message' => $daftarNotifikasi->isEmpty() && $daftarNotifikasi->onFirstPage()
                ? 'Belum ada notifikasi.'
                : 'Daftar notifikasi berhasil ditampilkan.',
            'data' => [
                'notifikasi' => collect($daftarNotifikasi->items())
                    ->map(fn (Notification $n) => $this->formatNotifikasi($n))
                    ->values(),
                'halaman' => $daftarNotifikasi->currentPage(),
                'ada_halaman_berikutnya' => $daftarNotifikasi->hasMorePages(),
            ],
        ]);
    }

    /**
     * POST /notifikasi/{id}/buka
     * SD: bukaNotifikasi(id) → tandaiNotifikasiDibaca(id) → markAsRead(),
     * lalu mengembalikan tautan halaman tujuan (R10.05).
     */
    public function bukaNotifikasi(Request $request, string $id)
    {
        $notifikasi = $request->user()->tandaiNotifikasiDibaca($id);

        if (!$notifikasi) {
            return response()->json([
                'success' => false,
                'message' => 'Notifikasi tidak ditemukan.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Notifikasi ditandai sudah dibaca.',
            'data' => [
                'tautan' => $notifikasi->data['tautan'] ?? null,
                'notifikasi' => $this->formatNotifikasi($notifikasi),
            ],
        ]);
    }

    /**
     * POST /notifikasi/tandai-semua-dibaca
     * SD: tandaiSemuaDibaca() → Player.tandaiSemuaDibaca() → User.tandaiSemuaNotifikasiDibaca().
     */
    public function tandaiSemuaDibaca(Request $request)
    {
        $jumlahNotifikasiDitandai = $request->user()->player->tandaiSemuaDibaca();

        return response()->json([
            'success' => true,
            'message' => $jumlahNotifikasiDitandai > 0
                ? 'Semua notifikasi ditandai sudah dibaca.'
                : 'Tidak ada notifikasi yang belum dibaca.',
            'data' => [
                'jumlah_ditandai' => $jumlahNotifikasiDitandai,
                'ada_belum_dibaca' => false,
            ],
        ]);
    }

    // ==========================================
    // HELPER
    // ==========================================

    private function formatNotifikasi(Notification $n): array
    {
        $data = $n->data ?? [];

        return [
            'id' => $n->id,
            'jenis' => $n->type,
            'judul' => $data['judul'] ?? null,
            'pesan' => $data['pesan'] ?? null,
            'pengirim' => $data['pengirim'] ?? null,
            'terkait' => $data['terkait'] ?? null,
            'tautan' => $data['tautan'] ?? null,
            'sudah_dibaca' => $n->read_at !== null,
            'dibaca_pada' => $n->read_at?->toIso8601String(),
            'dibuat_pada' => $n->created_at?->toIso8601String(),
            'kelompok' => $n->kelompokWaktu(),
        ];
    }
}