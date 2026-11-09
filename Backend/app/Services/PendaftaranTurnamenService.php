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
 * (PB-06, PB-07, PB-08). Dipakai oleh PendaftaranTurnamenController
 * dan TurnamenController supaya aturannya tidak dobel.
 */
class PendaftaranTurnamenService
{
    // ==========================================
    // VALIDASI UTAMA
    // ==========================================

    /**
     * Mengembalikan pesan error pertama, atau null kalau lolos.
     * Dipanggil di dalam transaksi setelah baris turnamen dikunci.
     */
    public function validasiPendaftaran(Turnamen $turnamen, Squad $squad, Player $player): ?string
    {
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

        $roster = $this->rosterSquad($squad);

        // Penyelenggara tidak boleh ada di roster Squad mana pun.
        if ($alasan = $this->alasanPenyelenggaraDiRoster($turnamen, $roster)) {
            return $alasan;
        }

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
     * Alasan sebuah Squad tidak bisa dipilih di form daftar (squad-saya),
     * atau null kalau bisa didaftarkan. Urutan sama dengan validasi utama.
     */
    public function alasanSquadTidakBisaDaftar(Turnamen $turnamen, Squad $squad, Player $player): ?string
    {
        if ($this->pendaftaranAktifSquad($turnamen, $squad)) {
            return 'Squad sudah terdaftar pada turnamen ini.';
        }

        $roster = $this->rosterSquad($squad);

        if ($alasan = $this->alasanPenyelenggaraDiRoster($turnamen, $roster)) {
            return $alasan;
        }

        if ($alasan = $this->alasanTurnamenTertutup($turnamen)) {
            return $alasan;
        }

        if ($this->pendaftaranAktifPlayer($turnamen->id_turnamen, $player->id_player)) {
            return 'Anda sudah terdaftar pada turnamen ini melalui Squad lain.';
        }

        $min = $this->minAnggota();
        if ($roster->count() < $min) {
            return "Jumlah anggota Squad belum memenuhi syarat minimal {$min} anggota.";
        }

        return null;
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

    public function minAnggota(): int
    {
        return (int) config('esportify.min_anggota_turnamen', 5);
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
}
