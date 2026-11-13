<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\AnggotaSquad;
use App\Models\PermintaanBergabung;
use App\Models\Player;
use App\Models\Squad;
use App\Models\UndanganSquad;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UndanganSquadController extends Controller
{
    /**
     * F2-US08 — Mengundang Player ke Squad (khusus Leader)
     * POST /squad/{id}/undangan   body: id_player
     * R1.04, R1.08, R1.09, R2.05
     */
    public function kirim(Request $request, $id)
    {
        $leaderPlayer = $request->user()->player;

        if (!$leaderPlayer) {
            return $this->gagal('Profil Player tidak ditemukan.', 404);
        }

        $squad = Squad::cariDenganKunci($id);

        if (!$squad || $squad->status_squad !== 'aktif') {
            return $this->gagal('Squad tidak ditemukan.', 404);

        }

        if (!$squad->isLeader($leaderPlayer)) {
            return $this->gagal('Hanya Leader yang dapat mengundang Player.', 403);
        }

        $validated = $request->validate([
            'id_player' => ['required', 'integer'],
        ], [
            'id_player.required' => 'Player yang diundang wajib dipilih.',
            'id_player.integer' => 'Player yang diundang tidak valid.',
        ]);

        $target = Player::with('user')->find($validated['id_player']);

        if (!$target || $target->user?->status !== 'aktif') {
            return $this->gagal('Player tidak ditemukan.', 404);
        }

        if ((int) $target->id_player === (int) $leaderPlayer->id_player
            || $squad->isAnggotaAktif($target)) {
            return $this->gagal('Player sudah menjadi anggota Squad ini.', 422);
        }

        $sudahDiundang = $squad->undangan()
            ->where('id_player', $target->id_player)
            ->where('status_undangan', 'menunggu')
            ->exists();

        if ($sudahDiundang) {
            return $this->gagal('Player ini sudah diundang dan belum menanggapi undangan.', 422);
        }


        $sudahMengajukan = $squad->permintaan()
            ->where('id_player', $target->id_player)
            ->where('status_permintaan', 'menunggu')
            ->exists();

        if ($sudahMengajukan) {
            return $this->gagal('Player ini sudah mengajukan permintaan bergabung. Silakan proses di daftar Permintaan.', 422);
        }

        if ($squad->isFull()) {
            return $this->gagal('Squad sudah penuh.', 422);
        }

        $undangan = UndanganSquad::create([
            'id_squad' => $squad->id_squad,
            'id_leader_squad' => $squad->leader?->id_leader_squad,
            'id_player' => $target->id_player,
            'status_undangan' => 'menunggu',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Undangan berhasil dikirim.',
            'data' => [
                'id_undangan' => $undangan->id_undangan,
                'id_squad' => $squad->id_squad,
                'id_player' => $target->id_player,

                'username' => $target->user?->username,
                'status_undangan' => $undangan->status_undangan,
                'created_at' => $undangan->created_at?->toDateTimeString(),
            ],
        ], 201);
    }

    /**
     * Daftar undangan yang masih menunggu dari sebuah Squad (khusus Leader)
     * GET /squad/{id}/undangan
     */
    public function terkirim(Request $request, $id)
    {
        $leaderPlayer = $request->user()->player;

        $squad = Squad::cariDenganKunci($id);

        if (!$squad || $squad->status_squad !== 'aktif') {
            return $this->gagal('Squad tidak ditemukan.', 404);
        }

        if (!$squad->isLeader($leaderPlayer)) {
            return $this->gagal('Hanya Leader yang dapat melihat undangan Squad.', 403);
        }

        $daftar = $squad->undangan()
            ->where('status_undangan', 'menunggu')
            ->with('player.user')
            ->latest()
            ->get()
            ->map(fn (UndanganSquad $u) => [
                'id_undangan' => $u->id_undangan,

                'id_player' => $u->id_player,
                'username' => $u->player?->user?->username,
                'avatar_url' => $u->player?->avatar ? asset('storage/' . $u->player->avatar) : null,
                'status_undangan' => $u->status_undangan,
                'created_at' => $u->created_at?->toDateTimeString(),
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Daftar undangan berhasil ditampilkan.',
            'data' => $daftar,
        ], 200);
    }

    /**
     * F2-US09 — Inbox undangan Player yang sedang login
     * GET /undangan-saya
     */
    public function saya(Request $request)
    {
        $player = $request->user()->player;

        if (!$player) {
            return $this->gagal('Profil Player tidak ditemukan.', 404);
        }

        $daftar = UndanganSquad::where('id_player', $player->id_player)
            ->where('status_undangan', 'menunggu')
            ->whereHas('squad', fn ($q) => $q->where('status_squad', 'aktif'))
            ->with(['squad' => fn ($q) => $q->withCount('anggotaAktif'), 'leader.player.user'])
            ->latest()
            ->get()

            ->map(fn (UndanganSquad $u) => [
                'id_undangan' => $u->id_undangan,
                'status_undangan' => $u->status_undangan,
                'created_at' => $u->created_at?->toDateTimeString(),
                'diundang_oleh' => $u->leader?->player?->user?->username,
                'squad' => [
                    'id_squad' => $u->squad->id_squad,
                    'kode_squad' => $u->squad->kode_squad,
                    'nama_squad' => $u->squad->nama_squad,
                    'logo_url' => $u->squad->logo_squad ? asset('storage/' . $u->squad->logo_squad) : null,
                    'deskripsi' => $u->squad->deskripsi,
                    'jumlah_anggota' => $u->squad->anggota_aktif_count,
                    'maks_anggota' => $u->squad->maks_anggota,
                    'is_full' => $u->squad->anggota_aktif_count >= $u->squad->maks_anggota,
                ],
            ]);

        return response()->json([
            'success' => true,
            'message' => $daftar->isEmpty()
                ? 'Belum ada undangan Squad.'
                : 'Daftar undangan Squad berhasil ditampilkan.',
            'data' => $daftar,
            'meta' => [
                // Untuk simbol biru kecil pada Inbox
                'jumlah_menunggu' => $daftar->count(),
            ],
        ], 200);
    }

    /**
     * F2-US09 — Menerima undangan Squad

     * POST /undangan/{idUndangan}/terima
     * R1.10: jika Squad sudah penuh, tampilkan pemberitahuan dan hapus undangan.
     */
    public function terima(Request $request, $idUndangan)
    {
        $player = $request->user()->player;

        $undangan = $this->undanganMenunggu($player, $idUndangan);

        if (!$undangan) {
            return $this->gagal('Undangan tidak ditemukan atau sudah ditanggapi.', 404);
        }

        $squad = $undangan->squad;

        if (!$squad || $squad->status_squad !== 'aktif') {
            $undangan->delete();

            return $this->gagal('Squad sudah tidak aktif. Undangan dihapus.', 422);
        }

        $hasil = DB::transaction(function () use ($squad, $undangan, $player) {
            $squad = Squad::whereKey($squad->id_squad)->lockForUpdate()->first();

            if (!$squad->isAnggotaAktif($player)) {
                if ($squad->isFull()) {
                    // R1.10
                    $undangan->delete();


                    return 'penuh';
                }

                AnggotaSquad::create([
                    'id_squad' => $squad->id_squad,
                    'id_player' => $player->id_player,
                    'tanggal_bergabung' => now(),
                    'status_anggota' => 'aktif',
                ]);
            }

            $undangan->update(['status_undangan' => 'diterima']);

            // Permintaan bergabung yang masih menunggu ke Squad ini dianggap selesai
            PermintaanBergabung::where('id_squad', $squad->id_squad)
                ->where('id_player', $player->id_player)
                ->where('status_permintaan', 'menunggu')
                ->update([
                    'status_permintaan' => 'diterima',
                    'tanggal_diproses' => now(),
                ]);

            return 'ok';
        });

        if ($hasil === 'penuh') {
            return $this->gagal('Squad sudah penuh. Undangan dihapus.', 422);
        }

        return response()->json([
            'success' => true,

            'message' => 'Kamu berhasil menjadi Anggota Squad.',
            'data' => [
                'id_undangan' => $undangan->id_undangan,
                'status_undangan' => 'diterima',
                'id_squad' => $squad->id_squad,
                'kode_squad' => $squad->kode_squad,
                'nama_squad' => $squad->nama_squad,
            ],
        ], 200);
    }

    /**
     * F2-US09 — Menolak undangan Squad
     * POST /undangan/{idUndangan}/tolak
     */
    public function tolak(Request $request, $idUndangan)
    {
        $player = $request->user()->player;

        $undangan = $this->undanganMenunggu($player, $idUndangan);

        if (!$undangan) {
            return $this->gagal('Undangan tidak ditemukan atau sudah ditanggapi.', 404);
        }

        $undangan->update(['status_undangan' => 'ditolak']);

        return response()->json([
            'success' => true,
            'message' => 'Undangan ditolak.',
            'data' => [
                'id_undangan' => $undangan->id_undangan,

                'status_undangan' => 'ditolak',
            ],
        ], 200);
    }

    // ==========================================
    // HELPER
    // ==========================================

    private function undanganMenunggu($player, $idUndangan): ?UndanganSquad
    {
        if (!$player) {
            return null;
        }

        return UndanganSquad::whereKey($idUndangan)
            ->where('id_player', $player->id_player)
            ->where('status_undangan', 'menunggu')
            ->with('squad')
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