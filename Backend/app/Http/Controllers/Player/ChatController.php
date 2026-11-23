<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\BlokirChat;
use App\Models\Percakapan;
use App\Models\Pesan;
use App\Models\Player;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * PB-27 & PB-28 — Chat Player (SD Kirim Pesan, Cari Player dan Kirim Pesan,
 * Hapus Percakapan, Bersihkan Pesan, Blokir Pesan).
 * id_player selalu diambil dari akun yang login, bukan dari request.
 * Pesan masuk diambil FE dengan polling (getPesanTerbaru), tanpa WebSocket.
 */
class ChatController extends Controller
{
    /** GET /chat/percakapan — Membuka Halaman Obrolan */
    public function getDaftarPercakapan(Request $request)
    {
        $idPlayer = $this->idPlayer($request);
        $dataPercakapan = Percakapan::getDaftarPercakapanByPlayer($idPlayer);

        // Pesan terakhir semua percakapan: 1 query
        $pesanTerakhir = Pesan::whereIn('id_pesan', $dataPercakapan->pluck('id_pesan_terakhir')->filter())
            ->get()->keyBy('id_pesan');
        $sayaMemblokir = $this->sayaMemblokir($idPlayer, $dataPercakapan->map(fn ($p) => $p->idLawan($idPlayer)));

        return response()->json([
            'success' => true,
            'message' => $dataPercakapan->isEmpty() ? 'Belum ada percakapan.' : 'Daftar percakapan berhasil ditampilkan.',
            'data' => $dataPercakapan->map(function (Percakapan $p) use ($idPlayer, $pesanTerakhir, $sayaMemblokir) {
                $terakhir = $pesanTerakhir->get($p->id_pesan_terakhir);

                return [
                    'id_percakapan' => $p->id_percakapan,
                    'lawan_bicara' => $this->formatPlayer($p->lawan($idPlayer)),
                    'pesan_terakhir' => $terakhir ? $this->formatPesan($terakhir, $idPlayer) : null,
                    'jumlah_belum_dibaca' => (int) $p->jumlah_belum_dibaca,
                    'saya_memblokir' => $sayaMemblokir->contains($p->idLawan($idPlayer)),
                ];
            })->values(),
        ]);
    }

    /** GET /chat/percakapan/{id} — Membuka Halaman Pesan (?sebelum_id= untuk pesan lebih lama) */
    public function bukaPercakapan(Request $request, $id)
    {
        $idPlayer = $this->idPlayer($request);
        $dataPercakapan = $this->percakapanMilik($id, $idPlayer);

        if (!$dataPercakapan) {
            return $this->percakapanNotFound();
        }

        $sebelumId = ctype_digit((string) $request->query('sebelum_id')) ? (int) $request->query('sebelum_id') : null;

        return $this->halamanPesan($dataPercakapan, $idPlayer, $sebelumId);
    }

    /** POST /chat/player/{idPlayerTujuan} — tombol Kirim Pesan di profil Player (Memulai Percakapan) */
    public function bukaHalamanPesan(Request $request, $idPlayerTujuan)
    {
        $idPengirim = $this->idPlayer($request);
        $tujuan = ctype_digit((string) $idPlayerTujuan) ? Player::getPlayerById((int) $idPlayerTujuan) : null;

        if (!$tujuan) {
            return response()->json(['success' => false, 'message' => 'Player tidak ditemukan.'], 404);
        }

        if ((int) $tujuan->id_player === $idPengirim) {
            return response()->json(['success' => false, 'message' => 'Anda tidak dapat mengirim pesan ke diri sendiri.'], 422);
        }

        $dataPercakapan = Percakapan::cekPercakapan($idPengirim, $tujuan->id_player)
            ?? Percakapan::createPercakapan($idPengirim, $tujuan->id_player);

        return $this->halamanPesan(Percakapan::getDetailPercakapan($dataPercakapan->id_percakapan), $idPengirim);
    }

    /** POST /chat/percakapan/{id}/pesan — Mengirim Pesan */
    public function kirimPesan(Request $request, $id)
    {
        $request->merge(['isi_pesan' => trim((string) $request->input('isi_pesan'))]);
        $request->validate([
            'isi_pesan' => ['required', 'string', 'max:' . Pesan::MAKS_KARAKTER],
        ], [
            'isi_pesan.required' => 'Pesan tidak boleh kosong.',
            'isi_pesan.max' => 'Pesan maksimal ' . Pesan::MAKS_KARAKTER . ' karakter.',
        ]);

        $idPengirim = $this->idPlayer($request);
        $dataPercakapan = $this->percakapanMilik($id, $idPengirim);

        if (!$dataPercakapan) {
            return $this->percakapanNotFound();
        }

        $idTujuan = $dataPercakapan->idLawan($idPengirim);

        // R8.07: blokir berlaku dua arah
        if (BlokirChat::cekStatusBlokir($idPengirim, $idTujuan)?->aktif()) {
            return response()->json(['success' => false, 'message' => 'Buka blokir terlebih dahulu untuk mengirim pesan.'], 422);
        }
        if (BlokirChat::cekStatusBlokir($idTujuan, $idPengirim)?->aktif()) {
            return response()->json(['success' => false, 'message' => 'Anda tidak dapat mengirim pesan ke Player ini.'], 422);
        }

        $dataPesan = Pesan::savePesan($dataPercakapan->id_percakapan, $idPengirim, $request->input('isi_pesan'));

        return response()->json([
            'success' => true,
            'message' => 'Pesan terkirim.',
            'data' => $this->formatPesan($dataPesan->fresh(), $idPengirim),
        ], 201);
    }

    /** GET /chat/percakapan/{id}/pesan-terbaru?waktu_terakhir= — polling selama halaman pesan terbuka */
    public function getPesanTerbaru(Request $request, $id)
    {
        $request->validate(['waktu_terakhir' => ['nullable', 'date']]);

        $idPlayer = $this->idPlayer($request);
        $dataPercakapan = $this->percakapanMilik($id, $idPlayer);

        if (!$dataPercakapan) {
            return $this->percakapanNotFound();
        }

        $waktu = $request->filled('waktu_terakhir')
            ? Carbon::parse($request->query('waktu_terakhir'))->setTimezone(config('app.timezone'))
            : null;

        $dataPesanTerbaru = Pesan::getPesanTerbaru($dataPercakapan->id_percakapan, $idPlayer, $waktu);

        return response()->json([
            'success' => true,
            'message' => 'Pesan terbaru berhasil diambil.',
            'data' => [
                'pesan' => $dataPesanTerbaru->map(fn (Pesan $p) => $this->formatPesan($p, $idPlayer))->values(),
                // Semua pesan saya dengan id <= ini sudah dibaca lawan (indikator Terbaca)
                'id_pesan_terakhir_dibaca' => Pesan::idTerakhirDibacaLawan($dataPercakapan->id_percakapan, $idPlayer),
                'waktu_server' => now()->toIso8601String(),
            ],
        ]);
    }

    /** POST /chat/percakapan/{id}/dibaca — Memperbarui Indikator Dibaca */
    public function tandaiPesanDibaca(Request $request, $id)
    {
        $idPlayer = $this->idPlayer($request);
        $dataPercakapan = $this->percakapanMilik($id, $idPlayer);

        if (!$dataPercakapan) {
            return $this->percakapanNotFound();
        }

        $jumlah = Pesan::tandaiPesanDibaca($dataPercakapan->id_percakapan, $idPlayer);

        return response()->json([
            'success' => true,
            'message' => 'Pesan ditandai sudah dibaca.',
            'data' => ['jumlah_ditandai' => $jumlah],
        ]);
    }

    /** POST /chat/percakapan/{id}/bersihkan — Bersihkan Pesan (hanya di sisi Player ini) */
    public function bersihkanPesan(Request $request, $id)
    {
        $idPlayer = $this->idPlayer($request);
        $dataPercakapan = $this->percakapanMilik($id, $idPlayer);

        if (!$dataPercakapan) {
            return $this->percakapanNotFound();
        }

        Pesan::bersihkanRiwayatPesan($dataPercakapan->id_percakapan, $idPlayer);

        return response()->json([
            'success' => true,
            'message' => 'Riwayat pesan berhasil dibersihkan.',
            'data' => ['id_percakapan' => $dataPercakapan->id_percakapan, 'pesan' => []],
        ]);
    }

    /** DELETE /chat/percakapan/{id} — Hapus Percakapan (hanya dari daftar milik Player ini) */
    public function hapusPercakapan(Request $request, $id)
    {
        $idPlayer = $this->idPlayer($request);
        $dataPercakapan = $this->percakapanMilik($id, $idPlayer);

        if (!$dataPercakapan) {
            return $this->percakapanNotFound();
        }

        Percakapan::hapusDariDaftarPercakapan($dataPercakapan->id_percakapan, $idPlayer);

        return response()->json([
            'success' => true,
            'message' => 'Percakapan berhasil dihapus.',
            'data' => ['id_percakapan' => $dataPercakapan->id_percakapan],
        ]);
    }

    /** POST /chat/blokir/{idPlayerDiblokir} — Blokir Pesan */
    public function blokirPesan(Request $request, $idPlayerDiblokir)
    {
        $idPemblokir = $this->idPlayer($request);
        $target = $this->targetBlokir($idPlayerDiblokir, $idPemblokir);

        if (!$target instanceof Player) {
            return $target;
        }

        DB::transaction(function () use ($idPemblokir, $target) {
            $statusBlokir = BlokirChat::cekStatusBlokir($idPemblokir, $target->id_player);

            if (!$statusBlokir) {
                BlokirChat::createBlokir($idPemblokir, $target->id_player);
            } elseif (!$statusBlokir->aktif()) {
                BlokirChat::updateStatusBlokir($statusBlokir->id_blokir, BlokirChat::STATUS_DIBLOKIR);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Anda memblokir pesan dari Player ini.',
            'data' => ['id_player_diblokir' => $target->id_player, 'saya_memblokir' => true],
        ]);
    }

    /** DELETE /chat/blokir/{idPlayerDiblokir} — Buka Blokir Pesan */
    public function bukaBlokirPesan(Request $request, $idPlayerDiblokir)
    {
        $idPemblokir = $this->idPlayer($request);
        $target = $this->targetBlokir($idPlayerDiblokir, $idPemblokir);

        if (!$target instanceof Player) {
            return $target;
        }

        $statusBlokir = BlokirChat::cekStatusBlokir($idPemblokir, $target->id_player);

        if (!$statusBlokir?->aktif()) {
            return response()->json(['success' => false, 'message' => 'Player ini tidak sedang Anda blokir.'], 422);
        }

        BlokirChat::updateStatusBlokir($statusBlokir->id_blokir, BlokirChat::STATUS_TIDAK_DIBLOKIR);

        return response()->json([
            'success' => true,
            'message' => 'Blokir pesan berhasil dibuka.',
            'data' => ['id_player_diblokir' => $target->id_player, 'saya_memblokir' => false],
        ]);
    }

    // ==========================================
    // HELPER
    // ==========================================

    private function idPlayer(Request $request): int
    {
        return (int) $request->user()->player->id_player;
    }

    /** Hanya 2 peserta yang boleh mengakses percakapan; selain itu dianggap tidak ditemukan. */
    private function percakapanMilik($id, int $idPlayer): ?Percakapan
    {
        $percakapan = ctype_digit((string) $id) ? Percakapan::getDetailPercakapan((int) $id) : null;

        return $percakapan?->milikPlayer($idPlayer) ? $percakapan : null;
    }

    private function halamanPesan(Percakapan $percakapan, int $idPlayer, ?int $sebelumId = null)
    {
        $riwayatPesan = Pesan::getRiwayatPesan($percakapan->id_percakapan, $idPlayer, $sebelumId);
        $idLawan = $percakapan->idLawan($idPlayer);

        return response()->json([
            'success' => true,
            'message' => 'Halaman pesan berhasil ditampilkan.',
            'data' => [
                'id_percakapan' => $percakapan->id_percakapan,
                'lawan_bicara' => $this->formatPlayer($percakapan->lawan($idPlayer)),
                'saya_memblokir' => (bool) BlokirChat::cekStatusBlokir($idPlayer, $idLawan)?->aktif(),
                'pesan' => $riwayatPesan->map(fn (Pesan $p) => $this->formatPesan($p, $idPlayer))->values(),
                'ada_pesan_lebih_lama' => $riwayatPesan->isNotEmpty()
                    && Pesan::where('id_percakapan', $percakapan->id_percakapan)
                        ->where('id_pesan', '<', $riwayatPesan->first()->id_pesan)
                        ->when($percakapan->batasBersihkan($idPlayer), fn ($q, $b) => $q->where('created_at', '>', $b))
                        ->exists(),
                'waktu_server' => now()->toIso8601String(),
            ],
        ]);
    }

    private function targetBlokir($idPlayerDiblokir, int $idPemblokir)
    {
        $target = ctype_digit((string) $idPlayerDiblokir) ? Player::getPlayerById((int) $idPlayerDiblokir) : null;

        if (!$target) {
            return response()->json(['success' => false, 'message' => 'Player tidak ditemukan.'], 404);
        }
        if ((int) $target->id_player === $idPemblokir) {
            return response()->json(['success' => false, 'message' => 'Anda tidak dapat memblokir diri sendiri.'], 422);
        }

        return $target;
    }

    private function sayaMemblokir(int $idPlayer, $idLawan)
    {
        return BlokirChat::where('id_player_pemblokir', $idPlayer)
            ->whereIn('id_player_diblokir', $idLawan->unique()->values())
            ->where('status_blokir', BlokirChat::STATUS_DIBLOKIR)
            ->pluck('id_player_diblokir')
            ->map(fn ($id) => (int) $id);
    }

    private function percakapanNotFound()
    {
        return response()->json(['success' => false, 'message' => 'Percakapan tidak ditemukan.'], 404);
    }

    private function formatPlayer(?Player $player): ?array
    {
        if (!$player) {
            return null;
        }

        return [
            'id_player' => $player->id_player,
            'username' => $player->user?->username,
            'avatar_url' => $player->avatar ? asset('storage/' . $player->avatar) : null,
        ];
    }

    private function formatPesan(Pesan $pesan, int $idPlayer): array
    {
        $milikSaya = (int) $pesan->id_player_pengirim === $idPlayer;

        return [
            'id_pesan' => $pesan->id_pesan,
            'id_percakapan' => $pesan->id_percakapan,
            'id_player_pengirim' => $pesan->id_player_pengirim,
            'isi_pesan' => $pesan->isi_pesan,
            'dikirim_pada' => $pesan->created_at?->toIso8601String(),
            'milik_saya' => $milikSaya,
            // R8.05: hanya indikator Terbaca, untuk pesan milik sendiri
            'terbaca' => $milikSaya && $pesan->dibaca_pada !== null,
        ];
    }
}