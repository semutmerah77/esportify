<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\PendaftaranTurnamen;
use App\Models\RefundTurnamen;
use App\Models\Turnamen;
use App\Services\BracketService;
use App\Services\RefundTurnamenService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Sisi Peserta: tab Refund di Turnamen Saya (PB-26).
 * Pendaftar mengisi data refund; anggota squad lain hanya melihat status.
 */
class RefundTurnamenController extends Controller
{
    public function __construct(
        private RefundTurnamenService $refund,
        private BracketService $bracket
    ) {
    }

    /**
     * GET /turnamen/{id}/refund
     */
    public function show(Request $request, $id)
    {
        [$turnamen, $pendaftaran, $error] = $this->turnamenPeserta($request, $id);
        if ($error) {
            return $error;
        }

        $player = $request->user()->player;
        $alasan = $this->refund->alasanTidakTersedia($turnamen);
        $refund = $alasan === null
            ? RefundTurnamen::where('id_pendaftaran', $pendaftaran->id_pendaftaran)->first()
            : null;
        $sayaPendaftar = (int) $pendaftaran->id_player === (int) $player->id_player;

        return response()->json([
            'success' => true,
            'message' => 'Data refund berhasil diambil.',
            'data' => [
                'turnamen' => $this->refund->infoTurnamen($turnamen),
                'tersedia' => $alasan === null,
                'keterangan' => $alasan,
                'rencana_pengembalian_dana' => $alasan === null ? $this->refund->rencanaPengembalianDana($turnamen) : null,
                'saya_pendaftar' => $sayaPendaftar,
                'bisa_isi_data' => $refund !== null && $sayaPendaftar
                    && $refund->status_refund === RefundTurnamen::STATUS_MENUNGGU_DATA,
                'refund' => $refund
                    ? $this->refund->format($refund, $this->refund->nominal($turnamen), $this->prefixFile($turnamen), $sayaPendaftar)
                    : null,
            ],
            'meta' => [
                'pilihan_metode_refund' => collect(RefundTurnamenService::METODE)
                    ->map(fn ($label, $kode) => ['kode' => $kode, 'label' => $label])
                    ->values(),
            ],
        ]);
    }

    /**
     * POST /turnamen/{id}/refund  (multipart/form-data)
     */
    public function store(Request $request, $id)
    {
        [$turnamen, $pendaftaran, $error] = $this->turnamenPeserta($request, $id);
        if ($error) {
            return $error;
        }

        if ($alasan = $this->refund->alasanTidakTersedia($turnamen)) {
            return $this->gagal($alasan);
        }

        $refund = RefundTurnamen::where('id_pendaftaran', $pendaftaran->id_pendaftaran)->first();
        if (!$refund) {
            return response()->json(['success' => false, 'message' => 'Data refund tidak ditemukan.'], 404);
        }

        if ((int) $pendaftaran->id_player !== (int) $request->user()->player->id_player) {
            return response()->json([
                'success' => false,
                'message' => 'Data refund hanya dapat diisi oleh player yang mendaftarkan squad.',
            ], 403);
        }

        if ($refund->status_refund !== RefundTurnamen::STATUS_MENUNGGU_DATA) {
            return $this->gagal('Data refund sudah dikirim dan tidak dapat diubah.');
        }

        $validator = Validator::make($request->all(), [
            'metode_refund' => ['required', Rule::in(array_keys(RefundTurnamenService::METODE))],
            'nomor_rekening' => ['required_if:metode_refund,transfer_bank', 'nullable', 'string', 'max:150'],
            'atas_nama' => ['required', 'string', 'max:150'],
            'file_qris' => ['required_if:metode_refund,qris', 'nullable', 'file', 'mimes:jpg,jpeg,png', 'max:2048'],
            'konfirmasi' => ['accepted'],
        ], [
            'metode_refund.required' => 'Pilih metode refund.',
            'metode_refund.in' => 'Metode refund tidak valid.',
            'nomor_rekening.required_if' => 'Nama bank dan nomor rekening wajib diisi.',
            'nomor_rekening.max' => 'Nama bank dan nomor rekening maksimal 150 karakter.',
            'atas_nama.required' => 'Nama pemilik rekening/QRIS wajib diisi.',
            'atas_nama.max' => 'Nama pemilik rekening/QRIS maksimal 150 karakter.',
            'file_qris.required_if' => 'Gambar QRIS wajib diunggah.',
            'file_qris.file' => 'Gambar QRIS tidak valid.',
            'file_qris.mimes' => 'Gambar QRIS harus berformat JPG, JPEG, atau PNG.',
            'file_qris.max' => 'Ukuran gambar QRIS maksimal 2 MB.',
            'konfirmasi.accepted' => 'Centang konfirmasi bahwa data refund sudah benar.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $path = $request->input('metode_refund') === 'qris'
            ? $request->file('file_qris')->store('refund-qris', 'local')
            : null;

        $hasil = DB::transaction(function () use ($refund, $request, $path) {
            $terkunci = RefundTurnamen::lockForUpdate()->find($refund->id_refund);

            // Cek ulang di dalam transaksi (mencegah kirim dobel)
            if ($terkunci->status_refund !== RefundTurnamen::STATUS_MENUNGGU_DATA) {
                return 'Data refund sudah dikirim dan tidak dapat diubah.';
            }

            $this->refund->isiData($terkunci, $request->only(['metode_refund', 'nomor_rekening', 'atas_nama']), $path);

            return $terkunci;
        });

        if (is_string($hasil)) {
            if ($path) {
                Storage::disk('local')->delete($path);
            }

            return $this->gagal($hasil);
        }

        return response()->json([
            'success' => true,
            'message' => 'Data refund berhasil dikirim. Menunggu transfer dari penyelenggara.',
            'data' => $this->refund->format($hasil->fresh(), $this->refund->nominal($turnamen), $this->prefixFile($turnamen), true),
        ], 201);
    }

    /**
     * GET /turnamen/{id}/refund/file/{jenis}   jenis: qris | bukti-transfer
     * QRIS hanya untuk pendaftar; bukti transfer untuk semua peserta squad.
     */
    public function lihatFile(Request $request, $id, $jenis)
    {
        [$turnamen, $pendaftaran, $error] = $this->turnamenPeserta($request, $id);
        if ($error) {
            return $error;
        }

        $refund = RefundTurnamen::where('id_pendaftaran', $pendaftaran->id_pendaftaran)->first();
        $sayaPendaftar = (int) $pendaftaran->id_player === (int) $request->user()->player->id_player;

        $path = match ($jenis) {
            'qris' => $sayaPendaftar ? $refund?->file_qris : null,
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

    /**
     * @return array{0: ?Turnamen, 1: ?PendaftaranTurnamen, 2: ?\Illuminate\Http\JsonResponse}
     */
    private function turnamenPeserta(Request $request, $id): array
    {
        $player = $request->user()->player;
        if (!$player) {
            return [null, null, response()->json(['success' => false, 'message' => 'Profil Player tidak ditemukan.'], 404)];
        }

        $turnamen = Turnamen::with('pengajuan')->find($id);
        if (!$turnamen || !$turnamen->pengajuan) {
            return [null, null, response()->json(['success' => false, 'message' => 'Turnamen tidak ditemukan.'], 404)];
        }

        $pendaftaran = $this->bracket->pendaftaranPesertaPlayer($turnamen, (int) $player->id_player)->first();
        if (!$pendaftaran) {
            return [null, null, response()->json([
                'success' => false,
                'message' => 'Data refund hanya dapat dilihat oleh peserta turnamen ini.',
            ], 403)];
        }

        return [$turnamen, $pendaftaran, null];
    }

    private function prefixFile(Turnamen $turnamen): string
    {
        return "/api/turnamen/{$turnamen->id_turnamen}/refund/file";
    }

    private function gagal(string $pesan)
    {
        return response()->json(['success' => false, 'message' => $pesan], 422);
    }
}
