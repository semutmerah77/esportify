<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\BuktiPertandingan;
use App\Models\LaporanHasilPertandingan;
use App\Models\Pertandingan;
use App\Models\Turnamen;
use App\Services\LaporanPertandinganService;
use App\Services\PendaftaranTurnamenService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

/**
 * Sisi anggota Squad: lapor hasil + bukti (PB-15),
 * status laporan & kirim ulang / sanggahan (PB-17).
 */
class LaporanPertandinganController extends Controller
{
    public function __construct(
        private LaporanPertandinganService $laporan,
        private PendaftaranTurnamenService $pendaftaran
    ) {
    }

    /**
     * GET /turnamen/{id}/pertandingan/{idPertandingan}/laporan-saya
     * Dibuka dari tombol laporan di kartu pertandingan (R6.25):
     * status laporan Squad (menunggu / ditolak + alasan) dan data untuk form.
     */
    public function statusSaya(Request $request, $id, $idPertandingan)
    {
        [$turnamen, $pertandingan, $player, $error] = $this->ambil($request, $id, $idPertandingan);
        if ($error) {
            return $error;
        }

        [$pendaftaranSaya, $posisi] = $this->laporan->pendaftaranSaya($pertandingan, $player);
        if (!$pendaftaranSaya) {
            return $this->tolakAkses();
        }

        $terakhir = $this->laporan->laporanTerakhirSquad($pertandingan, $pendaftaranSaya->id_squad);
        $alasan = $this->laporan->alasanTidakBisaLapor($turnamen, $pertandingan, $pendaftaranSaya);

        // Status disetujui tidak ditampilkan (hasil sudah terlihat di bracket).
        $tampil = $terakhir && $terakhir->status_laporan !== LaporanHasilPertandingan::STATUS_DISETUJUI;

        return response()->json([
            'success' => true,
            'message' => 'Status laporan berhasil diambil.',
            'data' => [
                'pertandingan' => $this->laporan->formatPertandingan($pertandingan),
                'squad_saya' => [
                    'id_squad' => $pendaftaranSaya->id_squad,
                    'nama_squad' => $pendaftaranSaya->squad?->nama_squad,
                    'posisi' => $posisi,
                ],
                'laporan' => $tampil ? $this->laporan->formatLaporan($terakhir) : null,
                'jenis_pengiriman' => $this->laporan->jenisPengiriman($pertandingan, $terakhir),
                'bisa_kirim' => $alasan === null,
                'alasan_tidak_bisa_kirim' => $alasan,
            ],
        ]);
    }

    /**
     * POST /turnamen/{id}/pertandingan/{idPertandingan}/laporan   (multipart)
     * Laporan awal, kirim ulang (laporan ditolak), atau sanggahan (hasil sudah ditetapkan).
     * Body: skor_a, skor_b, catatan?, bukti[] (file baru), bukti_lama[] (id bukti laporan sebelumnya yang dipertahankan)
     */
    public function kirim(Request $request, $id, $idPertandingan)
    {
        [$turnamen, $pertandingan, $player, $error] = $this->ambil($request, $id, $idPertandingan);
        if ($error) {
            return $error;
        }

        $validator = Validator::make($request->all(), [
            'skor_a' => ['required', 'integer', 'min:0', 'max:999'],
            'skor_b' => ['required', 'integer', 'min:0', 'max:999'],
            'catatan' => ['nullable', 'string', 'max:1000'],
            'bukti' => ['nullable', 'array'],
            'bukti.*' => ['file', 'mimes:jpg,jpeg,png', 'max:2048'],
            'bukti_lama' => ['nullable', 'array'],
            'bukti_lama.*' => ['integer', 'distinct'],
        ], [
            'skor_a.required' => 'Skor kedua Squad wajib diisi.',
            'skor_b.required' => 'Skor kedua Squad wajib diisi.',
            'skor_a.integer' => 'Skor harus berupa angka.',
            'skor_b.integer' => 'Skor harus berupa angka.',
            'skor_a.min' => 'Skor tidak boleh negatif.',
            'skor_b.min' => 'Skor tidak boleh negatif.',
            'skor_a.max' => 'Skor maksimal 999.',
            'skor_b.max' => 'Skor maksimal 999.',
            'catatan.max' => 'Catatan maksimal 1000 karakter.',
            'bukti.array' => 'Format bukti pertandingan tidak valid.',
            'bukti.*.file' => 'Bukti pertandingan harus berupa file.',
            'bukti.*.uploaded' => 'Bukti pertandingan gagal diunggah. Pastikan ukuran file maksimal 2 MB.',
            'bukti.*.mimes' => 'Bukti pertandingan harus berformat JPG atau PNG.',
            'bukti.*.max' => 'Ukuran setiap bukti pertandingan maksimal 2 MB.',
            'bukti_lama.array' => 'Format bukti tidak valid.',
            'bukti_lama.*.integer' => 'Format bukti tidak valid.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $skorA = (int) $request->input('skor_a');
        $skorB = (int) $request->input('skor_b');

        if ($skorA === $skorB) {
            return $this->gagal('Skor tidak boleh seri. Pertandingan harus memiliki pemenang.');
        }

        $fileBaru = $request->file('bukti', []);
        $idBuktiLama = collect($request->input('bukti_lama', []))->map(fn ($i) => (int) $i)->unique()->values();

        if (count($fileBaru) + $idBuktiLama->count() < 1) {
            return $this->gagal('Unggah minimal satu bukti pertandingan.');
        }

        [$pendaftaranSaya, $posisi] = $this->laporan->pendaftaranSaya($pertandingan, $player);

        // Dicek sebelum file disimpan; dicek ulang di dalam transaksi.
        if ($alasan = $this->laporan->alasanTidakBisaLapor($turnamen, $pertandingan, $pendaftaranSaya)) {
            return $this->gagal($alasan);
        }

        $catatan = trim((string) $request->input('catatan', ''));
        $paths = collect($fileBaru)->map(fn ($f) => $f->store('bukti-pertandingan', 'local'))->all();

        try {
            $hasil = DB::transaction(function () use ($turnamen, $pertandingan, $player, $skorA, $skorB, $catatan, $paths, $idBuktiLama) {
                // Kunci pertandingan: cegah dua laporan menunggu dari Squad yang sama.
                $terkunci = Pertandingan::whereKey($pertandingan->id_pertandingan)->lockForUpdate()->first();
                $terkunci->load(['bracket', 'pendaftaranA.squad', 'pendaftaranB.squad']);
                $turnamen->refresh();

                [$pendaftaranSaya, $posisi] = $this->laporan->pendaftaranSaya($terkunci, $player);

                if ($alasan = $this->laporan->alasanTidakBisaLapor($turnamen, $terkunci, $pendaftaranSaya)) {
                    return ['error' => $alasan];
                }

                // Bukti lama hanya dari laporan Squad sendiri di pertandingan ini.
                $buktiLama = BuktiPertandingan::whereIn('id_bukti', $idBuktiLama)
                    ->whereHas('laporan', fn ($q) => $q->where('id_pertandingan', $terkunci->id_pertandingan)
                        ->where('id_squad_pelapor', $pendaftaranSaya->id_squad))
                    ->get();

                if ($buktiLama->count() !== $idBuktiLama->count()) {
                    return ['error' => 'Bukti sebelumnya tidak ditemukan.'];
                }

                $terakhir = $this->laporan->laporanTerakhirSquad($terkunci, $pendaftaranSaya->id_squad);
                $jenis = $this->laporan->jenisPengiriman($terkunci, $terakhir);

                $laporan = $this->laporan->kirim(
                    $terkunci, $pendaftaranSaya, $posisi, $player, $skorA, $skorB,
                    $catatan === '' ? null : $catatan, $paths, $buktiLama
                );

                return ['laporan' => $laporan, 'jenis' => $jenis];
            });
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($paths);
            throw $e;
        }

        if (isset($hasil['error'])) {
            Storage::disk('local')->delete($paths);

            return $this->gagal($hasil['error']);
        }

        return response()->json([
            'success' => true,
            'message' => match ($hasil['jenis']) {
                'kirim_ulang' => 'Laporan berhasil dikirim ulang dan menunggu verifikasi Penyelenggara.',
                'sanggahan' => 'Sanggahan hasil pertandingan berhasil dikirim dan menunggu verifikasi Penyelenggara.',
                default => 'Laporan hasil pertandingan berhasil dikirim dan menunggu verifikasi Penyelenggara.',
            },
            'data' => [
                'jenis_pengiriman' => $hasil['jenis'],
                'laporan' => $this->laporan->formatLaporan($hasil['laporan']),
            ],
        ], 201);
    }

    /**
     * GET /laporan-pertandingan/{idLaporan}/bukti/{idBukti}
     * File bukti (privat): anggota aktif Squad pelapor dan Penyelenggara turnamen.
     */
    public function lihatBukti(Request $request, $idLaporan, $idBukti)
    {
        $player = $request->user()->player;

        $bukti = BuktiPertandingan::whereKey($idBukti)->where('id_laporan', $idLaporan)
            ->with('laporan.squadPelapor', 'laporan.pertandingan.bracket.turnamen.penyelenggara')
            ->first();

        $laporan = $bukti?->laporan;
        $turnamen = $laporan?->pertandingan?->bracket?->turnamen;

        $boleh = $player && $laporan && $turnamen && (
            $this->pendaftaran->isPenyelenggara($turnamen, $player)
            || (bool) $laporan->squadPelapor?->isAnggotaAktif($player)
        );

        if (!$boleh || !Storage::disk('local')->exists($bukti->file_bukti)) {
            return response()->json([
                'success' => false,
                'message' => 'Bukti pertandingan tidak ditemukan.',
            ], 404);
        }

        $response = response()->file(
            Storage::disk('local')->path($bukti->file_bukti),
            [
                'Content-Type' => Storage::disk('local')->mimeType($bukti->file_bukti),
                'X-Content-Type-Options' => 'nosniff',
            ]
        );

        $response->headers->set('Cache-Control', 'private, no-store');

        return $response;
    }

    // ==========================================
    // HELPER
    // ==========================================

    /**
     * @return array{0: ?Turnamen, 1: ?Pertandingan, 2: mixed, 3: ?\Illuminate\Http\JsonResponse}
     */
    private function ambil(Request $request, $id, $idPertandingan): array
    {
        $player = $request->user()->player;
        if (!$player) {
            return [null, null, null, response()->json([
                'success' => false,
                'message' => 'Profil Player tidak ditemukan.',
            ], 404)];
        }

        $turnamen = Turnamen::with('pengajuan')->find($id);

        $pertandingan = $turnamen
            ? Pertandingan::whereKey($idPertandingan)
                ->whereHas('bracket', fn ($q) => $q->where('id_turnamen', $turnamen->id_turnamen))
                ->with(['bracket', 'pendaftaranA.squad', 'pendaftaranB.squad'])
                ->first()
            : null;

        if (!$pertandingan) {
            return [null, null, null, response()->json([
                'success' => false,
                'message' => 'Pertandingan tidak ditemukan.',
            ], 404)];
        }

        return [$turnamen, $pertandingan, $player, null];
    }

    private function tolakAkses()
    {
        return response()->json([
            'success' => false,
            'message' => 'Anda hanya dapat melaporkan pertandingan yang diikuti Squad Anda.',
        ], 403);
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