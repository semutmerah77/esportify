<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\BuktiPembatalanTurnamen;
use App\Models\PengajuanPembatalanTurnamen;
use App\Models\Turnamen;
use App\Services\PembatalanTurnamenService;
use App\Services\PendaftaranTurnamenService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Sisi Penyelenggara: Batalkan Turnamen dari menu titik tiga di Kelola Turnamen
 * (PB-25, US59).
 */
class KelolaPembatalanTurnamenController extends Controller
{
    private const PREFIX_BUKTI = '/api/turnamen-kelolaan/pembatalan';

    public function __construct(
        private PembatalanTurnamenService $pembatalan,
        private PendaftaranTurnamenService $pendaftaran
    ) {
    }

    /**
     * GET /turnamen-kelolaan/{id}/pembatalan
     * Data untuk membuka form + riwayat pengajuan pembatalan turnamen ini.
     */
    public function index(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $alasan = $this->pembatalan->alasanTidakBisaAjukan($turnamen);
        $berbayar = $this->pembatalan->berbayar($turnamen);

        $riwayat = PengajuanPembatalanTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->orderByDesc('tanggal_pengajuan')
            ->orderByDesc('id_pengajuan_pembatalan')
            ->get()
            ->map(fn ($p) => $this->pembatalan->format($p, self::PREFIX_BUKTI))
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Data pembatalan turnamen berhasil diambil.',
            'data' => [
                'turnamen' => [
                    'id_turnamen' => $turnamen->id_turnamen,
                    'nama_turnamen' => $turnamen->pengajuan->nama_turnamen,
                    'status' => $turnamen->status,
                    'jenis_biaya' => $berbayar ? 'berbayar' : 'gratis',
                ],
                'bisa_ajukan' => $alasan === null,
                'alasan_tidak_bisa_ajukan' => $alasan,
                'pengajuan_menunggu' => $riwayat->firstWhere('status_pengajuan', PengajuanPembatalanTurnamen::STATUS_MENUNGGU),
                'riwayat' => $riwayat,
            ],
            'meta' => [
                'pilihan_alasan_pembatalan' => collect(PembatalanTurnamenService::ALASAN_PEMBATALAN)
                    ->map(fn ($label, $kode) => [
                        'kode' => $kode,
                        'label' => $label,
                        'wajib_bukti' => in_array($kode, PembatalanTurnamenService::WAJIB_BUKTI, true),
                    ])->values(),
                'wajib_rencana_pengembalian_dana' => $berbayar,
                'rencana_pengembalian_dana_paling_cepat' => now()->addDay()->toDateString(),
            ],
        ]);
    }

    /**
     * POST /turnamen-kelolaan/{id}/pembatalan  (multipart/form-data)
     */
    public function store(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        if ($alasan = $this->pembatalan->alasanTidakBisaAjukan($turnamen)) {
            return $this->gagal($alasan);
        }

        $berbayar = $this->pembatalan->berbayar($turnamen);

        $validator = Validator::make($request->all(), [
            'alasan_pembatalan' => ['required', Rule::in(array_keys(PembatalanTurnamenService::ALASAN_PEMBATALAN))],
            'penjelasan_pembatalan' => ['required', 'string', 'max:2000'],
            'rencana_pengembalian_dana' => $berbayar
                ? ['required', 'date_format:Y-m-d', 'after_or_equal:' . now()->addDay()->toDateString()]
                : ['nullable'],
            'bukti' => [
                Rule::requiredIf(in_array($request->input('alasan_pembatalan'), PembatalanTurnamenService::WAJIB_BUKTI, true)),
                'array',
            ],
            'bukti.*' => ['file', 'mimes:jpg,jpeg,png,pdf', 'max:2048'],
            'konfirmasi' => ['accepted'],
        ], [
            'alasan_pembatalan.required' => 'Pilih alasan pembatalan.',
            'alasan_pembatalan.in' => 'Alasan pembatalan tidak valid.',
            'penjelasan_pembatalan.required' => 'Penjelasan detail wajib diisi.',
            'penjelasan_pembatalan.max' => 'Penjelasan detail maksimal 2000 karakter.',
            'rencana_pengembalian_dana.required' => 'Rencana tanggal pengembalian dana wajib diisi untuk turnamen berbayar.',
            'rencana_pengembalian_dana.date_format' => 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.',
            'rencana_pengembalian_dana.after_or_equal' => 'Rencana pengembalian dana paling cepat besok.',
            'bukti.required' => 'Bukti pendukung wajib diunggah untuk alasan ini.',
            'bukti.*.mimes' => 'Bukti pendukung harus berformat JPG, JPEG, PNG, atau PDF.',
            'bukti.*.max' => 'Ukuran setiap bukti pendukung maksimal 2 MB.',
            'konfirmasi.accepted' => 'Centang konfirmasi pembatalan terlebih dahulu.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $paths = collect($request->file('bukti', []))
            ->map(fn ($file) => $file->store('bukti-pembatalan', 'local'))
            ->all();

        $hasil = DB::transaction(function () use ($turnamen, $request, $paths) {
            $terkunci = Turnamen::with('pengajuan')->lockForUpdate()->find($turnamen->id_turnamen);

            // Cek ulang di dalam transaksi (mencegah dua pengajuan bersamaan)
            if ($alasan = $this->pembatalan->alasanTidakBisaAjukan($terkunci)) {
                return $alasan;
            }

            return $this->pembatalan->ajukan(
                $terkunci,
                $request->input('alasan_pembatalan'),
                trim((string) $request->input('penjelasan_pembatalan')),
                $request->input('rencana_pengembalian_dana'),
                $paths
            );
        });

        if (is_string($hasil)) {
            Storage::disk('local')->delete($paths);

            return $this->gagal($hasil);
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan pembatalan berhasil dikirim dan menunggu verifikasi Admin.',
            'data' => $this->pembatalan->format($hasil->fresh(), self::PREFIX_BUKTI),
        ], 201);
    }

    /**
     * GET /turnamen-kelolaan/pembatalan/{idPengajuan}/bukti/{idBukti}
     */
    public function lihatBukti(Request $request, $idPengajuan, $idBukti)
    {
        $player = $request->user()->player;
        $bukti = BuktiPembatalanTurnamen::where('id_bukti_pembatalan', $idBukti)
            ->where('id_pengajuan_pembatalan', $idPengajuan)
            ->with('pengajuan.turnamen')
            ->first();

        $turnamen = $bukti?->pengajuan?->turnamen;
        if (!$player || !$turnamen || !$this->pendaftaran->isPenyelenggara($turnamen, $player)
            || !Storage::disk('local')->exists($bukti->file_bukti_pendukung)) {
            return response()->json(['success' => false, 'message' => 'Bukti tidak ditemukan.'], 404);
        }

        return Storage::disk('local')->response($bukti->file_bukti_pendukung, null, [
            'Cache-Control' => 'private, no-store',
        ]);
    }

    // ==========================================
    // HELPER
    // ==========================================

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
