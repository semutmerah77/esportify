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
            'nama_squad' => ['required', 'string', 'max:100', 'unique:squad,nama_squad'],
            'logo_squad' => ['required', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],
            'deskripsi' => ['required', 'string', 'max:1000'],
        ], [
            'nama_squad.unique' => 'Nama Squad sudah ada.',
        ]);

        $logoPath = $request->file('logo_squad')->store('squad-logos', 'public');

        try {
            $squad = DB::transaction(function () use ($validated, $player, $logoPath) {
                $leader = LeaderSquad::firstOrCreate([
                    'id_player' => $player->id_player,
                ]);

                $squad = Squad::create([
                    'id_leader_squad' => $leader->id_leader_squad,
                    'kode_squad' => Squad::generateKode(),
                    'logo_squad' => $logoPath,
                    'nama_squad' => $validated['nama_squad'],
                    'deskripsi' => $validated['deskripsi'],
                    'maks_anggota' => 7,
                    'status_squad' => 'aktif',
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

        $squad = Squad::find($id);

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

        $squad = Squad::with('leader')->find($id);

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
                'sometimes', 'required', 'string', 'max:100',
                Rule::unique('squad', 'nama_squad')->ignore($squad->id_squad, 'id_squad'),
            ],
            'logo_squad' => ['sometimes', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],
            'deskripsi' => ['sometimes', 'required', 'string', 'max:1000'],
        ], [
            'nama_squad.unique' => 'Nama Squad sudah ada.',
        ]);

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

    // ==========================================
    // HELPER
    // ==========================================

    private function formatSquadRingkas(Squad $squad, $player): array
    {
        return [
            'id_squad' => $squad->id_squad,
            'kode_squad' => $squad->kode_squad,
            'nama_squad' => $squad->nama_squad,
            'logo_squad' => $squad->logo_squad,
            'logo_url' => $this->fileUrl($squad->logo_squad),
            'jumlah_anggota' => $squad->anggota_aktif_count ?? $squad->anggotaAktif()->count(),
            'maks_anggota' => $squad->maks_anggota,
            'status_squad' => $squad->status_squad,
            'is_leader' => $squad->isLeader($player),
        ];
    }

    private function formatSquadDetail(Squad $squad, $player): array
    {
        $squad->loadMissing(['leader', 'anggotaAktif.player.user']);

        $leaderPlayerId = $squad->leader?->id_player;

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
            'status_squad' => $squad->status_squad,
            'created_at' => $squad->created_at?->toDateTimeString(),
            'anggota' => $anggota,

            // Status Player yang sedang login terhadap Squad ini (untuk tombol di FE)
            'is_leader' => $squad->isLeader($player),
            'is_anggota' => $player ? $anggota->contains('id_player', $player->id_player) : false,

            // Diisi pada Sprint 3 (PB-18 s.d. PB-20)
            'statistik' => [],
            'pencapaian' => [],
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