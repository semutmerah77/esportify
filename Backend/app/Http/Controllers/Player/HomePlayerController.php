<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\PendaftaranTurnamen;
use App\Models\Player;
use App\Models\Squad;
use App\Models\Turnamen;
use Illuminate\Http\Request;

/**
 * PB-29 — SD Melihat Home Player.
 * Satu request untuk seluruh isi Home: turnamen diikuti, komunitas diikuti,
 * squad player, dan turnamen terbaru (masing-masing maksimal 5).
 * Navigasi "Lihat semua" ditangani Frontend memakai endpoint yang sudah ada.
 */
class HomePlayerController extends Controller
{
    /** GET /home-player */
    public function tampilkanHomePlayer(Request $request)
    {
        // id_player diambil dari session login
        $idPlayer = (int) $request->user()->player->id_player;

        $daftarTurnamenDiikuti = Player::lihatTurnamenDiikuti($idPlayer);
        $daftarKomunitasDiikuti = Player::lihatKomunitasDiikuti($idPlayer);
        $daftarSquadPlayer = Player::lihatSquadSaya($idPlayer);
        $daftarTurnamenTerbaru = Turnamen::getTurnamenTerbaru();

        return response()->json([
            'success' => true,
            'message' => 'Halaman Home Player berhasil ditampilkan.',
            'data' => [
                'turnamen_diikuti' => [
                    'total' => $daftarTurnamenDiikuti['total'],
                    'data' => $daftarTurnamenDiikuti['data']
                        ->map(fn (PendaftaranTurnamen $p) => $this->formatTurnamenDiikuti($p))->values(),
                ],
                'komunitas_diikuti' => [
                    'total' => $daftarKomunitasDiikuti['total'],
                    'data' => $daftarKomunitasDiikuti['data']->values(),
                ],
                'squad_saya' => [
                    'total' => $daftarSquadPlayer['total'],
                    'data' => $daftarSquadPlayer['data']
                        ->map(fn (Squad $s) => $this->formatSquad($s))->values(),
                ],
                'turnamen_terbaru' => [
                    'total' => $daftarTurnamenTerbaru['total'],
                    'data' => $daftarTurnamenTerbaru['data']
                        ->map(fn (Turnamen $t) => $this->formatTurnamenTerbaru($t))->values(),
                ],
            ],
        ]);
    }

    // ==========================================
    // HELPER
    // ==========================================

    private function formatTurnamenDiikuti(PendaftaranTurnamen $p): array
    {
        $turnamen = $p->turnamen;
        $pengajuan = $turnamen?->pengajuan;

        return [
            'id_pendaftaran' => $p->id_pendaftaran,
            'status_pendaftaran' => $p->status_pendaftaran,
            'id_turnamen' => $p->id_turnamen,
            'nama_turnamen' => $pengajuan?->nama_turnamen,
            'poster_url' => $this->fileUrl($pengajuan?->poster),
            'nama_game' => $pengajuan?->game?->nama_game,
            'jadwal_main' => $turnamen?->jadwalMainAktif()?->toIso8601String(),
            'status_turnamen' => $this->statusTurnamen($turnamen?->status),
            'squad' => [
                'id_squad' => $p->id_squad,
                'nama_squad' => $p->squad?->nama_squad,
                'logo_url' => $this->fileUrl($p->squad?->logo_squad),
            ],
        ];
    }

    private function formatSquad(Squad $squad): array
    {
        return [
            'id_squad' => $squad->id_squad,
            'kode_squad' => $squad->kode_squad,
            'nama_squad' => $squad->nama_squad,
            'logo_url' => $this->fileUrl($squad->logo_squad),
        ];
    }

    private function formatTurnamenTerbaru(Turnamen $t): array
    {
        $pengajuan = $t->pengajuan;
        $tutup = $t->jadwalPendaftaranTutupAktif();

        return [
            'id_turnamen' => $t->id_turnamen,
            'nama_turnamen' => $pengajuan?->nama_turnamen,
            'poster_url' => $this->fileUrl($pengajuan?->poster),
            'nama_game' => $pengajuan?->game?->nama_game,
            'tipe_turnamen' => $pengajuan?->tipe_turnamen,
            'slot' => $pengajuan?->slot,
            'total_hadiah' => $pengajuan?->total_hadiah,
            'jenis_biaya' => $pengajuan?->pendanaan?->jenis_biaya,
            'jadwal_pendaftaran_tutup' => $tutup?->toIso8601String(),
            'jadwal_main' => $t->jadwalMainAktif()?->toIso8601String(),
            'pendaftaran_terbuka' => $tutup ? now()->lt($tutup) : true,
            'status_turnamen' => $this->statusTurnamen($t->status),
            'dibuat_pada' => $t->created_at?->toIso8601String(),
        ];
    }

    /** Sama dengan status di daftar & detail turnamen. */
    private function statusTurnamen(?string $status): string
    {
        return in_array($status, ['berlangsung', 'selesai', 'dibatalkan'], true) ? $status : 'pendaftaran';
    }

    private function fileUrl(?string $path): ?string
    {
        return $path ? asset('storage/' . $path) : null;
    }
}