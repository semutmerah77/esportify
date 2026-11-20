<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\Turnamen;
use App\Services\PendaftaranTurnamenService;
use App\Services\PerpanjanganJadwalService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Sisi Penyelenggara: Perpanjang Jadwal di Kelola Turnamen (PB-24).
 */
class KelolaPerpanjanganJadwalController extends Controller
{
    public function __construct(
        private PerpanjanganJadwalService $perpanjangan,
        private PendaftaranTurnamenService $pendaftaran
    ) {
    }

    /**
     * GET /turnamen-kelolaan/{id}/perpanjangan-jadwal
     */
    public function show(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        return response()->json([
            'success' => true,
            'message' => 'Data jadwal turnamen berhasil diambil.',
            'data' => $this->perpanjangan->info($turnamen),
            'meta' => [
                'batas_hari_perpanjangan' => PerpanjanganJadwalService::BATAS_HARI,
                'jarak_minimal_tutup_ke_main_hari' => 1,
                'waktu_server' => now(),
            ],
        ]);
    }

    /**
     * PUT /turnamen-kelolaan/{id}/perpanjangan-jadwal
     * Body: jadwal_pendaftaran_tutup_baru, jadwal_main_baru, konfirmasi
     */
    public function update(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        if ($alasan = $this->perpanjangan->alasanTidakBisa($turnamen)) {
            return $this->gagal($alasan);
        }

        $validator = Validator::make($request->all(), [
            'jadwal_pendaftaran_tutup_baru' => ['required', 'date'],
            'jadwal_main_baru' => ['required', 'date'],
            'konfirmasi' => ['accepted'],
        ], [
            'jadwal_pendaftaran_tutup_baru.required' => 'Jadwal tutup pendaftaran wajib diisi.',
            'jadwal_pendaftaran_tutup_baru.date' => 'Format jadwal tutup pendaftaran tidak valid.',
            'jadwal_main_baru.required' => 'Jadwal main wajib diisi.',
            'jadwal_main_baru.date' => 'Format jadwal main tidak valid.',
            'konfirmasi.accepted' => 'Centang konfirmasi perubahan jadwal terlebih dahulu.',
        ]);

        if ($validator->fails()) {
            return $this->errorValidasi($validator->errors()->toArray());
        }

        // Disamakan ke zona waktu aplikasi (input FE bisa berformat ISO UTC "...Z")
        $tz = config('app.timezone');
        $tutupBaru = Carbon::parse($request->input('jadwal_pendaftaran_tutup_baru'))->setTimezone($tz);
        $mainBaru = Carbon::parse($request->input('jadwal_main_baru'))->setTimezone($tz);

        if ($errors = $this->perpanjangan->validasi($turnamen, $tutupBaru, $mainBaru)) {
            return $this->errorValidasi(array_map(fn ($pesan) => [$pesan], $errors));
        }

        $hasil = DB::transaction(function () use ($turnamen, $tutupBaru, $mainBaru) {
            $terkunci = Turnamen::with('pengajuan')->lockForUpdate()->find($turnamen->id_turnamen);

            // Cek ulang di dalam transaksi
            if ($alasan = $this->perpanjangan->alasanTidakBisa($terkunci)) {
                return $alasan;
            }
            if ($errors = $this->perpanjangan->validasi($terkunci, $tutupBaru, $mainBaru)) {
                return reset($errors);
            }

            return [$terkunci, $this->perpanjangan->terapkan($terkunci, $tutupBaru, $mainBaru)];
        });

        if (is_string($hasil)) {
            return $this->gagal($hasil);
        }

        [$terkunci, $dampak] = $hasil;

        $pesan = 'Jadwal turnamen berhasil diperpanjang.';
        if ($dampak['pendaftaran_dibuka_kembali']) {
            $pesan .= ' Pendaftaran dibuka kembali.';
        }
        if ($dampak['bracket_kembali_draft']) {
            $pesan .= ' Bracket kembali ke draft dan perlu dipublikasikan ulang.';
        }

        return response()->json([
            'success' => true,
            'message' => $pesan,
            'data' => $this->perpanjangan->info($terkunci->fresh('pengajuan')) + ['dampak' => $dampak],
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

    private function errorValidasi(array $errors)
    {
        return response()->json([
            'message' => collect($errors)->flatten()->first(),
            'errors' => $errors,
        ], 422);
    }

    private function gagal(string $pesan)
    {
        return response()->json(['success' => false, 'message' => $pesan], 422);
    }
}
