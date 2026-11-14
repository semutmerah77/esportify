<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\AnggotaSquad;
use App\Models\PermintaanBergabung;
use App\Models\Squad;
use App\Models\UndanganSquad;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PermintaanBergabungController extends Controller
{
    /**
     * F2-US06 — Mengajukan Permintaan Bergabung
     * POST /squad/{id}/permintaan
     * R1.03, R1.04, R1.07, R2.05
     */
    public function ajukan(Request $request, $id)
    {
        $player = $request->user()->player;

        if (!$player) {
            return $this->gagal('Profil Player tidak ditemukan.', 404);
        }

        $squad = Squad::cariDenganKunci($id);

        if (!$squad || $squad->status_squad !== 'aktif') {
            return $this->gagal('Squad tidak ditemukan.', 404);
        }


        if ($squad->isAnggotaAktif($player)) {
            return $this->gagal('Kamu sudah menjadi anggota Squad ini.', 422);
        }

        $sudahMengajukan = $squad->permintaan()
            ->where('id_player', $player->id_player)
            ->where('status_permintaan', 'menunggu')
            ->exists();

        if ($sudahMengajukan) {
            return $this->gagal('Kamu sudah mengajukan permintaan bergabung ke Squad ini. Tunggu keputusan Leader.', 422);
        }

        $sudahDiundang = $squad->undangan()
            ->where('id_player', $player->id_player)
            ->where('status_undangan', 'menunggu')
            ->exists();

        if ($sudahDiundang) {
            return $this->gagal('Kamu sudah diundang ke Squad ini. Silakan terima undangan di Inbox.', 422);
        }

        if ($squad->isFull()) {
            return $this->gagal('Squad sudah penuh.', 422);
        }

        $permintaan = PermintaanBergabung::create([

            'id_squad' => $squad->id_squad,
            'id_player' => $player->id_player,
            'id_leader_squad' => $squad->leader?->id_leader_squad,
            'status_permintaan' => 'menunggu',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Permintaan bergabung berhasil dikirim.',
            'data' => [
                'id_permintaan' => $permintaan->id_permintaan,
                'id_squad' => $squad->id_squad,
                'kode_squad' => $squad->kode_squad,
                'status_permintaan' => $permintaan->status_permintaan,
                'created_at' => $permintaan->created_at?->toDateTimeString(),
            ],
        ], 201);
    }

    /**
     * F2-US07 — Daftar permintaan bergabung (khusus Leader)
     * GET /squad/{id}/permintaan
     */
    public function index(Request $request, $id)
    {
        [$squad, $error] = $this->squadMilikLeader($request, $id);

        if ($error) {
            return $error;
        }

        $daftar = $squad->permintaan()
            ->where('status_permintaan', 'menunggu')
            ->with('player.user')
            ->oldest()
            ->get()
            ->map(fn (PermintaanBergabung $p) => [
                'id_permintaan' => $p->id_permintaan,
                'id_player' => $p->id_player,
                'username' => $p->player?->user?->username,
                'avatar_url' => $p->player?->avatar ? asset('storage/' . $p->player->avatar) : null,
                'status_permintaan' => $p->status_permintaan,
                'created_at' => $p->created_at?->toDateTimeString(),
            ]);

        return response()->json([
            'success' => true,
            'message' => $daftar->isEmpty()
                ? 'Belum ada permintaan bergabung.'
                : 'Daftar permintaan bergabung berhasil ditampilkan.',
            'data' => $daftar,
        ], 200);
    }

    /**
     * F2-US07 — Menerima permintaan bergabung (khusus Leader)
     * POST /squad/{id}/permintaan/{idPermintaan}/terima
     */
    public function terima(Request $request, $id, $idPermintaan)

    {
        [$squad, $error] = $this->squadMilikLeader($request, $id);

        if ($error) {
            return $error;
        }

        $permintaan = $this->permintaanMenunggu($squad, $idPermintaan);

        if (!$permintaan) {
            return $this->gagal('Permintaan bergabung tidak ditemukan atau sudah diproses.', 404);
        }

        $hasil = DB::transaction(function () use ($squad, $permintaan) {
            $squad = Squad::whereKey($squad->id_squad)->lockForUpdate()->first();

            $sudahAnggota = $squad->anggotaAktif()
                ->where('id_player', $permintaan->id_player)
                ->exists();

            if (!$sudahAnggota) {
                if ($squad->isFull()) {
                    return 'penuh';
                }

                AnggotaSquad::create([
                    'id_squad' => $squad->id_squad,
                    'id_player' => $permintaan->id_player,

                    'tanggal_bergabung' => now(),
                    'status_anggota' => 'aktif',
                ]);
            }

            $permintaan->update([
                'status_permintaan' => 'diterima',
                'tanggal_diproses' => now(),
            ]);

            // Undangan yang masih menunggu untuk Player ini dianggap selesai
            UndanganSquad::where('id_squad', $squad->id_squad)
                ->where('id_player', $permintaan->id_player)
                ->where('status_undangan', 'menunggu')
                ->update(['status_undangan' => 'diterima']);

            return 'ok';
        });

        if ($hasil === 'penuh') {
            return $this->gagal('Squad sudah penuh.', 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Player berhasil menjadi Anggota Squad.',
            'data' => [
                'id_permintaan' => $permintaan->id_permintaan,
                'id_player' => $permintaan->id_player,
                'username' => $permintaan->player?->user?->username,
                'status_permintaan' => 'diterima',
            ],

        ], 200);
    }

    /**
     * F2-US07 — Menolak permintaan bergabung (khusus Leader)
     * POST /squad/{id}/permintaan/{idPermintaan}/tolak
     */
    public function tolak(Request $request, $id, $idPermintaan)
    {
        [$squad, $error] = $this->squadMilikLeader($request, $id);

        if ($error) {
            return $error;
        }

        $permintaan = $this->permintaanMenunggu($squad, $idPermintaan);

        if (!$permintaan) {
            return $this->gagal('Permintaan bergabung tidak ditemukan atau sudah diproses.', 404);
        }

        $permintaan->update([
            'status_permintaan' => 'ditolak',
            'tanggal_diproses' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Permintaan bergabung ditolak.',
            'data' => [
                'id_permintaan' => $permintaan->id_permintaan,
                'id_player' => $permintaan->id_player,

                'status_permintaan' => 'ditolak',
            ],
        ], 200);
    }

    // ==========================================
    // HELPER
    // ==========================================

    /**
     * @return array{0: ?Squad, 1: ?\Illuminate\Http\JsonResponse}
     */
    private function squadMilikLeader(Request $request, $id): array
    {
        $player = $request->user()->player;

        if (!$player) {
            return [null, $this->gagal('Profil Player tidak ditemukan.', 404)];
        }

        $squad = Squad::cariDenganKunci($id);

        if (!$squad || $squad->status_squad !== 'aktif') {
            return [null, $this->gagal('Squad tidak ditemukan.', 404)];
        }

        if (!$squad->isLeader($player)) {
            return [null, $this->gagal('Hanya Leader yang dapat mengelola permintaan bergabung.', 403)];
        }

        return [$squad, null];
    }


    private function permintaanMenunggu(Squad $squad, $idPermintaan): ?PermintaanBergabung
    {
        return $squad->permintaan()
            ->whereKey($idPermintaan)
            ->where('status_permintaan', 'menunggu')
            ->with('player.user')
            ->first();
    }

    private function gagal(string $message, int $status)
    {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], $status);
    }
}
?>