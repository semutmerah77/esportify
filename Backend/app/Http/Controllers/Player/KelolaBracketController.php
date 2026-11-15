<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\BabakTurnamen;
use App\Models\Turnamen;
use App\Services\BracketService;
use App\Services\PendaftaranTurnamenService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Sisi Penyelenggara: kelola bracket (PB-13).
 * Bracket dibentuk otomatis saat tab Bracket dibuka dan syarat terpenuhi.
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
     * Tab Bracket. Membentuk bracket draft kalau belum ada dan syarat terpenuhi.
     */
    public function show(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $bracket = DB::transaction(function () use ($turnamen) {
            $this->kunci($turnamen);

            return $this->bracket->bentukJikaBisa($turnamen);
        });

        return response()->json([
            'success' => true,
            'message' => $bracket
                ? 'Bracket berhasil diambil.'
                : 'Bracket belum dapat dibentuk.',
            'data' => $this->respon($turnamen, $bracket),
        ]);
    }

    /**
     * POST /turnamen-kelolaan/{id}/bracket/acak (US45)
     */
    public function acak(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $hasil = DB::transaction(function () use ($turnamen) {
            $this->kunci($turnamen);

            $bracket = $this->bracket->bentukJikaBisa($turnamen);
            if (!$bracket) {
                return ['error' => $this->bracket->alasanBelumBisaDibentuk($turnamen)];
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
     */
    public function publikasi(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $hasil = DB::transaction(function () use ($turnamen) {
            $this->kunci($turnamen);

            $bracket = $this->bracket->bentukJikaBisa($turnamen);
            if (!$bracket) {
                return ['error' => $this->bracket->alasanBelumBisaDibentuk($turnamen)];
            }

            if (!$bracket->isDraft()) {
                return ['error' => 'Bracket sudah dipublikasikan.'];
            }

            $this->bracket->publikasikan($bracket);

            // Kalau jadwal_main sudah lewat, turnamen langsung berlangsung.
            $dimulai = $this->bracket->mulaiJikaSiap($turnamen);

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
     * AD Edit Babak: Judul Babak dan Jam.
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
            'nama_babak' => ['required', 'string', 'max:50'],
            'waktu_mulai' => ['nullable', 'date'],
        ], [
            'nama_babak.required' => 'Judul babak wajib diisi.',
            'nama_babak.max' => 'Judul babak maksimal 50 karakter.',
            'waktu_mulai.date' => 'Format jam babak tidak valid.',
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
            'waktu_mulai' => $request->input('waktu_mulai'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Babak berhasil diperbarui.',
            'data' => $this->respon($turnamen, $babak->bracket),
        ]);
    }

    // ==========================================
    // HELPER
    // ==========================================

    private function respon(Turnamen $turnamen, $bracket): array
    {
        $alasan = $bracket ? null : $this->bracket->alasanBelumBisaDibentuk($turnamen);

        return [
            'turnamen' => [
                'id_turnamen' => $turnamen->id_turnamen,
                'nama_turnamen' => $turnamen->pengajuan->nama_turnamen,
                'status' => $turnamen->status,
                'jadwal_pendaftaran_tutup' => $turnamen->pengajuan->jadwal_pendaftaran_tutup,
                'jadwal_main' => $turnamen->pengajuan->jadwal_main,
                'pendaftaran_ditutup' => $this->bracket->pendaftaranSudahTutup($turnamen),
                'jumlah_menunggu' => $this->bracket->jumlahMenunggu($turnamen),
                'jumlah_diterima' => $this->bracket->jumlahDiterima($turnamen),
            ],
            'alasan_belum_dibentuk' => $alasan,
            'bisa_diacak' => (bool) $bracket?->isDraft(),
            'bisa_dipublikasikan' => (bool) $bracket?->isDraft(),
            'bracket' => $bracket ? $this->bracket->formatBracket($bracket) : null,
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