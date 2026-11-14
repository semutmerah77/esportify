<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\AnggotaPendaftaranTurnamen;
use App\Models\PendaftaranTurnamen;
use App\Models\Squad;
use App\Models\Turnamen;
use App\Services\PendaftaranTurnamenService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class PendaftaranTurnamenController extends Controller
{
    public function __construct(
        private PendaftaranTurnamenService $service
    ) {
    }

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
            ->with(['leader', 'anggotaAktif.player.user'])
            ->orderBy('nama_squad')
            ->get();

        $min = $this->service->minRoster($turnamen);
        $maks = $this->service->maksRoster($turnamen);

        $data = $squads->map(function (Squad $squad) use ($turnamen, $player, $min, $maks) {
            $statusAnggota = $this->service->statusAnggotaRoster($turnamen, $squad);
            $alasan = $this->service->alasanSquadTidakBisaDaftar($turnamen, $squad, $player, $statusAnggota);
            $pendaftaranSquad = $this->service->pendaftaranAktifSquad($turnamen, $squad);

            return [
                'id_squad' => $squad->id_squad,
                'kode_squad' => $squad->kode_squad,
                'nama_squad' => $squad->nama_squad,
                'logo_squad' => $squad->logo_squad,
                'logo_url' => $this->fileUrl($squad->logo_squad),
                'is_leader' => $squad->isLeader($player),
                'jumlah_anggota' => $statusAnggota->count(),
                'jumlah_bisa_dipilih' => $statusAnggota->where('bisa_dipilih', true)->count(),
                'min_roster' => $min,
                'maks_roster' => $maks,
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
                'min_roster' => $min,
                'maks_roster' => $maks,
                'jenis_biaya' => $turnamen->pengajuan->pendanaan?->jenis_biaya ?? 'gratis',
                'is_penyelenggara' => $this->service->isPenyelenggara($turnamen, $player),
            ],
        ]);
    }

    /**
     * GET /turnamen/{id}/squad-saya/{idSquad}
     * Halaman 2/2: anggota Squad yang bisa dipilih ke roster.
     */
    public function anggotaRoster(Request $request, $id, $idSquad)
    {
        $player = $request->user()->player;
        if (!$player) {
            return $this->playerNotFound();
        }

        $turnamen = Turnamen::with('pengajuan.pendanaan')->find($id);
        if (!$turnamen || !$turnamen->pengajuan) {
            return $this->turnamenNotFound();
        }

        $squad = Squad::cariDenganKunci($idSquad);
        if (!$squad || $squad->status_squad !== 'aktif' || !$squad->isAnggotaAktif($player)) {
            return $this->squadNotFound();
        }

        $statusAnggota = $this->service->statusAnggotaRoster($turnamen, $squad);
        $alasan = $this->service->alasanSquadTidakBisaDaftar($turnamen, $squad, $player, $statusAnggota);

        $anggota = $statusAnggota
            // Pendaftar paling atas, lalu yang bisa dipilih
            ->sortBy(fn ($a) => [
                $a['id_player'] === (int) $player->id_player ? 0 : 1,
                $a['bisa_dipilih'] ? 0 : 1,
            ])
            ->map(fn ($a) => [
                'id_player' => $a['id_player'],
                'username' => $a['username'],
                'avatar_url' => $this->fileUrl($a['avatar']),
                'peran' => $a['peran'],
                // Pendaftar otomatis masuk roster dan tidak bisa dibatalkan
                'is_pendaftar' => $a['id_player'] === (int) $player->id_player,
                'bisa_dipilih' => $a['bisa_dipilih'],
                'alasan' => $a['alasan'],
            ])
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Daftar anggota Squad berhasil diambil.',
            'data' => [
                'squad' => [
                    'id_squad' => $squad->id_squad,
                    'kode_squad' => $squad->kode_squad,
                    'nama_squad' => $squad->nama_squad,
                    'logo_url' => $this->fileUrl($squad->logo_squad),
                ],
                'min_roster' => $this->service->minRoster($turnamen),
                'maks_roster' => $this->service->maksRoster($turnamen),
                'jumlah_bisa_dipilih' => $statusAnggota->where('bisa_dipilih', true)->count(),
                'bisa_daftar' => $alasan === null,
                'alasan' => $alasan,
                'anggota' => $anggota,
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

        // Dicek sebelum validasi form supaya user tidak diminta upload
        // bukti untuk turnamen yang tidak bisa ia daftari.
        // Tetap dicek ulang di dalam transaksi.
        if ($this->service->isPenyelenggara($turnamen, $player)) {
            return $this->gagal('Penyelenggara tidak dapat mendaftar pada turnamen yang diselenggarakannya.');
        }

        if ($alasan = $this->service->alasanTurnamenTertutup($turnamen)) {
            return $this->gagal($alasan);
        }

        $berbayar = $this->service->isBerbayar($turnamen);

        $rules = [
            'id_squad' => ['required'],
            'roster' => ['required', 'array', 'min:1'],
            'roster.*' => ['integer', 'distinct'],
            'nickname_game' => ['required', 'string', 'max:50'],
            'uid_game' => ['required', 'string', 'max:50'],
        ];
        
        if ($berbayar) {
            $rules['bukti_pembayaran'] = ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:2048'];
            $rules['setuju_ketentuan'] = ['accepted'];
        }

        $validator = Validator::make($request->all(), $rules, [
            'id_squad.required' => 'Pilih Squad yang akan didaftarkan.',
            'roster.required' => 'Pilih pemain yang akan didaftarkan.',
            'roster.array' => 'Format roster tidak valid.',
            'roster.min' => 'Pilih pemain yang akan didaftarkan.',
            'roster.*.integer' => 'Format roster tidak valid.',
            'roster.*.distinct' => 'Pemain di roster tidak boleh dobel.',
            'nickname_game.required' => 'Nickname game wajib diisi.',
            'nickname_game.max' => 'Nickname game maksimal 50 karakter.',
            'uid_game.required' => 'UID game wajib diisi.',
            'uid_game.max' => 'UID game maksimal 50 karakter.',
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

        $roster = collect($request->input('roster', []))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $nickname = trim((string) $request->input('nickname_game'));
        $uidGame = trim((string) $request->input('uid_game'));

        if ($nickname === '' || $uidGame === '') {
            return $this->gagal('Harap isi persyaratan yang diperlukan');
        }

        // File disimpan dulu di luar transaksi, dihapus lagi kalau gagal.
        $pathBukti = $berbayar
            ? $request->file('bukti_pembayaran')->store('bukti-pembayaran', 'local')
            : null;

        try {
            $hasil = DB::transaction(function () use ($turnamen, $squad, $player, $roster, $berbayar, $pathBukti, $nickname, $uidGame) {
                // Kunci baris turnamen agar dua pendaftaran bersamaan
                // tidak bisa sama-sama mengambil slot terakhir.
                Turnamen::whereKey($turnamen->id_turnamen)->lockForUpdate()->first();

                $error = $this->service->validasiPendaftaran($turnamen, $squad, $player,$roster, $uidGame);
                if ($error) {
                    return ['error' => $error];
                }

                $now = now();
                $pendaftaran = PendaftaranTurnamen::create([
                    'id_squad' => $squad->id_squad,
                    'id_turnamen' => $turnamen->id_turnamen,
                    'id_player' => $player->id_player,
                    'nickname_game' => $nickname,
                    'uid_game' => $uidGame,
                    'bukti_pembayaran' => $pathBukti,
                    // Gratis langsung diterima, berbayar menunggu verifikasi.
                    'status_pendaftaran' => $berbayar ? 'menunggu' : 'diterima',
                    'tanggal_daftar' => $now,
                    'tanggal_verifikasi' => $berbayar ? null : $now,
                ]);

                // Roster = pemain yang dipilih pendaftar.
                foreach ($roster as $idPlayer) {
                    AnggotaPendaftaranTurnamen::create([
                        'id_pendaftaran' => $pendaftaran->id_pendaftaran,
                        'id_player' => $idPlayer,
                        'id_turnamen' => $turnamen->id_turnamen,
                        // Roster lock per pemain sejak mendaftar
                        'status_roster' => 'terkunci',
                        'tanggal_penguncian' => $now,
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

            return $this->gagal($hasil['error']);
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
                'status_roster' => $p->statusRoster(),
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
            'status_roster' => $p->statusRoster(),
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
            
            // Akun game perwakilan untuk turnamen ini
            'nickname_game' => $p->nickname_game,
            'uid_game' => $p->uid_game,

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

    private function gagal(string $pesan)
    {
        return response()->json([
            'success' => false,
            'message' => $pesan,
        ], 422);
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