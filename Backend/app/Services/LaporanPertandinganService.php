<?php

namespace App\Services;

use App\Models\BuktiPertandingan;
use App\Models\LaporanHasilPertandingan;
use App\Models\PendaftaranTurnamen;
use App\Models\Pertandingan;
use App\Models\Player;
use App\Models\Squad;
use App\Models\Turnamen;
use Illuminate\Support\Collection;

/**
 * Satu tempat untuk aturan laporan hasil pertandingan:
 * PB-15 (lapor + bukti), PB-16 (verifikasi), PB-17 (kirim ulang / sanggahan).
 *
 * Kirim ulang dan sanggahan selalu dibuat sebagai laporan BARU
 * (laporan lama tetap tersimpan sebagai riwayat). Pelapornya anggota
 * aktif Squad yang terakhir mengirim (mis. "oleh Budi").
 */
class LaporanPertandinganService
{
    public const ALASAN_PENOLAKAN = [
        'bukti_tidak_jelas' => 'Bukti tidak jelas atau tidak terbaca',
        'skor_tidak_sesuai' => 'Skor tidak sesuai dengan bukti',
        'bukan_bukti_pertandingan' => 'Bukan bukti pertandingan ini',
        'bukti_tidak_valid' => 'Bukti tidak valid',
        'lainnya' => 'Lainnya',
    ];

    public const ALASAN_TOLAK_OTOMATIS = 'Ditolak otomatis karena skor berbeda dengan laporan yang disetujui.';

    public function __construct(
        private BracketService $bracket
    ) {
    }

    // ==========================================
    // SQUAD PELAPOR
    // ==========================================

    /**
     * Pendaftaran (slot A/B) yang diwakili Player pada pertandingan ini.
     * 1. Roster turnamen didahulukan: satu Player hanya bisa ada di satu
     *    roster per turnamen, jadi Player yang tergabung di kedua Squad
     *    tetap jelas mewakili Squad yang mana.
     * 2. Kalau tidak ada di roster mana pun, pakai keanggotaan aktif Squad
     *    (semua anggota aktif boleh melapor, keputusan SA) — asalkan hanya
     *    anggota salah satu Squad.
     *
     * @return array{0: ?PendaftaranTurnamen, 1: ?string} [pendaftaran, posisi 'A'|'B']
     */
    public function pendaftaranSaya(Pertandingan $pertandingan, Player $player): array
    {
        $pertandingan->loadMissing(['pendaftaranA.squad', 'pendaftaranB.squad']);

        $a = $pertandingan->pendaftaranA;
        $b = $pertandingan->pendaftaranB;

        $diRoster = fn (?PendaftaranTurnamen $p) => $p !== null
            && $p->anggota()->where('id_player', $player->id_player)->exists();

        $rosterA = $diRoster($a);
        $rosterB = $diRoster($b);

        if ($rosterA !== $rosterB) {
            return $rosterA ? [$a, 'A'] : [$b, 'B'];
        }

        $anggotaA = $a?->squad?->isAnggotaAktif($player) ?? false;
        $anggotaB = $b?->squad?->isAnggotaAktif($player) ?? false;

        if ($anggotaA !== $anggotaB) {
            return $anggotaA ? [$a, 'A'] : [$b, 'B'];
        }

        return [null, null];
    }

    public function laporanTerakhirSquad(Pertandingan $pertandingan, int $idSquad): ?LaporanHasilPertandingan
    {
        return LaporanHasilPertandingan::where('id_pertandingan', $pertandingan->id_pertandingan)
            ->where('id_squad_pelapor', $idSquad)
            ->latest('id_laporan')
            ->first();
    }

    /**
     * Jenis pengiriman berikutnya: laporan awal, kirim ulang, atau sanggahan.
     * Ditentukan BE dari kondisi pertandingan dan riwayat laporan Squad.
     */
    public function jenisPengiriman(Pertandingan $pertandingan, ?LaporanHasilPertandingan $terakhir): string
    {
        if ($pertandingan->punyaSkor()) {
            return 'sanggahan';
        }

        if ($terakhir && $terakhir->status_laporan === LaporanHasilPertandingan::STATUS_DITOLAK) {
            return 'kirim_ulang';
        }

        return 'laporan';
    }

    /**
     * Alasan Squad tidak bisa mengirim laporan / kirim ulang / sanggahan,
     * atau null kalau bisa.
     */
    public function alasanTidakBisaLapor(Turnamen $turnamen, Pertandingan $pertandingan, ?PendaftaranTurnamen $pendaftaranSaya): ?string
    {
        if ($turnamen->status === Turnamen::STATUS_SELESAI) {
            return Turnamen::PESAN_HASIL_TERKUNCI;
        }

        if ($turnamen->sudahBerakhir()) {
            return $turnamen->pesanBerakhir();
        }

        if ($pertandingan->bracket?->isDraft() || $turnamen->status !== 'berlangsung') {
            return 'Laporan hasil pertandingan dapat dikirim setelah turnamen berlangsung.';
        }

        if (!$pendaftaranSaya) {
            return 'Anda hanya dapat melaporkan pertandingan yang diikuti Squad Anda.';
        }

        if ($pertandingan->is_bye) {
            return 'Pertandingan bye tidak memiliki laporan hasil.';
        }

        if (!$pertandingan->keduaSquadAda()) {
            return 'Kedua Squad pada pertandingan ini belum ditentukan.';
        }

        $menunggu = LaporanHasilPertandingan::where('id_pertandingan', $pertandingan->id_pertandingan)
            ->where('id_squad_pelapor', $pendaftaranSaya->id_squad)
            ->menunggu()
            ->exists();

        if ($menunggu) {
            return 'Laporan Squad Anda masih menunggu verifikasi dan tidak dapat diubah.';
        }

        // R6.11 + keputusan SA: semua pertandingan lanjutan yang terdampak
        // (jalur pemenang dan jalur yang kalah ke perebutan Juara 3) belum punya skor.
        if ($this->bracket->alasanTidakBisaDikoreksi($pertandingan) !== null) {
            return 'Pertandingan berikutnya sudah memiliki skor, laporan untuk pertandingan ini tidak dapat dikirim lagi.';
        }

        return null;
    }

    // ==========================================
    // KIRIM (PB-15, PB-17)
    // ==========================================

    /**
     * Membuat laporan baru (status menunggu). Panggil di dalam
     * DB::transaction setelah baris pertandingan dikunci.
     *
     * @param  string[]  $pathBuktiBaru  path file yang sudah disimpan
     * @param  Collection<int, BuktiPertandingan>  $buktiLama  bukti laporan sebelumnya yang dipertahankan
     */
    public function kirim(
        Pertandingan $pertandingan,
        PendaftaranTurnamen $pendaftaranSaya,
        string $posisi,
        Player $player,
        int $skorA,
        int $skorB,
        ?string $catatan,
        array $pathBuktiBaru,
        Collection $buktiLama
    ): LaporanHasilPertandingan {
        $now = now();

        $laporan = LaporanHasilPertandingan::create([
            'id_pertandingan' => $pertandingan->id_pertandingan,
            'id_squad_pelapor' => $pendaftaranSaya->id_squad,
            'id_player_pelapor' => $player->id_player,
            // Disimpan dari sudut pandang Squad pelapor (PDM)
            'skor_squad_pelapor' => $posisi === 'A' ? $skorA : $skorB,
            'skor_squad_lawan' => $posisi === 'A' ? $skorB : $skorA,
            'catatan_pelapor' => $catatan,
            'status_laporan' => LaporanHasilPertandingan::STATUS_MENUNGGU,
            'tanggal_laporan' => $now,
        ]);

        // Bukti lama yang dipertahankan: file yang sama, tidak di-upload ulang.
        foreach ($buktiLama as $bukti) {
            BuktiPertandingan::create([
                'id_laporan' => $laporan->id_laporan,
                'file_bukti' => $bukti->file_bukti,
                'tanggal_upload' => $bukti->tanggal_upload ?? $now,
            ]);
        }

        foreach ($pathBuktiBaru as $path) {
            BuktiPertandingan::create([
                'id_laporan' => $laporan->id_laporan,
                'file_bukti' => $path,
                'tanggal_upload' => $now,
            ]);
        }

        return $laporan;
    }

    // ==========================================
    // VERIFIKASI (PB-16)
    // ==========================================

    /**
     * Alasan laporan tidak bisa disetujui/ditolak, atau null kalau bisa.
     */
    public function alasanTidakBisaDiverifikasi(Turnamen $turnamen, LaporanHasilPertandingan $laporan, bool $setujui): ?string
    {
        if ($laporan->status_laporan !== LaporanHasilPertandingan::STATUS_MENUNGGU) {
            return 'Laporan sudah diverifikasi sebelumnya.';
        }

        // PB-21: setelah masa koreksi berakhir, hasil terkunci.
        if (Turnamen::getStatusTurnamen((int) $turnamen->id_turnamen) === Turnamen::STATUS_SELESAI) {
            return Turnamen::PESAN_HASIL_TERKUNCI;
        }

        if ($turnamen->sudahBerakhir()) {
            return $turnamen->pesanBerakhir();
        }

        if ($setujui) {
            return $this->bracket->alasanTidakBisaUbahSkor($turnamen, $laporan->pertandingan);
        }

        return null;
    }

    /**
     * US51: setujui laporan → skor diterapkan ke bracket (pemenang maju),
     * lalu laporan Squad lawan yang menunggu diproses otomatis (R6.21):
     * skor sama ikut disetujui, skor berbeda ditolak.
     * Panggil di dalam DB::transaction setelah pertandingan dikunci.
     */
    public function setujui(LaporanHasilPertandingan $laporan, int $idPenyelenggara): array
    {
        $pertandingan = $laporan->pertandingan;
        [$skorA, $skorB] = $this->skorAB($laporan, $pertandingan);

        $this->bracket->tetapkanHasil($pertandingan, $skorA, $skorB);

        $now = now();
        $this->tandai($laporan, LaporanHasilPertandingan::STATUS_DISETUJUI, null, $idPenyelenggara, $now);

        $otomatis = ['disetujui' => 0, 'ditolak' => 0];

        // prosesLaporanLawan
        LaporanHasilPertandingan::where('id_pertandingan', $pertandingan->id_pertandingan)
            ->where('id_laporan', '!=', $laporan->id_laporan)
            ->menunggu()
            ->get()
            ->each(function (LaporanHasilPertandingan $lain) use ($pertandingan, $skorA, $skorB, $idPenyelenggara, $now, &$otomatis) {
                $sama = $this->skorAB($lain, $pertandingan) === [$skorA, $skorB];

                $this->tandai(
                    $lain,
                    $sama ? LaporanHasilPertandingan::STATUS_DISETUJUI : LaporanHasilPertandingan::STATUS_DITOLAK,
                    $sama ? null : self::ALASAN_TOLAK_OTOMATIS,
                    $idPenyelenggara,
                    $now
                );

                $otomatis[$sama ? 'disetujui' : 'ditolak']++;
            });

        return $otomatis;
    }

    /**
     * US52: tolak laporan dengan alasan. Bracket tidak berubah (R6.10).
     */
    public function tolak(LaporanHasilPertandingan $laporan, string $alasan, int $idPenyelenggara): void
    {
        $this->tandai($laporan, LaporanHasilPertandingan::STATUS_DITOLAK, $alasan, $idPenyelenggara, now());
    }

    private function tandai(LaporanHasilPertandingan $laporan, string $status, ?string $alasan, int $idPenyelenggara, $waktu): void
    {
        $laporan->update([
            'status_laporan' => $status,
            'catatan_verifikasi' => $alasan,
            'id_penyelenggara_verifikator' => $idPenyelenggara,
            'tanggal_verifikasi' => $waktu,
        ]);

        BuktiPertandingan::where('id_laporan', $laporan->id_laporan)->update(['tanggal_verifikasi' => $waktu]);
    }

    // ==========================================
    // FORMAT
    // ==========================================

    /**
     * Skor laporan dalam urutan slot pertandingan [A, B].
     *
     * @return array{0:int, 1:int}
     */
    public function skorAB(LaporanHasilPertandingan $laporan, Pertandingan $pertandingan): array
    {
        $pelaporA = (int) $laporan->id_squad_pelapor === (int) $pertandingan->pendaftaranA?->id_squad;

        return $pelaporA
            ? [$laporan->skor_squad_pelapor, $laporan->skor_squad_lawan]
            : [$laporan->skor_squad_lawan, $laporan->skor_squad_pelapor];
    }

    public function formatLaporan(LaporanHasilPertandingan $laporan): array
    {
        $laporan->loadMissing(['pertandingan.pendaftaranA', 'squadPelapor', 'playerPelapor.user', 'bukti']);

        $pertandingan = $laporan->pertandingan;
        [$skorA, $skorB] = $this->skorAB($laporan, $pertandingan);

        return [
            'id_laporan' => $laporan->id_laporan,
            'id_pertandingan' => $laporan->id_pertandingan,
            'status_laporan' => $laporan->status_laporan,
            'squad_pelapor' => [
                'id_squad' => $laporan->id_squad_pelapor,
                'nama_squad' => $laporan->squadPelapor?->nama_squad,
                'posisi' => (int) $laporan->id_squad_pelapor === (int) $pertandingan->pendaftaranA?->id_squad ? 'A' : 'B',
            ],
            'dikirim_oleh' => [
                'id_player' => $laporan->id_player_pelapor,
                'username' => $laporan->playerPelapor?->user?->username,
            ],
            'skor_a' => $skorA,
            'skor_b' => $skorB,
            'catatan' => $laporan->catatan_pelapor,
            'alasan_penolakan' => $laporan->status_laporan === LaporanHasilPertandingan::STATUS_DITOLAK
                ? $laporan->catatan_verifikasi
                : null,
            'tanggal_laporan' => $laporan->tanggal_laporan,
            'tanggal_keputusan' => $laporan->tanggal_verifikasi,
            'bukti' => $laporan->bukti->map(fn (BuktiPertandingan $b) => [
                'id_bukti' => $b->id_bukti,
                'nama_file' => basename($b->file_bukti),
                'url' => url("/api/laporan-pertandingan/{$laporan->id_laporan}/bukti/{$b->id_bukti}"),
            ])->values(),
        ];
    }

    public function formatPertandingan(Pertandingan $pertandingan): array
    {
        $pertandingan->loadMissing(['babak', 'pendaftaranA.squad', 'pendaftaranB.squad']);

        $squad = fn (?PendaftaranTurnamen $p) => $p ? [
            'id_pendaftaran' => $p->id_pendaftaran,
            'id_squad' => $p->id_squad,
            'nama_squad' => $p->squad?->nama_squad,
            'logo_url' => $p->squad?->logo_squad ? asset('storage/' . $p->squad->logo_squad) : null,
        ] : null;

        return [
            'id_pertandingan' => $pertandingan->id_pertandingan,
            'nomor_pertandingan' => $pertandingan->nomor_pertandingan,
            'nama_babak' => $pertandingan->babak?->nama_babak,
            'status_pertandingan' => $pertandingan->status_pertandingan,
            'squad_a' => $squad($pertandingan->pendaftaranA),
            'squad_b' => $squad($pertandingan->pendaftaranB),
            'skor_a' => $pertandingan->skor_a,
            'skor_b' => $pertandingan->skor_b,
            'id_pendaftaran_pemenang' => $pertandingan->id_pendaftaran_pemenang,
        ];
    }

    public function jumlahMenunggu(Turnamen $turnamen): int
    {
        return LaporanHasilPertandingan::menunggu()
            ->whereHas('pertandingan.bracket', fn ($q) => $q->where('id_turnamen', $turnamen->id_turnamen))
            ->count();
    }
}
