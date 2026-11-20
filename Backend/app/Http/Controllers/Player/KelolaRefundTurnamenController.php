<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\RefundTurnamen;
use App\Models\Turnamen;
use App\Services\PendaftaranTurnamenService;
use App\Services\RefundTurnamenService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

/**
 * Sisi Penyelenggara: tab Refund di Kelola Turnamen (PB-26).
 * Melihat data refund peserta & mengunggah bukti transfer.
 */
class KelolaRefundTurnamenController extends Controller
{
    public function __construct(
        private RefundTurnamenService $refund,
        private PendaftaranTurnamenService $pendaftaran
    ) {
    }

    /**
     * GET /turnamen-kelolaan/{id}/refund
     */
    public function index(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $alasan = $this->refund->alasanTidakTersedia($turnamen);
        $nominal = $this->refund->nominal($turnamen);
        $daftar = $alasan === null ? $this->refund->daftarUntukPenyelenggara($turnamen) : collect();

        return response()->json([
            'success' => true,
            'message' => $daftar->isEmpty() ? 'Belum ada data refund.' : 'Data refund berhasil diambil.',
            'data' => [
                'turnamen' => $this->refund->infoTurnamen($turnamen),
                'tersedia' => $alasan === null,
                'keterangan' => $alasan,
                'rencana_pengembalian_dana' => $alasan === null ? $this->refund->rencanaPengembalianDana($turnamen) : null,
                'ringkasan' => $this->refund->ringkasan($daftar, $alasan === null ? $nominal : null),
                'refund' => $daftar->map(fn (RefundTurnamen $r) => $this->formatPenyelenggara($turnamen, $r, $nominal))->values(),
            ],
        ]);
    }

    /**
     * POST /turnamen-kelolaan/{id}/refund/{idRefund}/bukti-transfer  (multipart/form-data)
     */
    public function unggahBukti(Request $request, $id, $idRefund)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        if ($alasan = $this->refund->alasanTidakTersedia($turnamen)) {
            return $this->gagal($alasan);
        }

        $refund = $this->refundTurnamen($turnamen, $idRefund);
        if (!$refund) {
            return response()->json(['success' => false, 'message' => 'Data refund tidak ditemukan.'], 404);
        }

        if ($pesan = $this->alasanTidakBisaUnggah($refund)) {
            return $this->gagal($pesan);
        }

        $validator = Validator::make($request->all(), [
            'bukti_transfer' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:2048'],
            'konfirmasi' => ['accepted'],
        ], [
            'bukti_transfer.required' => 'Bukti transfer wajib diunggah.',
            'bukti_transfer.file' => 'Bukti transfer tidak valid.',
            'bukti_transfer.mimes' => 'Bukti transfer harus berformat JPG, JPEG, PNG, atau PDF.',
            'bukti_transfer.max' => 'Ukuran bukti transfer maksimal 2 MB.',
            'konfirmasi.accepted' => 'Centang konfirmasi bahwa dana sudah ditransfer.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $path = $request->file('bukti_transfer')->store('refund-bukti-transfer', 'local');

        $hasil = DB::transaction(function () use ($refund, $path) {
            $terkunci = RefundTurnamen::lockForUpdate()->find($refund->id_refund);

            if ($pesan = $this->alasanTidakBisaUnggah($terkunci)) {
                return $pesan;
            }

            $this->refund->unggahBuktiTransfer($terkunci, $path);

            return $terkunci;
        });

        if (is_string($hasil)) {
            Storage::disk('local')->delete($path);

            return $this->gagal($hasil);
        }

        return response()->json([
            'success' => true,
            'message' => 'Bukti transfer berhasil diunggah. Refund selesai.',
            'data' => $this->formatPenyelenggara($turnamen, $hasil->fresh(), $this->refund->nominal($turnamen)),
        ]);
    }

    /**
     * GET /turnamen-kelolaan/{id}/refund/{idRefund}/file/{jenis}   jenis: qris | bukti-transfer
     */
    public function lihatFile(Request $request, $id, $idRefund, $jenis)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $refund = $this->refundTurnamen($turnamen, $idRefund);
        $path = match ($jenis) {
            'qris' => $refund?->file_qris,
            'bukti-transfer' => $refund?->bukti_transfer,
            default => null,
        };

        if (!$path || !Storage::disk('local')->exists($path)) {
            return response()->json(['success' => false, 'message' => 'File tidak ditemukan.'], 404);
        }

        return Storage::disk('local')->response($path, null, ['Cache-Control' => 'private, no-store']);
    }

    // ==========================================
    // HELPER
    // ==========================================

    private function alasanTidakBisaUnggah(RefundTurnamen $refund): ?string
    {
        return match ($refund->status_refund) {
            RefundTurnamen::STATUS_MENUNGGU_DATA => 'Peserta belum mengirim data refund.',
            RefundTurnamen::STATUS_SELESAI => 'Bukti transfer sudah diunggah dan tidak dapat diubah.',
            default => null,
        };
    }

    private function formatPenyelenggara(Turnamen $turnamen, RefundTurnamen $r, ?float $nominal): array
    {
        return $this->refund->format(
            $r,
            $nominal,
            "/api/turnamen-kelolaan/{$turnamen->id_turnamen}/refund/{$r->id_refund}/file",
            true
        ) + ['bisa_unggah_bukti' => $r->status_refund === RefundTurnamen::STATUS_MENUNGGU_TRANSFER];
    }

    private function refundTurnamen(Turnamen $turnamen, $idRefund): ?RefundTurnamen
    {
        return RefundTurnamen::whereKey($idRefund)
            ->whereHas('pendaftaran', fn ($q) => $q->where('id_turnamen', $turnamen->id_turnamen))
            ->first();
    }

    private function turnamenKelolaan(Request $request, $id): array
    {
        $player = $request->user()->player;
        if (!$player) {
            return [null, response()->json(['success' => false, 'message' => 'Profil Player tidak ditemukan.'], 404)];
        }

        $turnamen = Turnamen::with(['pengajuan', 'penyelenggara'])->find($id);
        if (!$turnamen || !$turnamen->pengajuan) {
            return [null, response()->json(['success' => false, 'message' => 'Turnamen tidak ditemukan.'], 404)];
        }

        if (!$this->pendaftaran->isPenyelenggara($turnamen, $player)) {
            return [null, response()->json(['success' => false, 'message' => 'Anda bukan penyelenggara turnamen ini.'], 403)];
        }

        return [$turnamen, null];
    }

    private function gagal(string $pesan)
    {
        return response()->json(['success' => false, 'message' => $pesan], 422);
    }
}
