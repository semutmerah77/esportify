<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\LaporanHasilPertandingan;
use App\Models\Pertandingan;
use App\Models\Turnamen;
use App\Services\LaporanPertandinganService;
use App\Services\PendaftaranTurnamenService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Sisi Penyelenggara: Inbox laporan hasil pertandingan (PB-16).
 * Tab Menunggu & Riwayat (R6.31), dikelompokkan per nomor pertandingan (R6.24).
 */
class KelolaLaporanPertandinganController extends Controller
{
    public function __construct(
        private LaporanPertandinganService $laporan,
        private PendaftaranTurnamenService $pendaftaran
    ) {
    }

    /**
     * GET /turnamen-kelolaan/{id}/laporan?tab=menunggu|riwayat
     */
    public function index(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $tab = $request->query('tab') === 'riwayat' ? 'riwayat' : 'menunggu';

        $query = LaporanHasilPertandingan::query()
            ->whereHas('pertandingan.bracket', fn ($q) => $q->where('id_turnamen', $turnamen->id_turnamen))
            ->with(['pertandingan.babak', 'pertandingan.pendaftaranA.squad', 'pertandingan.pendaftaranB.squad',
                'squadPelapor', 'playerPelapor.user', 'bukti']);

        if ($tab === 'menunggu') {
            $query->menunggu()->orderBy('tanggal_laporan');
        } else {
            $query->whereIn('status_laporan', [
                LaporanHasilPertandingan::STATUS_DISETUJUI,
                LaporanHasilPertandingan::STATUS_DITOLAK,
            ])->orderByDesc('tanggal_verifikasi')->orderByDesc('id_laporan');
        }

        $data = $query->get()
            ->groupBy('id_pertandingan')
            ->map(fn ($grup) => [
                'pertandingan' => $this->laporan->formatPertandingan($grup->first()->pertandingan),
                'laporan' => $grup->map(fn ($l) => $this->laporan->formatLaporan($l))->values(),
            ])
            ->sortBy(fn ($g) => $g['pertandingan']['nomor_pertandingan'])
            ->values();

        return response()->json([
            'success' => true,
            'message' => $data->isEmpty()
                ? ($tab === 'menunggu' ? 'Tidak ada laporan yang menunggu verifikasi.' : 'Belum ada riwayat laporan.')
                : 'Daftar laporan berhasil diambil.',
            'data' => $data,
            'meta' => [
                'tab' => $tab,
                'jumlah_menunggu' => $this->laporan->jumlahMenunggu($turnamen),
                'pilihan_alasan_penolakan' => collect(LaporanPertandinganService::ALASAN_PENOLAKAN)
                    ->map(fn ($label, $kode) => ['kode' => $kode, 'label' => $label])
                    ->values(),
            ],
        ]);
    }

    /**
     * GET /turnamen-kelolaan/{id}/laporan/{idLaporan}
     */
    public function show(Request $request, $id, $idLaporan)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $laporan = $this->findLaporan($turnamen, $idLaporan);
        if (!$laporan) {
            return $this->laporanNotFound();
        }

        $alasanSetujui = $this->laporan->alasanTidakBisaDiverifikasi($turnamen, $laporan, true);

        return response()->json([
            'success' => true,
            'message' => 'Detail laporan berhasil diambil.',
            'data' => [
                'pertandingan' => $this->laporan->formatPertandingan($laporan->pertandingan),
                'laporan' => $this->laporan->formatLaporan($laporan),
                'bisa_disetujui' => $alasanSetujui === null,
                'alasan_tidak_bisa_disetujui' => $alasanSetujui,
                'bisa_ditolak' => $this->laporan->alasanTidakBisaDiverifikasi($turnamen, $laporan, false) === null,
            ],
        ]);
    }

    /**
     * POST /turnamen-kelolaan/{id}/laporan/{idLaporan}/setujui (US51)
     */
    public function setujui(Request $request, $id, $idLaporan)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $hasil = DB::transaction(function () use ($turnamen, $idLaporan) {
            $laporan = $this->findLaporan($turnamen, $idLaporan, true);
            if (!$laporan) {
                return ['notFound' => true];
            }

            // Kunci pertandingan supaya persetujuan dua laporan tidak bentrok.
            $pertandingan = Pertandingan::whereKey($laporan->id_pertandingan)->lockForUpdate()->first();
            $pertandingan->load(['bracket', 'pendaftaranA', 'pendaftaranB']);
            $laporan->setRelation('pertandingan', $pertandingan);
            $turnamen->refresh();

            if ($alasan = $this->laporan->alasanTidakBisaDiverifikasi($turnamen, $laporan, true)) {
                return ['error' => $alasan];
            }

            $otomatis = $this->laporan->setujui($laporan, (int) $turnamen->id_penyelenggara);

            return ['laporan' => $laporan->fresh(), 'otomatis' => $otomatis];
        });

        if (isset($hasil['notFound'])) {
            return $this->laporanNotFound();
        }

        if (isset($hasil['error'])) {
            return $this->gagal($hasil['error']);
        }

        $laporan = $hasil['laporan'];

        return response()->json([
            'success' => true,
            'message' => 'Laporan disetujui. Skor diterapkan pada bracket.',
            'data' => [
                'pertandingan' => $this->laporan->formatPertandingan($laporan->pertandingan),
                'laporan' => $this->laporan->formatLaporan($laporan),
                'laporan_lawan_disetujui_otomatis' => $hasil['otomatis']['disetujui'],
                'laporan_lawan_ditolak_otomatis' => $hasil['otomatis']['ditolak'],
            ],
        ]);
    }

    /**
     * POST /turnamen-kelolaan/{id}/laporan/{idLaporan}/tolak (US52)
     * Body: alasan (kode dari pilihan_alasan_penolakan), alasan_lainnya (wajib kalau alasan = lainnya)
     */
    public function tolak(Request $request, $id, $idLaporan)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $validator = Validator::make($request->all(), [
            'alasan' => ['required', Rule::in(array_keys(LaporanPertandinganService::ALASAN_PENOLAKAN))],
            'alasan_lainnya' => ['required_if:alasan,lainnya', 'nullable', 'string', 'max:255'],
        ], [
            'alasan.required' => 'Pilih alasan penolakan.',
            'alasan.in' => 'Alasan penolakan tidak valid.',
            'alasan_lainnya.required_if' => 'Tuliskan alasan penolakan.',
            'alasan_lainnya.max' => 'Alasan penolakan maksimal 255 karakter.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $kode = $request->input('alasan');
        $teks = $kode === 'lainnya'
            ? trim((string) $request->input('alasan_lainnya'))
            : LaporanPertandinganService::ALASAN_PENOLAKAN[$kode];

        if ($teks === '') {
            return $this->gagal('Tuliskan alasan penolakan.');
        }

        $hasil = DB::transaction(function () use ($turnamen, $idLaporan, $teks) {
            $laporan = $this->findLaporan($turnamen, $idLaporan, true);
            if (!$laporan) {
                return ['notFound' => true];
            }

            if ($alasan = $this->laporan->alasanTidakBisaDiverifikasi($turnamen, $laporan, false)) {
                return ['error' => $alasan];
            }

            $this->laporan->tolak($laporan, $teks, (int) $turnamen->id_penyelenggara);

            return ['laporan' => $laporan->fresh()];
        });

        if (isset($hasil['notFound'])) {
            return $this->laporanNotFound();
        }

        if (isset($hasil['error'])) {
            return $this->gagal($hasil['error']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Laporan ditolak. Bracket tidak berubah.',
            'data' => [
                'laporan' => $this->laporan->formatLaporan($hasil['laporan']),
            ],
        ]);
    }

    // ==========================================
    // HELPER
    // ==========================================

    private function findLaporan(Turnamen $turnamen, $idLaporan, bool $lock = false): ?LaporanHasilPertandingan
    {
        $query = LaporanHasilPertandingan::whereKey($idLaporan)
            ->whereHas('pertandingan.bracket', fn ($q) => $q->where('id_turnamen', $turnamen->id_turnamen));

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    /**
     * @return array{0: ?Turnamen, 1: ?\Illuminate\Http\JsonResponse}
     */
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

    private function laporanNotFound()
    {
        return response()->json([
            'success' => false,
            'message' => 'Laporan tidak ditemukan.',
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