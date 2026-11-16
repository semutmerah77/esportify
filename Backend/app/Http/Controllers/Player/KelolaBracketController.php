<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\BabakTurnamen;
use App\Models\BracketTurnamen;
use App\Models\Pertandingan;
use App\Models\Turnamen;
use App\Services\BracketService;
use App\Services\PendaftaranTurnamenService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Sisi Penyelenggara: kelola bracket (PB-13, PB-18, PB-19).
 * Bracket draft dibentuk otomatis dari pendaftaran yang diterima
 * (BracketService::sinkronkanBracket), tanpa tombol Bentuk Bracket.
 */
class KelolaBracketController extends Controller
{
    public function __construct(
        private BracketService $bracket,
        private PendaftaranTurnamenService $pendaftaran
    ) {
    }

    /**
     * GET /turnamen-kelolaan/{id}/bracket
     * Tab Bracket. Bracket draft disesuaikan dengan peserta diterima terbaru.
     */
    public function show(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $bracket = DB::transaction(fn () => $this->bracket->sinkronkanBracket($turnamen));

        return response()->json([
            'success' => true,
            'message' => $bracket
                ? 'Bracket berhasil diambil.'
                : 'Bracket belum terbentuk.',
            'data' => $this->respon($turnamen, $bracket),
        ]);
    }

    /**
     * POST /turnamen-kelolaan/{id}/bracket/acak (US45)
     * Boleh selama draft, termasuk saat pendaftaran masih dibuka dan grace period.
     */
    public function acak(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $hasil = DB::transaction(function () use ($turnamen) {
            $bracket = $this->bracket->sinkronkanBracket($turnamen);

            if (!$bracket) {
                return ['error' => 'Bracket belum terbentuk karena belum ada pendaftaran yang diterima.'];
            }

            if (!$bracket->isDraft()) {
                return ['error' => 'Bracket sudah dipublikasikan dan tidak dapat diacak ulang.'];
            }

            $this->bracket->acak($bracket);

            return ['bracket' => $bracket->fresh()];
        });

        if (isset($hasil['error'])) {
            return $this->gagal($hasil['error']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Posisi Squad pada bracket berhasil diacak.',
            'data' => $this->respon($turnamen, $hasil['bracket']),
        ]);
    }

    /**
     * POST /turnamen-kelolaan/{id}/bracket/publikasi (US46)
     * Publikasi manual: boleh kapan saja setelah syarat terpenuhi,
     * termasuk sebelum jadwal_main dan selama grace period.
     */
    public function publikasi(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $hasil = DB::transaction(function () use ($turnamen) {
            $bracket = $this->bracket->sinkronkanBracket($turnamen);
            $turnamen->refresh();

            if ($alasan = $this->bracket->alasanTidakBisaDipublikasikan($turnamen, $bracket)) {
                return ['error' => $alasan];
            }

            $this->bracket->publikasikan($bracket);

            // Jadwal main sudah tiba → langsung berlangsung.
            $dimulai = $this->bracket->terapkanBerlangsung($turnamen);

            return ['bracket' => $bracket->fresh(), 'dimulai' => $dimulai];
        });

        if (isset($hasil['error'])) {
            return $this->gagal($hasil['error']);
        }

        return response()->json([
            'success' => true,
            'message' => $hasil['dimulai']
                ? 'Bracket berhasil dipublikasikan. Turnamen kini berlangsung.'
                : 'Bracket berhasil dipublikasikan.',
            'data' => $this->respon($turnamen->fresh('pengajuan'), $hasil['bracket']),
        ]);
    }

    /**
     * PUT /turnamen-kelolaan/{id}/bracket/babak/{idBabak}
     * AD Edit Babak: Judul Babak (maks 30) dan Jam (HH:MM, 24 jam WIB).
     */
    public function ubahBabak(Request $request, $id, $idBabak)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        if ($turnamen->status === 'selesai') {
            return $this->gagal('Turnamen sudah selesai.');
        }

        $validator = Validator::make($request->all(), [
            'nama_babak' => ['required', 'string', 'max:30'],
            'waktu_mulai' => ['nullable', 'date_format:H:i'],
        ], [
            'nama_babak.required' => 'Judul babak wajib diisi.',
            'nama_babak.max' => 'Judul babak maksimal 30 karakter.',
            'waktu_mulai.date_format' => 'Format jam tidak valid. Gunakan format 24 jam (HH:MM).',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $babak = BabakTurnamen::whereKey($idBabak)
            ->whereHas('bracket', fn ($q) => $q->where('id_turnamen', $turnamen->id_turnamen))
            ->first();

        if (!$babak) {
            return response()->json([
                'success' => false,
                'message' => 'Babak tidak ditemukan.',
            ], 404);
        }

        $babak->update([
            'nama_babak' => trim($request->input('nama_babak')),
            // Disimpan sebagai TIME "HH:MM:SS"
            'waktu_mulai' => $request->filled('waktu_mulai') ? $request->input('waktu_mulai') . ':00' : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Babak berhasil diperbarui.',
            'data' => $this->respon($turnamen, $babak->bracket),
        ]);
    }

    /**
     * PUT /turnamen-kelolaan/{id}/bracket/deskripsi
     * Bagian "Deskripsi Bracket" pada tab Bracket (tambah/edit).
     */
    public function ubahDeskripsi(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        if ($turnamen->status === 'selesai') {
            return $this->gagal('Turnamen sudah selesai.');
        }

        $validator = Validator::make($request->all(), [
            'deskripsi_bracket' => ['nullable', 'string', 'max:2000'],
        ], [
            'deskripsi_bracket.string' => 'Deskripsi bracket tidak valid.',
            'deskripsi_bracket.max' => 'Deskripsi bracket maksimal 2000 karakter.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $bracket = BracketTurnamen::where('id_turnamen', $turnamen->id_turnamen)->first();
        if (!$bracket) {
            return $this->gagal('Bracket belum dibentuk.');
        }

        $deskripsi = trim((string) $request->input('deskripsi_bracket', ''));

        $bracket->update([
            'deskripsi_bracket' => $deskripsi === '' ? null : $deskripsi,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Deskripsi bracket berhasil disimpan.',
            'data' => $this->respon($turnamen, $bracket),
        ]);
    }

    /**
     * PUT /turnamen-kelolaan/{id}/pertandingan/{idPertandingan}/skor
     * AD Update Bracket: isi skor langsung tanpa bukti (PB-18),
     * termasuk koreksi skor yang sudah ada (PB-19).
     */
    public function updateSkor(Request $request, $id, $idPertandingan)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $validator = Validator::make($request->all(), [
            'skor_a' => ['required', 'integer', 'min:0', 'max:999'],
            'skor_b' => ['required', 'integer', 'min:0', 'max:999'],
        ], [
            'skor_a.required' => 'Skor kedua Squad wajib diisi.',
            'skor_b.required' => 'Skor kedua Squad wajib diisi.',
            'skor_a.integer' => 'Skor harus berupa angka.',
            'skor_b.integer' => 'Skor harus berupa angka.',
            'skor_a.min' => 'Skor tidak boleh negatif.',
            'skor_b.min' => 'Skor tidak boleh negatif.',
            'skor_a.max' => 'Skor maksimal 999.',
            'skor_b.max' => 'Skor maksimal 999.',
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

        $hasil = DB::transaction(function () use ($turnamen, $idPertandingan, $skorA, $skorB) {
            $this->kunci($turnamen);

            $pertandingan = Pertandingan::whereKey($idPertandingan)
                ->whereHas('bracket', fn ($q) => $q->where('id_turnamen', $turnamen->id_turnamen))
                ->lockForUpdate()
                ->first();

            if (!$pertandingan) {
                return ['notFound' => true];
            }

            if ($alasan = $this->bracket->alasanTidakBisaUbahSkor($turnamen, $pertandingan)) {
                return ['error' => $alasan];
            }

            $koreksi = $pertandingan->punyaSkor();
            $this->bracket->tetapkanHasil($pertandingan, $skorA, $skorB);

            return ['koreksi' => $koreksi, 'bracket' => $pertandingan->bracket];
        });

        if (isset($hasil['notFound'])) {
            return response()->json([
                'success' => false,
                'message' => 'Pertandingan tidak ditemukan.',
            ], 404);
        }

        if (isset($hasil['error'])) {
            return $this->gagal($hasil['error']);
        }

        return response()->json([
            'success' => true,
            'message' => $hasil['koreksi']
                ? 'Skor pertandingan berhasil dikoreksi. Bracket diperbarui.'
                : 'Skor pertandingan berhasil disimpan. Bracket diperbarui.',
            'data' => $this->respon($turnamen, $hasil['bracket']),
        ]);
    }

    // ==========================================
    // HELPER
    // ==========================================

    private function respon(Turnamen $turnamen, $bracket): array
    {
        $turnamen->loadMissing('pengajuan');

        return [
            'turnamen' => [
                'id_turnamen' => $turnamen->id_turnamen,
                'nama_turnamen' => $turnamen->pengajuan->nama_turnamen,
                'status' => $turnamen->status,
                'jadwal_pendaftaran_tutup' => $turnamen->pengajuan->jadwal_pendaftaran_tutup,
                'jadwal_main' => $turnamen->pengajuan->jadwal_main,
                'jumlah_diterima' => $this->bracket->jumlahDiterima($turnamen),
                // Badge tombol Inbox (laporan hasil menunggu verifikasi)
                'jumlah_laporan_menunggu' => app(\App\Services\LaporanPertandinganService::class)->jumlahMenunggu($turnamen),
            ] + $this->bracket->infoPersiapan($turnamen),
            'alasan_belum_dibentuk' => $bracket
                ? null
                : 'Bracket akan terbentuk otomatis setelah ada pendaftaran yang diterima.',
            'bisa_diacak' => (bool) $bracket?->isDraft(),
            'bracket' => $bracket ? $this->bracket->formatBracket($bracket, null, true) : null,
        ];
    }

    /** Kunci baris turnamen supaya bracket tidak terbentuk dobel. */
    private function kunci(Turnamen $turnamen): void
    {
        $terkunci = Turnamen::whereKey($turnamen->id_turnamen)->lockForUpdate()->first();
        $turnamen->status = $terkunci->status;
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

    private function gagal(string $pesan)
    {
        return response()->json([
            'success' => false,
            'message' => $pesan,
        ], 422);
    }
}
?>