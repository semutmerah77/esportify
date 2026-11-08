<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\AnggotaPendaftaranTurnamen;
use App\Models\PendaftaranTurnamen;
use App\Models\Squad;
use App\Models\Turnamen;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class PendaftaranTurnamenController extends Controller
{
    /**
     * GET /turnamen/{id}/squad-saya
     * Daftar Squad milik Player yang bisa dipilih untuk mendaftar (US20).
     */
    public function squadSaya(Request $request, $id)
    {
        $player = $request->user()->player;
        if (!$player) {
            return $this->playerNotFound();
        }

        $turnamen = Turnamen::with('pengajuan.pendanaan')->find($id);
        if (!$turnamen || !$turnamen->pengajuan) {
            return $this->turnamenNotFound();
        }

        $squads = Squad::aktif()
            ->whereHas('anggotaAktif', fn ($q) => $q->where('id_player', $player->id_player))
            ->with(['leader', 'anggotaAktif'])
            ->orderBy('nama_squad')
            ->get();

        $alasanTurnamen = $this->alasanTurnamenTertutup($turnamen);
        $sudahTerdaftar = $this->pendaftaranAktifPlayer($turnamen->id_turnamen, $player->id_player);
        $min = $this->minAnggota();

        $data = $squads->map(function (Squad $squad) use ($turnamen, $player, $alasanTurnamen, $sudahTerdaftar, $min) {
            $jumlah = $squad->anggotaAktif->count();

            $pendaftaranSquad = PendaftaranTurnamen::aktif()
                ->where('id_turnamen', $turnamen->id_turnamen)
                ->where('id_squad', $squad->id_squad)
                ->first();

            $alasan = ($pendaftaranSquad ? 'Squad sudah terdaftar pada turnamen ini.' : null)
                ?? $alasanTurnamen
                ?? ($sudahTerdaftar ? 'Anda sudah terdaftar pada turnamen ini melalui Squad lain.' : null)
                ?? ($jumlah < $min ? "Jumlah anggota Squad belum memenuhi syarat minimal {$min} anggota." : null);

            return [
                'id_squad' => $squad->id_squad,
                'kode_squad' => $squad->kode_squad,
                'nama_squad' => $squad->nama_squad,
                'logo_squad' => $squad->logo_squad,
                'logo_url' => $this->fileUrl($squad->logo_squad),
                'is_leader' => $squad->isLeader($player),
                'jumlah_anggota' => $jumlah,
                'min_anggota' => $min,
                'id_pendaftaran' => $pendaftaranSquad?->id_pendaftaran,
                'bisa_daftar' => $alasan === null,
                'alasan' => $alasan,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'message' => $data->isEmpty()
                ? 'Gabung ke squad terlebih dahulu untuk melanjutkan proses pendaftaran'
                : 'Daftar Squad berhasil diambil.',
            'data' => $data,
            'meta' => [
                'min_anggota' => $min,
                'jenis_biaya' => $turnamen->pengajuan->pendanaan?->jenis_biaya ?? 'gratis',
            ],
        ]);
    }

    /**
     * POST /turnamen/{id}/daftar
     * Mendaftarkan Squad ke turnamen (US20, US21, US25, US26, US27).
     */
    public function daftar(Request $request, $id)
    {
        $player = $request->user()->player;
        if (!$player) {
            return $this->playerNotFound();
        }

        $turnamen = Turnamen::with(['pengajuan.pendanaan'])->find($id);
        if (!$turnamen || !$turnamen->pengajuan) {
            return $this->turnamenNotFound();
        }

        // Cek turnamen masih buka sebelum validasi form, supaya user
        // tidak diminta upload bukti untuk turnamen yang sudah tutup.
        // Tetap dicek ulang di dalam transaksi.
        if ($alasan = $this->alasanTurnamenTertutup($turnamen)) {
            return response()->json([
                'success' => false,
                'message' => $alasan,
            ], 422);
        }

        $berbayar = $this->isBerbayar($turnamen);

        $rules = ['id_squad' => ['required']];
        if ($berbayar) {
            $rules['bukti_pembayaran'] = ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:2048'];
            $rules['setuju_ketentuan'] = ['accepted'];
        }

        $validator = Validator::make($request->all(), $rules, [
            'id_squad.required' => 'Pilih Squad yang akan didaftarkan.',
            'bukti_pembayaran.required' => 'Harap isi persyaratan yang diperlukan',
            'bukti_pembayaran.file' => 'Bukti pembayaran harus berupa file.',
            'bukti_pembayaran.mimes' => 'Bukti pembayaran harus berformat JPG, JPEG, PNG, atau PDF.',
            'bukti_pembayaran.max' => 'Ukuran bukti pembayaran maksimal 2 MB.',
            'setuju_ketentuan.accepted' => 'Harap isi persyaratan yang diperlukan',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $squad = Squad::cariDenganKunci($request->input('id_squad'));
        if (!$squad) {
            return $this->squadNotFound();
        }

        // File disimpan dulu di luar transaksi, dihapus lagi kalau gagal.
        $pathBukti = $berbayar
            ? $request->file('bukti_pembayaran')->store('bukti-pembayaran', 'local')
            : null;

        try {
            $hasil = DB::transaction(function () use ($turnamen, $squad, $player, $berbayar, $pathBukti) {
                // Kunci baris turnamen agar dua pendaftaran bersamaan
                // tidak bisa sama-sama mengambil slot terakhir.
                Turnamen::whereKey($turnamen->id_turnamen)->lockForUpdate()->first();

                $error = $this->validasiPendaftaran($turnamen, $squad, $player);
                if ($error) {
                    return ['error' => $error];
                }

                $now = now();
                $pendaftaran = PendaftaranTurnamen::create([
                    'id_squad' => $squad->id_squad,
                    'id_turnamen' => $turnamen->id_turnamen,
                    'id_player' => $player->id_player,
                    'bukti_pembayaran' => $pathBukti,
                    // Gratis langsung diterima, berbayar menunggu verifikasi.
                    'status_pendaftaran' => $berbayar ? 'menunggu' : 'diterima',
                    'status_roster' => 'terkunci',
                    'tanggal_daftar' => $now,
                    'tanggal_verifikasi' => $berbayar ? null : $now,
                    'roster_locked_at' => $now,
                ]);

                // Snapshot roster saat mendaftar.
                foreach ($squad->anggotaAktif()->pluck('id_player') as $idPlayer) {
                    AnggotaPendaftaranTurnamen::create([
                        'id_pendaftaran' => $pendaftaran->id_pendaftaran,
                        'id_player' => $idPlayer,
                    ]);
                }

                return ['pendaftaran' => $pendaftaran];
            });
        } catch (\Throwable $e) {
            if ($pathBukti) {
                Storage::disk('local')->delete($pathBukti);
            }
            throw $e;
        }

        if (isset($hasil['error'])) {
            if ($pathBukti) {
                Storage::disk('local')->delete($pathBukti);
            }

            return response()->json([
                'success' => false,
                'message' => $hasil['error'],
            ], 422);
        }

        $pendaftaran = $hasil['pendaftaran'];

        return response()->json([
            'success' => true,
            'message' => $berbayar
                ? 'Pendaftaran berhasil dikirim dan menunggu verifikasi Penyelenggara.'
                : 'Pendaftaran berhasil. Squad terdaftar sebagai peserta turnamen.',
            'data' => $this->formatDetail($pendaftaran, $player),
        ], 201);
    }

    /**
     * GET /pendaftaran-turnamen/{id}
     * Detail pendaftaran untuk anggota Squad (US22, US23, US24).
     */
    public function show(Request $request, $id)
    {
        $player = $request->user()->player;
        if (!$player) {
            return $this->playerNotFound();
        }

        $pendaftaran = PendaftaranTurnamen::find($id);
        if (!$pendaftaran || !$this->bolehMelihat($pendaftaran, $player)) {
            return $this->pendaftaranNotFound();
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail pendaftaran berhasil diambil.',
            'data' => $this->formatDetail($pendaftaran, $player),
        ]);
    }

    /**
     * GET /squad/{id}/pendaftaran-turnamen
     * Riwayat pendaftaran turnamen milik Squad (untuk seluruh anggota).
     */
    public function indexSquad(Request $request, $id)
    {
        $player = $request->user()->player;
        if (!$player) {
            return $this->playerNotFound();
        }

        $squad = Squad::cariDenganKunci($id);
        if (!$squad) {
            return $this->squadNotFound();
        }

        if (!$squad->isAnggotaAktif($player)) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya anggota Squad yang dapat melihat pendaftaran turnamen.',
            ], 403);
        }

        $data = PendaftaranTurnamen::with(['turnamen.pengajuan', 'pendaftar.user'])
            ->where('id_squad', $squad->id_squad)
            ->latest('tanggal_daftar')
            ->get()
            ->map(fn (PendaftaranTurnamen $p) => [
                'id_pendaftaran' => $p->id_pendaftaran,
                'status_pendaftaran' => $p->status_pendaftaran,
                'status_roster' => $p->status_roster,
                'tanggal_daftar' => $p->tanggal_daftar,
                'alasan_penolakan' => $p->alasan_penolakan,
                'turnamen' => [
                    'id_turnamen' => $p->id_turnamen,
                    'nama_turnamen' => $p->turnamen?->pengajuan?->nama_turnamen,
                    'jadwal_main' => $p->turnamen?->pengajuan?->jadwal_main,
                ],
                'pendaftar' => [
                    'id_player' => $p->id_player,
                    'username' => $p->pendaftar?->user?->username,
                ],
            ])->values();

        return response()->json([
            'success' => true,
            'message' => 'Daftar pendaftaran turnamen Squad berhasil diambil.',
            'data' => $data,
        ]);
    }

    /**
     * GET /pendaftaran-turnamen/{id}/bukti-pembayaran
     * File bukti pembayaran (privat, tidak lewat /storage publik).
     */
    public function lihatBukti(Request $request, $id)
    {
        $player = $request->user()->player;
        if (!$player) {
            return $this->playerNotFound();
        }

        $pendaftaran = PendaftaranTurnamen::find($id);
        if (!$pendaftaran || !$this->bolehMelihat($pendaftaran, $player)) {
            return $this->pendaftaranNotFound();
        }

        $path = $pendaftaran->bukti_pembayaran;

        if (!$path || !Storage::disk('local')->exists($path)) {
            return response()->json([
                'success' => false,
                'message' => 'Bukti pembayaran tidak ditemukan.',
            ], 404);
        }

        $response = response()->file(
            Storage::disk('local')->path($path),
            [
                'Content-Type' => Storage::disk('local')->mimeType($path),
                'X-Content-Type-Options' => 'nosniff',
            ]
        );

        // response()->file() default-nya "public", jadi di-set ulang di sini
        // agar bukti pembayaran tidak disimpan di cache browser/proxy.
        $response->headers->set('Cache-Control', 'private, no-store');

        return $response;
    }

    // ==========================================
    // VALIDASI
    // ==========================================

    /**
     * Mengembalikan pesan error pertama, atau null kalau lolos.
     * Dipanggil di dalam transaksi setelah baris turnamen dikunci.
     */
    private function validasiPendaftaran(Turnamen $turnamen, Squad $squad, $player): ?string
    {
        if ($squad->status_squad !== 'aktif') {
            return 'Squad tidak aktif.';
        }

        if (!$squad->isAnggotaAktif($player)) {
            return 'Gabung ke squad terlebih dahulu untuk melanjutkan proses pendaftaran';
        }

        // US25: Squad yang sama tidak boleh mendaftar dua kali
        // (termasuk lewat anggota yang berbeda).
        $squadSudahDaftar = PendaftaranTurnamen::aktif()
            ->where('id_turnamen', $turnamen->id_turnamen)
            ->where('id_squad', $squad->id_squad)
            ->exists();

        if ($squadSudahDaftar) {
            return 'Squad sudah terdaftar pada turnamen ini.';
        }

        if ($alasan = $this->alasanTurnamenTertutup($turnamen)) {
            return $alasan;
        }

        // Pendaftar sendiri sudah ada di roster pendaftaran lain.
        if ($this->pendaftaranAktifPlayer($turnamen->id_turnamen, $player->id_player)) {
            return 'Anda sudah terdaftar pada turnamen ini melalui Squad lain.';
        }

        $roster = $squad->anggotaAktif()->pluck('id_player');

        $min = $this->minAnggota();
        if ($roster->count() < $min) {
            return "Jumlah anggota Squad belum memenuhi syarat minimal {$min} anggota.";
        }

        // US26: tidak ada anggota roster yang sudah terdaftar lewat Squad lain.
        $bentrok = AnggotaPendaftaranTurnamen::with('player.user')
            ->whereIn('id_player', $roster)
            ->whereHas('pendaftaran', fn ($q) => $q->aktif()->where('id_turnamen', $turnamen->id_turnamen))
            ->get();

        if ($bentrok->isNotEmpty()) {
            $nama = $bentrok->map(fn ($a) => $a->player?->user?->username)->filter()->unique()->implode(', ');

            return "Pendaftaran ditolak. Anggota berikut sudah terdaftar pada turnamen ini melalui Squad lain: {$nama}.";
        }

        return null;
    }

    /**
     * Alasan turnamen tidak menerima pendaftaran, atau null kalau masih buka.
     */
    private function alasanTurnamenTertutup(Turnamen $turnamen): ?string
    {
        $pengajuan = $turnamen->pengajuan;

        if ($pengajuan->jadwal_main && now()->gte(Carbon::parse($pengajuan->jadwal_main))) {
            return 'Turnamen tidak sedang membuka pendaftaran.';
        }

        if ($pengajuan->jadwal_pendaftaran_tutup && now()->gte(Carbon::parse($pengajuan->jadwal_pendaftaran_tutup))) {
            return 'Pendaftaran turnamen sudah ditutup.';
        }

        if ($this->sisaSlot($turnamen) <= 0) {
            return 'Slot turnamen sudah penuh.';
        }

        return null;
    }

    // US27: slot dihitung dari pendaftaran menunggu + diterima.
    private function sisaSlot(Turnamen $turnamen): int
    {
        return max(0, (int) $turnamen->pengajuan->slot - $turnamen->slotTerisi());
    }

    /**
     * Pendaftaran aktif (menunggu/diterima) yang roster-nya memuat Player ini.
     */
    private function pendaftaranAktifPlayer(int $idTurnamen, int $idPlayer): ?PendaftaranTurnamen
    {
        return PendaftaranTurnamen::aktif()
            ->where('id_turnamen', $idTurnamen)
            ->whereHas('anggota', fn ($q) => $q->where('id_player', $idPlayer))
            ->first();
    }

    // ==========================================
    // HELPER
    // ==========================================

    /**
     * Boleh melihat: anggota roster pendaftaran atau anggota aktif Squad saat ini.
     */
    private function bolehMelihat(PendaftaranTurnamen $pendaftaran, $player): bool
    {
        if ($pendaftaran->anggota()->where('id_player', $player->id_player)->exists()) {
            return true;
        }

        return (bool) $pendaftaran->squad?->isAnggotaAktif($player);
    }

    private function formatDetail(PendaftaranTurnamen $p, $player): array
    {
        $p->loadMissing([
            'turnamen.pengajuan.pendanaan',
            'turnamen.pengajuan.pembayaran',
            'squad.leader',
            'pendaftar.user',
            'anggota.player.user',
        ]);

        $pengajuan = $p->turnamen?->pengajuan;
        $leaderId = $p->squad?->leader?->id_player;

        return [
            'id_pendaftaran' => $p->id_pendaftaran,
            'status_pendaftaran' => $p->status_pendaftaran,
            'status_roster' => $p->status_roster,
            'tanggal_daftar' => $p->tanggal_daftar,
            'tanggal_verifikasi' => $p->tanggal_verifikasi,
            'alasan_penolakan' => $p->alasan_penolakan,

            'turnamen' => [
                'id_turnamen' => $p->id_turnamen,
                'nama_turnamen' => $pengajuan?->nama_turnamen,
                'jadwal_main' => $pengajuan?->jadwal_main,
                'jenis_biaya' => $pengajuan?->pendanaan?->jenis_biaya ?? 'gratis',
                'biaya_pendaftaran' => $pengajuan?->pendanaan?->biaya_pendaftaran,
            ],

            'squad' => [
                'id_squad' => $p->id_squad,
                'kode_squad' => $p->squad?->kode_squad,
                'nama_squad' => $p->squad?->nama_squad,
                'logo_url' => $this->fileUrl($p->squad?->logo_squad),
            ],

            // US23: siapa anggota yang mendaftarkan
            'pendaftar' => [
                'id_player' => $p->id_player,
                'username' => $p->pendaftar?->user?->username,
                'avatar_url' => $this->fileUrl($p->pendaftar?->avatar),
            ],
            'didaftarkan_oleh_saya' => (int) $p->id_player === (int) $player->id_player,

            'anggota' => $p->anggota->map(fn ($a) => [
                'id_player' => $a->id_player,
                'username' => $a->player?->user?->username,
                'avatar_url' => $this->fileUrl($a->player?->avatar),
                'peran' => (int) $a->id_player === (int) $leaderId ? 'leader' : 'anggota',
            ])->values(),

            // US22: bukti hanya ada untuk turnamen berbayar
            'ada_bukti_pembayaran' => (bool) $p->bukti_pembayaran,
            'bukti_pembayaran_url' => $p->bukti_pembayaran
                ? url("/api/pendaftaran-turnamen/{$p->id_pendaftaran}/bukti-pembayaran")
                : null,
        ];
    }

    private function isBerbayar(Turnamen $turnamen): bool
    {
        return $turnamen->pengajuan?->pendanaan?->jenis_biaya === 'berbayar';
    }

    private function minAnggota(): int
    {
        return (int) config('esportify.min_anggota_turnamen', 5);
    }

    private function fileUrl(?string $path): ?string
    {
        return $path ? asset('storage/' . $path) : null;
    }

    private function playerNotFound()
    {
        return response()->json([
            'success' => false,
            'message' => 'Profil Player tidak ditemukan.',
        ], 404);
    }

    private function squadNotFound()
    {
        return response()->json([
            'success' => false,
            'message' => 'Squad tidak ditemukan.',
        ], 404);
    }

    private function turnamenNotFound()
    {
        return response()->json([
            'success' => false,
            'message' => 'Turnamen tidak ditemukan.',
        ], 404);
    }

    private function pendaftaranNotFound()
    {
        return response()->json([
            'success' => false,
            'message' => 'Pendaftaran tidak ditemukan.',
        ], 404);
    }
}
?>