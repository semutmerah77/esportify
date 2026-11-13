<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\AnggotaSquad;
use App\Models\LeaderSquad;
use App\Models\Squad;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SquadController extends Controller
{
    /**
     * F2-US05 — Mencari Squad
     * GET /squad?q=<nama atau kode>
     * R1.17: Squad arsip tidak ditampilkan.
     * Pagination diatur FE, BE mengirim semua hasil yang cocok.
     */
    public function index(Request $request)
    {
        $player = $request->user()->player;

        $q = trim((string) $request->query('q', ''));
        $q = ltrim($q, '#');

        $squads = Squad::aktif()
            ->when($q !== '', function ($query) use ($q) {
                $like = '%' . addcslashes($q, '%_\\') . '%';

                $query->where(function ($sub) use ($like) {
                    $sub->where('nama_squad', 'like', $like)
                        ->orWhere('kode_squad', 'like', strtoupper($like));
                });
            })
            ->with('leader')
            ->withCount('anggotaAktif')
            ->orderBy('nama_squad')
            ->get()
            ->map(fn (Squad $squad) => $this->formatSquadRingkas($squad, $player));

        return response()->json([
            'success' => true,
            'message' => $squads->isEmpty()
                ? 'Hasil tidak ditemukan.'
                : 'Daftar Squad berhasil ditampilkan.',
            'data' => $squads,
        ], 200);
    }

    /**
     * F2-US01 (Squad Saya)
     * Daftar Squad aktif yang diikuti Player yang sedang login.
     */
    public function mySquads(Request $request)
    {
        $player = $request->user()->player;

        if (!$player) {
            return $this->playerNotFound();
        }

        $squads = Squad::aktif()
            ->whereHas('anggotaAktif', function ($query) use ($player) {
                $query->where('id_player', $player->id_player);
            })
            ->with('leader')
            ->withCount('anggotaAktif')
            ->latest()
            ->get()
            ->map(fn (Squad $squad) => $this->formatSquadRingkas($squad, $player));

        return response()->json([
            'success' => true,
            'message' => 'Daftar Squad saya berhasil ditampilkan.',
            'data' => $squads,
        ], 200);
    }

    /**
     * F2-US01 — Membuat Squad
     * R1.01: pembuat Squad otomatis menjadi Leader.
     * R1.02: informasi Squad = nama, logo, deskripsi, Squad ID.
     */
    public function store(Request $request)
    {
        $player = $request->user()->player;

        if (!$player) {
            return $this->playerNotFound();
        }

        $validated = $request->validate([
            'nama_squad' => ['required', 'string', 'max:30', 'unique:squad,nama_squad'],
            'logo_squad' => ['required', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],
            'deskripsi' => ['required', 'string', 'max:100'],
        ], $this->pesanValidasi());

        $logoPath = $request->file('logo_squad')->store('squad-logos', 'public');

        try {
                $squad = DB::transaction(function () use ($validated, $player, $logoPath) {
                $squad = Squad::create([
                    'id_player_pembuat' => $player->id_player,
                    'kode_squad' => Squad::generateKode(),
                    'logo_squad' => $logoPath,
                    'nama_squad' => $validated['nama_squad'],
                    'deskripsi' => $validated['deskripsi'],
                    'maks_anggota' => 10,
                    'status_squad' => 'aktif',
                ]);

                // R1.01: pembuat otomatis menjadi Leader
                LeaderSquad::create([
                    'id_player' => $player->id_player,
                    'id_squad' => $squad->id_squad,
                    'tanggal_pengangkatan' => now(),
                ]);

                // Leader juga tercatat sebagai anggota aktif
                AnggotaSquad::create([
                    'id_squad' => $squad->id_squad,
                    'id_player' => $player->id_player,
                    'tanggal_bergabung' => now(),
                    'status_anggota' => 'aktif',
                ]);

                return $squad;
            });
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($logoPath);
            throw $e;
        }

        return response()->json([
            'success' => true,
            'message' => 'Squad kamu berhasil dibuat.',
            'data' => $this->formatSquadDetail($squad->fresh(), $player),
        ], 201);
    }

    /**
     * F2-US02 — Melihat Detail Squad
     */
    public function show(Request $request, $id)
    {
        $player = $request->user()->player;

        $squad = $this->findSquad($id);

        if (!$squad) {
            return $this->squadNotFound();
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail Squad berhasil ditampilkan.',
            'data' => $this->formatSquadDetail($squad, $player),
        ], 200);
    }

    /**
     * F2-US03 — Mengelola Informasi Squad (khusus Leader)
     * Kirim sebagai POST multipart + _method=PUT jika mengganti logo.
     */
    public function update(Request $request, $id)
    {
        $player = $request->user()->player;

        if (!$player) {
            return $this->playerNotFound();
        }

        $squad = $this->findSquad($id);

        if (!$squad || $squad->status_squad !== 'aktif') {
            return $this->squadNotFound();
        }

        if (!$squad->isLeader($player)) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya Leader yang dapat mengubah informasi Squad.',
            ], 403);
        }

        $validated = $request->validate([
            'nama_squad' => [
                'sometimes', 'required', 'string', 'max:30',
                Rule::unique('squad', 'nama_squad')->ignore($squad->id_squad, 'id_squad'),
            ],
            'logo_squad' => ['sometimes', 'required', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],
            'deskripsi' => ['sometimes', 'required', 'string', 'max:100'],
        ], $this->pesanValidasi());

        $data = collect($validated)->only(['nama_squad', 'deskripsi'])->all();

        $oldLogo = $squad->logo_squad;
        $newLogo = null;

        if ($request->hasFile('logo_squad')) {
            $newLogo = $request->file('logo_squad')->store('squad-logos', 'public');
            $data['logo_squad'] = $newLogo;
        }

        if (empty($data)) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak ada perubahan yang dikirim.',
            ], 422);
        }

        try {
            $squad->update($data);
        } catch (\Throwable $e) {
            if ($newLogo) {
                Storage::disk('public')->delete($newLogo);
            }
            throw $e;
        }

        if ($newLogo && $oldLogo) {
            Storage::disk('public')->delete($oldLogo);
        }

        return response()->json([
            'success' => true,
            'message' => 'Perubahan berhasil disimpan.',
            'data' => $this->formatSquadDetail($squad->fresh(), $player),
        ], 200);
    }

    /**
     * F2-US13 — Keluar dari Squad
     * R1.20 / R2.03: hanya bisa keluar ketika roster tidak terkunci.
     * R1.13–R1.15: Leader keluar → anggota aktif paling awal jadi Leader baru (acak jika sama).
     * R1.16: anggota terakhir keluar → Squad diarsipkan.
     */
    public function keluar(Request $request, $id)
    {
        $player = $request->user()->player;

        if (!$player) {
            return $this->playerNotFound();
        }

        $squad = $this->findSquad($id);

        if (!$squad || $squad->status_squad !== 'aktif') {
            return $this->squadNotFound();
        }

        $keanggotaan = $squad->anggotaAktif()
            ->where('id_player', $player->id_player)
            ->first();

        if (!$keanggotaan) {
            return response()->json([
                'success' => false,
                'message' => 'Kamu bukan anggota aktif Squad ini.',
            ], 403);
        }

       // Roster lock per pemain: hanya pemain di roster turnamen yang dikunci.
        if ($terkunci = $squad->pendaftaranTerkunciUntuk($player->id_player)) {
            return response()->json([
                'success' => false,
                'message' => 'Kamu masih terdaftar di roster turnamen '
                    . $terkunci->turnamen?->pengajuan?->nama_turnamen
                    . ' dan baru bisa keluar setelah turnamen selesai.',
            ], 422);
        }

        $hasil = DB::transaction(function () use ($squad, $player, $keanggotaan) {
            // Kunci baris squad agar tidak bentrok dengan proses lain
            $squad = Squad::whereKey($squad->id_squad)->lockForUpdate()->first();
            $squad->load('leader');

            $wasLeader = $squad->isLeader($player);

            $keanggotaan->update(['status_anggota' => 'keluar']);

            $sisa = $squad->anggotaAktif()->with('player.user')->get();

            $leaderBaru = null;

            if ($sisa->isEmpty()) {
                // R1.16: tidak ada anggota lagi → Squad dinonaktifkan
                $squad->update(['status_squad' => 'disable']);

                // Masa jabatan Leader terakhir ikut berakhir
                $squad->gantiLeader(null);
            } elseif ($wasLeader) {
                // R1.13–R1.15: anggota aktif dengan tanggal bergabung paling awal
                $awal = $sisa->min('tanggal_bergabung');

                $leaderBaru = $sisa
                    ->filter(fn (AnggotaSquad $a) => $a->tanggal_bergabung->equalTo($awal))
                    ->random();

                $squad->gantiLeader($leaderBaru->id_player);
            }

            return [
                'squad' => $squad->fresh(),
                'was_leader' => $wasLeader,
                'leader_baru' => $leaderBaru,
            ];
        });

        $squad = $hasil['squad'];
        $leaderBaru = $hasil['leader_baru'];

        if ($squad->status_squad === 'disable') {
            $message = 'Berhasil keluar sebagai anggota Squad. Squad dinonaktifkan karena tidak memiliki anggota lagi.';
        } elseif ($leaderBaru) {
            $message = 'Berhasil keluar sebagai anggota Squad. Kepemimpinan dialihkan kepada '
                . $leaderBaru->player?->user?->username . '.';
        } else {
            $message = 'Berhasil keluar sebagai anggota Squad.';
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => [
                'id_squad' => $squad->id_squad,
                'kode_squad' => $squad->kode_squad,
                'status_squad' => $squad->status_squad,
                'leader_baru' => $leaderBaru ? [
                    'id_player' => $leaderBaru->id_player,
                    'username' => $leaderBaru->player?->user?->username,
                ] : null,
            ],
        ], 200);
    }

    /**
     * F2-US04 — Mengeluarkan Anggota Squad (khusus Leader)
     * R1.21 / R2.04: hanya bisa ketika roster tidak terkunci.
     */
    public function keluarkanAnggota(Request $request, $id, $idPlayer)
    {
        $player = $request->user()->player;

        if (!$player) {
            return $this->playerNotFound();
        }

        $squad = $this->findSquad($id);

        if (!$squad || $squad->status_squad !== 'aktif') {
            return $this->squadNotFound();
        }

        if (!$squad->isLeader($player)) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya Leader yang dapat mengeluarkan anggota.',
            ], 403);
        }

        if ((int) $idPlayer === (int) $player->id_player) {
            return response()->json([
                'success' => false,
                'message' => 'Leader tidak dapat mengeluarkan dirinya sendiri. Gunakan fitur Keluar Squad.',
            ], 422);
        }

        $keanggotaan = $squad->anggotaAktif()
            ->where('id_player', $idPlayer)
            ->first();

        if (!$keanggotaan) {
            return response()->json([
                'success' => false,
                'message' => 'Anggota tidak ditemukan di Squad ini.',
            ], 404);
        }

        // Roster lock per pemain: anggota di roster turnamen tidak bisa dikeluarkan.
        if ($terkunci = $squad->pendaftaranTerkunciUntuk((int) $idPlayer)) {
            $keanggotaan->loadMissing('player.user');

            return response()->json([
                'success' => false,
                'message' => $keanggotaan->player?->user?->username
                    . ' masih terdaftar di roster turnamen '
                    . $terkunci->turnamen?->pengajuan?->nama_turnamen
                    . ' dan baru bisa dikeluarkan setelah turnamen selesai.',
            ], 422);
        }

        $keanggotaan->update(['status_anggota' => 'dikeluarkan']);

        return response()->json([
            'success' => true,
            'message' => 'Anggota berhasil dikeluarkan.',
            'data' => $this->formatSquadDetail($squad->fresh(), $player),
        ], 200);
    }

        /**
     * F2-US10 — Mengalihkan Kepemimpinan Squad (khusus Leader)
     * POST /squad/{id}/leader   body: id_player
     * R1.11: Leader dapat mengalihkan jabatan kepada anggota aktif.
     * Leader lama tetap menjadi anggota biasa.
     */
    public function jadikanLeader(Request $request, $id)
    {
        $player = $request->user()->player;

        if (!$player) {
            return $this->playerNotFound();
        }

        $squad = $this->findSquad($id);

        if (!$squad || $squad->status_squad !== 'aktif') {
            return $this->squadNotFound();
        }

        if (!$squad->isLeader($player)) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya Leader yang dapat mengalihkan kepemimpinan Squad.',
            ], 403);
        }

        $validated = $request->validate([
            'id_player' => ['required', 'integer'],
        ], [
            'id_player.required' => 'Anggota yang akan dijadikan Leader wajib dipilih.',
            'id_player.integer' => 'Anggota yang dipilih tidak valid.',
        ]);

        if ((int) $validated['id_player'] === (int) $player->id_player) {
            return response()->json([
                'success' => false,
                'message' => 'Kamu sudah menjadi Leader Squad ini.',
            ], 422);
        }

        $calon = $squad->anggotaAktif()
            ->where('id_player', $validated['id_player'])
            ->with('player.user')
            ->first();

        if (!$calon) {
            return response()->json([
                'success' => false,
                'message' => 'Anggota tidak ditemukan di Squad ini.',
            ], 404);
        }

        DB::transaction(function () use ($squad, $calon) {
            Squad::whereKey($squad->id_squad)
            ->lockForUpdate()
            ->first()
            ->gantiLeader($calon->id_player);
        });

        return response()->json([
            'success' => true,
            'message' => 'Anggota berhasil dijadikan Leader.',
            'data' => $this->formatSquadDetail($squad->fresh(), $player),
        ], 200);
    }

    // ==========================================
    // HELPER
    // ==========================================

    private function formatSquadRingkas(Squad $squad, $player): array
    {
        $jumlah = $squad->anggota_aktif_count ?? $squad->anggotaAktif()->count();

        return [
            'id_squad' => $squad->id_squad,
            'kode_squad' => $squad->kode_squad,
            'nama_squad' => $squad->nama_squad,
            'logo_squad' => $squad->logo_squad,
            'logo_url' => $this->fileUrl($squad->logo_squad),
            'deskripsi' => $squad->deskripsi,
            'jumlah_anggota' => $jumlah,
            'maks_anggota' => $squad->maks_anggota,
            'is_full' => $jumlah >= $squad->maks_anggota,
            'status_squad' => $squad->status_squad,
            'peran' => $this->peranPlayer($squad, $player),
            'is_leader' => $squad->isLeader($player),
        ];
    }

    private function formatSquadDetail(Squad $squad, $player): array
    {
        $squad->loadMissing(['leader', 'anggotaAktif.player.user']);

        $leaderPlayerId = $squad->leader?->id_player;

        
        // Roster lock per pemain: [id_player => [turnamen...]]
        $terkunci = $squad->pemainTerkunci();

        $anggota = $squad->anggotaAktif
            ->sortBy('tanggal_bergabung')
            ->values()
            ->map(fn (AnggotaSquad $a) => [
                'id_anggota_squad' => $a->id_anggota_squad,
                'id_player' => $a->id_player,
                'username' => $a->player?->user?->username,
                'avatar' => $a->player?->avatar,
                'avatar_url' => $this->fileUrl($a->player?->avatar),
                'tanggal_bergabung' => $a->tanggal_bergabung?->toDateTimeString(),
                'peran' => (int) $a->id_player === (int) $leaderPlayerId ? 'leader' : 'anggota',
                
                // Terkunci = ada di roster turnamen squad ini (menunggu/diterima)
                'roster_terkunci' => $terkunci->has($a->id_player),
                'turnamen_roster' => $terkunci->get($a->id_player, collect())->values(),
            ]);

        return [
            'id_squad' => $squad->id_squad,
            'kode_squad' => $squad->kode_squad,
            'nama_squad' => $squad->nama_squad,
            'logo_squad' => $squad->logo_squad,
            'logo_url' => $this->fileUrl($squad->logo_squad),
            'deskripsi' => $squad->deskripsi,
            'maks_anggota' => $squad->maks_anggota,
            'jumlah_anggota' => $anggota->count(),
            'is_full' => $anggota->count() >= $squad->maks_anggota,
            'status_squad' => $squad->status_squad,
            'created_at' => $squad->created_at?->toDateTimeString(),
            'anggota' => $anggota,

            // Status Player yang sedang login terhadap Squad ini (untuk tombol di FE)
            // peran: 'leader' | 'anggota' | null (bukan anggota)
            'peran' => $player && $anggota->contains('id_player', $player->id_player)
                ? ((int) $player->id_player === (int) $leaderPlayerId ? 'leader' : 'anggota')
                : null,
            'is_leader' => $squad->isLeader($player),
            'is_anggota' => $player ? $anggota->contains('id_player', $player->id_player) : false,
            
            // Untuk tombol "Keluar Squad" milik Player login
            'roster_terkunci_saya' => $player ? $terkunci->has($player->id_player) : false,

            
            // PB-04: simbol biru pada tombol "Permintaan" (hanya untuk Leader)
            'jumlah_permintaan_menunggu' => $squad->isLeader($player)
                ? $squad->permintaan()->where('status_permintaan', 'menunggu')->count()
                : null,

            // PB-04: status Player login terhadap Squad ini (untuk tombol "Bergabung")
            'permintaan_saya' => $this->permintaanSaya($squad, $player),
            'undangan_saya' => $this->undanganSaya($squad, $player),

            // Diisi pada Sprint 3 (PB-18 s.d. PB-20)
            'statistik' => [],
            'pencapaian' => [],
        ];
    }

    /**
     * Mencari Squad berdasarkan id_squad (angka) atau kode_squad (contoh: SQD-7K2M9Q).
     */
    private function findSquad($key): ?Squad
    {
        $query = Squad::with('leader');

        return ctype_digit((string) $key)
            ? $query->find($key)
            : $query->where('kode_squad', strtoupper(ltrim($key, '#')))->first();
    }

        private function permintaanSaya(Squad $squad, $player): ?array
    {
        if (!$player) {
            return null;
        }

        $permintaan = $squad->permintaan()
            ->where('id_player', $player->id_player)
            ->where('status_permintaan', 'menunggu')
            ->first();

        return $permintaan ? [
            'id_permintaan' => $permintaan->id_permintaan,
            'status_permintaan' => $permintaan->status_permintaan,
        ] : null;
    }

    private function undanganSaya(Squad $squad, $player): ?array
    {
        if (!$player) {
            return null;
        }

        $undangan = $squad->undangan()
            ->where('id_player', $player->id_player)
            ->where('status_undangan', 'menunggu')
            ->first();

        return $undangan ? [
            'id_undangan' => $undangan->id_undangan,
            'status_undangan' => $undangan->status_undangan,
        ] : null;

    }

    private function peranPlayer(Squad $squad, $player): ?string
    {
        if (!$player || !$squad->isAnggotaAktif($player)) {
            return null;
        }

        return $squad->isLeader($player) ? 'leader' : 'anggota';
    }

    private function pesanValidasi(): array
    {
        return [
            'nama_squad.required' => 'Nama Squad wajib diisi.',
            'nama_squad.unique' => 'Nama Squad sudah ada.',
            'nama_squad.max' => 'Nama Squad maksimal 30 karakter.',
            'logo_squad.required' => 'Logo Squad wajib diunggah.',
            'logo_squad.image' => 'Logo Squad harus berupa gambar.',
            'logo_squad.mimes' => 'Logo Squad harus berformat JPG, JPEG, atau PNG.',
            'logo_squad.max' => 'Ukuran logo Squad maksimal 2 MB.',
            'deskripsi.required' => 'Deskripsi Squad wajib diisi.',
            'deskripsi.max' => 'Deskripsi Squad maksimal 100 karakter.',
        ];
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
}
?>