<?php

namespace App\Services;

use App\Models\AnggotaPendaftaranTurnamen;
use App\Models\PendaftaranTurnamen;
use App\Models\Player;
use App\Models\Squad;
use App\Models\Turnamen;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Satu tempat untuk semua aturan pendaftaran Squad ke turnamen
 * (PB-06 s/d PB-10). Dipakai oleh PendaftaranTurnamenController,
 * KelolaPendaftaranTurnamenController, dan TurnamenController
 * supaya aturannya tidak dobel.
 */
class PendaftaranTurnamenService
{
    // ==========================================
    // VALIDASI UTAMA
    // ==========================================

    /**
     * Mengembalikan pesan error pertama, atau null kalau lolos.
     * Dipanggil di dalam transaksi setelah baris turnamen dikunci.
     *
     * @param  int[]  $roster  id_player yang dipilih pendaftar
     */
    public function validasiPendaftaran(
        Turnamen $turnamen,
        Squad $squad,
        Player $player,
        array $roster,
        ?string $uidGame = null
    ): ?string {
        if ($squad->status_squad !== 'aktif') {
            return 'Squad tidak aktif.';
        }

        if (!$squad->isAnggotaAktif($player)) {
            return 'Gabung ke squad terlebih dahulu untuk melanjutkan proses pendaftaran';
        }

        // Penyelenggara tidak boleh mendaftarkan Squad ke turnamennya sendiri.
        if ($this->isPenyelenggara($turnamen, $player)) {
            return 'Penyelenggara tidak dapat mendaftar pada turnamen yang diselenggarakannya.';
        }

        // US25: Squad yang sama tidak boleh mendaftar dua kali
        // (termasuk lewat anggota yang berbeda).
        if ($this->pendaftaranAktifSquad($turnamen, $squad)) {
            return 'Squad sudah terdaftar pada turnamen ini.';
        }

        if ($alasan = $this->alasanTurnamenTertutup($turnamen)) {
            return $alasan;
        }

        // Pendaftar sendiri sudah ada di roster pendaftaran lain.
        if ($this->pendaftaranAktifPlayer($turnamen->id_turnamen, $player->id_player)) {
            return 'Anda sudah terdaftar pada turnamen ini melalui Squad lain.';
        }

        $roster = collect($roster)->map(fn ($id) => (int) $id)->unique()->values();

        // Pendaftar wajib ikut di roster.
        if (!$roster->contains((int) $player->id_player)) {
            return 'Pendaftar wajib termasuk dalam roster.';
        }

        // Semua pemain yang dipilih harus anggota aktif Squad.
        $anggotaAktif = $this->rosterSquad($squad)->map(fn ($id) => (int) $id);
        if ($roster->diff($anggotaAktif)->isNotEmpty()) {
            return 'Pemain yang dipilih harus anggota aktif Squad.';
        }

        // Jumlah pemain sesuai aturan turnamen.
        $min = $this->minRoster($turnamen);
        $maks = $this->maksRoster($turnamen);

        if ($roster->count() < $min) {
            return "Roster minimal {$min} pemain.";
        }

        if ($roster->count() > $maks) {
            return "Roster maksimal {$maks} pemain.";
        }

        // Penyelenggara tidak boleh ada di roster Squad mana pun.
        if ($alasan = $this->alasanPenyelenggaraDiRoster($turnamen, $roster)) {
            return $alasan;
        }

        // US26: pemain di roster belum terdaftar lewat Squad lain.
        if ($alasan = $this->alasanAnggotaSudahTerdaftar($turnamen, $roster)) {
            return $alasan;
        }

        // UID game tidak boleh dipakai pendaftaran lain di turnamen yang sama.
        if ($uidGame !== null && $this->uidGameSudahDipakai($turnamen, $uidGame)) {
            return 'UID game sudah digunakan oleh pendaftaran lain di turnamen ini.';
        }

        return null;
    }

    /**
     * Status setiap anggota aktif Squad untuk dipilih ke roster turnamen.
     *
     * @return \Illuminate\Support\Collection<int, array{id_player:int, username:?string, avatar:?string, peran:string, bisa_dipilih:bool, alasan:?string}>
     */
    public function statusAnggotaRoster(Turnamen $turnamen, Squad $squad): Collection
    {
        $squad->loadMissing(['leader', 'anggotaAktif.player.user']);

        $idPenyelenggara = $this->idPlayerPenyelenggara($turnamen);
        $leaderId = (int) $squad->leader?->id_player;

        $idSudahTerdaftar = AnggotaPendaftaranTurnamen::query()
            ->whereIn('id_player', $squad->anggotaAktif->pluck('id_player'))
            ->whereHas('pendaftaran', fn ($q) => $q->aktif()
                ->where('id_turnamen', $turnamen->id_turnamen)
                ->where('id_squad', '!=', $squad->id_squad))
            ->pluck('id_player')
            ->map(fn ($id) => (int) $id)
            ->all();

        return $squad->anggotaAktif->map(function ($a) use ($idPenyelenggara, $idSudahTerdaftar, $leaderId) {
            $idPlayer = (int) $a->id_player;

            $alasan = match (true) {
                $idPlayer === $idPenyelenggara => 'Penyelenggara turnamen ini',
                in_array($idPlayer, $idSudahTerdaftar, true) => 'Sudah terdaftar di turnamen ini bersama squad lain',
                default => null,
            };

            return [
                'id_player' => $idPlayer,
                'username' => $a->player?->user?->username,
                'avatar' => $a->player?->avatar,
                'peran' => $idPlayer === $leaderId ? 'leader' : 'anggota',
                'bisa_dipilih' => $alasan === null,
                'alasan' => $alasan,
            ];
        })->values();
    }

    /**
     * Alasan sebuah Squad tidak bisa dipilih di form daftar (squad-saya),
     * atau null kalau bisa didaftarkan.
     *
     * @param  \Illuminate\Support\Collection|null  $statusAnggota  hasil statusAnggotaRoster()
     */
    public function alasanSquadTidakBisaDaftar(
        Turnamen $turnamen,
        Squad $squad,
        Player $player,
        ?Collection $statusAnggota = null
    ): ?string {
        if ($this->pendaftaranAktifSquad($turnamen, $squad)) {
            return 'Squad sudah terdaftar pada turnamen ini.';
        }

        if ($this->isPenyelenggara($turnamen, $player)) {
            return 'Penyelenggara tidak dapat mendaftar pada turnamen yang diselenggarakannya.';
        }

        if ($alasan = $this->alasanTurnamenTertutup($turnamen)) {
            return $alasan;
        }

        if ($this->pendaftaranAktifPlayer($turnamen->id_turnamen, $player->id_player)) {
            return 'Anda sudah terdaftar pada turnamen ini melalui Squad lain.';
        }

        $statusAnggota ??= $this->statusAnggotaRoster($turnamen, $squad);
        $bisaDipilih = $statusAnggota->where('bisa_dipilih', true)->count();
        $min = $this->minRoster($turnamen);

        if ($bisaDipilih < $min) {
            return "Hanya {$bisaDipilih} anggota yang dapat didaftarkan (minimal {$min})";
        }

        return null;
    }

    /**
     * US26 / AD Pilih Squad:
     * "[Nama] sudah terdaftar di turnamen ini bersama squad lain".
     */
    public function alasanAnggotaSudahTerdaftar(Turnamen $turnamen, Collection $roster): ?string
    {
        $bentrok = AnggotaPendaftaranTurnamen::with('player.user')
            ->whereIn('id_player', $roster)
            ->whereHas('pendaftaran', fn ($q) => $q->aktif()->where('id_turnamen', $turnamen->id_turnamen))
            ->get();

        if ($bentrok->isEmpty()) {
            return null;
        }

        $nama = $bentrok->map(fn ($a) => $a->player?->user?->username)->filter()->unique()->implode(', ');

        return "{$nama} sudah terdaftar di turnamen ini bersama squad lain";
    }

    /**
     * UID game dipakai pendaftaran aktif (menunggu/diterima) di turnamen ini.
     * Pendaftaran ditolak tidak dihitung, jadi UID bisa dipakai lagi.
     */
    public function uidGameSudahDipakai(Turnamen $turnamen, string $uidGame): bool
    {
        return PendaftaranTurnamen::aktif()
            ->where('id_turnamen', $turnamen->id_turnamen)
            ->whereRaw('LOWER(uid_game) = ?', [mb_strtolower(trim($uidGame))])
            ->exists();
    }

    // ==========================================
    // PENYELENGGARA
    // ==========================================

    /**
     * id_player penyelenggara turnamen
     * (turnamen.id_penyelenggara → penyelenggara.id_player).
     */
    public function idPlayerPenyelenggara(Turnamen $turnamen): ?int
    {
        $turnamen->loadMissing('penyelenggara');

        $id = $turnamen->penyelenggara?->id_player;

        return $id !== null ? (int) $id : null;
    }

    public function isPenyelenggara(Turnamen $turnamen, ?Player $player): bool
    {
        if (!$player) {
            return false;
        }

        return $this->idPlayerPenyelenggara($turnamen) === (int) $player->id_player;
    }

    /**
     * "[Nama] adalah penyelenggara turnamen ini" kalau penyelenggara ada di roster.
     */
    public function alasanPenyelenggaraDiRoster(Turnamen $turnamen, Collection $roster): ?string
    {
        $idPenyelenggara = $this->idPlayerPenyelenggara($turnamen);

        if ($idPenyelenggara === null || !$roster->map(fn ($id) => (int) $id)->contains($idPenyelenggara)) {
            return null;
        }

        $turnamen->loadMissing('penyelenggara.player.user');
        $nama = $turnamen->penyelenggara?->player?->user?->username ?? 'Penyelenggara';

        return "{$nama} adalah penyelenggara turnamen ini";
    }

    // ==========================================
    // TURNAMEN & SLOT
    // ==========================================

    /**
     * Alasan turnamen tidak menerima pendaftaran, atau null kalau masih buka.
     */
    public function alasanTurnamenTertutup(Turnamen $turnamen): ?string
    {
        $pengajuan = $turnamen->pengajuan;

        if ($turnamen->status === 'selesai') {
            return 'Turnamen sudah selesai.';
        }

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
    public function sisaSlot(Turnamen $turnamen): int
    {
        return max(0, (int) $turnamen->pengajuan->slot - $turnamen->slotTerisi());
    }

    public function isBerbayar(Turnamen $turnamen): bool
    {
        return $turnamen->pengajuan?->pendanaan?->jenis_biaya === 'berbayar';
    }

    /**
     * Jumlah pemain per Squad ditentukan penyelenggara per turnamen
     * (pengajuan_turnamen.min_roster / maks_roster).
     */
    public function minRoster(Turnamen $turnamen): int
    {
        return (int) ($turnamen->pengajuan?->min_roster ?? 1);
    }

    public function maksRoster(Turnamen $turnamen): int
    {
        return (int) ($turnamen->pengajuan?->maks_roster ?? 10);
    }

    // ==========================================
    // PENDAFTARAN AKTIF
    // ==========================================

    public function pendaftaranAktifSquad(Turnamen $turnamen, Squad $squad): ?PendaftaranTurnamen
    {
        return PendaftaranTurnamen::aktif()
            ->where('id_turnamen', $turnamen->id_turnamen)
            ->where('id_squad', $squad->id_squad)
            ->first();
    }

    /**
     * Pendaftaran aktif (menunggu/diterima) yang roster-nya memuat Player ini.
     */
    public function pendaftaranAktifPlayer(int $idTurnamen, int $idPlayer): ?PendaftaranTurnamen
    {
        return PendaftaranTurnamen::aktif()
            ->where('id_turnamen', $idTurnamen)
            ->whereHas('anggota', fn ($q) => $q->where('id_player', $idPlayer))
            ->first();
    }

    public function rosterSquad(Squad $squad): Collection
    {
        return $squad->anggotaAktif()->pluck('id_player');
    }

    // ==========================================
    // VERIFIKASI PENDAFTARAN (PB-10)
    // ==========================================

    /**
     * Alasan pendaftaran tidak bisa diterima/ditolak, atau null kalau bisa.
     */
    public function alasanTidakBisaDiverifikasi(Turnamen $turnamen, PendaftaranTurnamen $pendaftaran): ?string
    {
        if ($pendaftaran->status_pendaftaran !== 'menunggu') {
            return 'Pendaftaran sudah diverifikasi sebelumnya.';
        }

        if ($turnamen->status === 'selesai') {
            return 'Turnamen sudah selesai.';
        }

        $jadwalMain = $turnamen->pengajuan?->jadwal_main;
        if ($jadwalMain && now()->gte(Carbon::parse($jadwalMain))) {
            return 'Turnamen sudah dimulai, pendaftaran tidak dapat diverifikasi lagi.';
        }

        return null;
    }

    /**
     * US32: Squad ditetapkan sebagai peserta. Roster tetap terkunci.
     */
    public function terima(PendaftaranTurnamen $pendaftaran): PendaftaranTurnamen
    {
        $pendaftaran->update([
            'status_pendaftaran' => 'diterima',
            'tanggal_verifikasi' => now(),
        ]);

        return $pendaftaran;
    }

    /**
     * US33: pendaftaran ditolak, slot kembali (tidak dihitung lagi)
     * dan roster langsung dibuka (US29 kondisi 1).
     */
    public function tolak(PendaftaranTurnamen $pendaftaran, string $alasan): PendaftaranTurnamen
    {
        $now = now();

        $pendaftaran->update([
            'status_pendaftaran' => 'ditolak',
            'alasan_penolakan' => $alasan,
            'tanggal_verifikasi' => $now,
        ]);

        // Semua pemain di roster pendaftaran ini dibuka kuncinya.
        $pendaftaran->anggota()
            ->where('status_roster', 'terkunci')
            ->update([
                'status_roster' => 'terbuka',
                'tanggal_pembukaan' => $now,
            ]);

        return $pendaftaran;
    }

    // ==========================================
    // SELESAIKAN TURNAMEN (PB-09)
    // ==========================================

    /**
     * Alasan turnamen belum bisa diselesaikan, atau null kalau bisa.
     *
     * TODO Modul 4: tambahkan validasi seluruh pertandingan sudah punya
     * hasil final dan tidak ada laporan pertandingan yang menunggu.
     */
    public function alasanTidakBisaDiselesaikan(Turnamen $turnamen): ?string
    {
        if ($turnamen->status === 'selesai') {
            return 'Turnamen sudah diselesaikan.';
        }

        $jadwalMain = $turnamen->pengajuan?->jadwal_main;
        if ($jadwalMain && now()->lt(Carbon::parse($jadwalMain))) {
            return 'Turnamen belum dimulai, sehingga belum dapat diselesaikan.';
        }

        return null;
    }

    /**
     * US29 kondisi 2: status turnamen jadi "selesai" dan seluruh roster
     * Squad pada turnamen ini dibuka kembali.
     * Pendaftaran yang masih "menunggu" otomatis ditolak supaya
     * roster Squad-nya tidak terkunci selamanya.
     * Harus dipanggil di dalam DB::transaction.
     *
     * @return array{roster_dibuka:int, otomatis_ditolak:int}
     */
    public function selesaikanTurnamen(Turnamen $turnamen): array
    {
        $now = now();

        $otomatisDitolak = PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->where('status_pendaftaran', 'menunggu')
            ->update([
                'status_pendaftaran' => 'ditolak',
                'alasan_penolakan' => 'Turnamen telah selesai sebelum pendaftaran diverifikasi.',
                'tanggal_verifikasi' => $now,
                'updated_at' => $now,
            ]);

        // Buka kunci semua pemain di roster turnamen ini.
        $rosterDibuka = AnggotaPendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->where('status_roster', 'terkunci')
            ->update([
                'status_roster' => 'terbuka',
                'tanggal_pembukaan' => $now,
            ]);

        $turnamen->update(['status' => 'selesai']);

        return [
            'roster_dibuka' => $rosterDibuka,
            'otomatis_ditolak' => $otomatisDitolak,
        ];
    }
}
?>