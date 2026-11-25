<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Pengumuman;
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
        // R10.13: label Diterima/Ditolak (maks. 2 query untuk satu halaman)
        $statusTanggapan = Notification::statusTanggapan($daftarNotifikasi->items());

        return response()->json([
            'success' => true,
            'message' => $daftarNotifikasi->isEmpty() && $daftarNotifikasi->onFirstPage()
                ? 'Belum ada notifikasi.'
                : 'Daftar notifikasi berhasil ditampilkan.',
            'data' => [
                'notifikasi' => collect($daftarNotifikasi->items())
                    ->map(fn (Notification $n) => $this->formatNotifikasi($n, null, $statusTanggapan[$n->id] ?? null))
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
                                'notifikasi' => $this->formatNotifikasi(
                    $notifikasi,
                    $this->keteranganSaatDibuka($notifikasi),
                    Notification::statusTanggapan([$notifikasi])[$notifikasi->id] ?? null
                ),
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

     /**
  * PB-31 (R10.06): pengumuman yang sudah dihapus tetap bisa dibuka notifikasinya,
  * tetapi menampilkan informasi bahwa pengumuman sudah dihapus.
  */
    private function keteranganSaatDibuka(Notification $n): ?string
    {
        if ($n->type === Notification::JENIS_PENGUMUMAN_BARU
            && !Pengumuman::whereKey($n->data['id_pengumuman'] ?? 0)->exists()) {
            return 'Pengumuman ini sudah dihapus oleh Penyelenggara.';
        }

        return null;
    }

    private function formatNotifikasi(Notification $n, ?string $keterangan = null, ?string $statusTanggapan = null): array
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
            'keterangan' => $keterangan,
            'status_tanggapan' => $statusTanggapan,
        ];
    }
}