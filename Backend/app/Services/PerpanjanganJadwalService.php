<?php

namespace App\Services;

use App\Models\BracketTurnamen;
use App\Models\LaporanHasilPertandingan;
use App\Models\Turnamen;
use Carbon\Carbon;

/**
 * Aturan perpanjangan jadwal turnamen (PB-24, keputusan SA):
 *
 * - Penyelenggara langsung mengubah jadwal (tanpa verifikasi Admin).
 * - Yang bisa diperpanjang: jadwal tutup pendaftaran & jadwal main.
 * - Masing-masing maksimal 14 hari dari jadwal AWAL (saat pengajuan disetujui),
 *   tidak boleh lebih awal dari jadwal aktif, dan jadwal main minimal 1 hari
 *   setelah jadwal tutup pendaftaran. Tidak ada batas jumlah perpanjangan.
 * - Hasil disimpan di turnamen.*_baru (ditimpa, tanpa riwayat).
 *   pengajuan_turnamen tidak diubah (arsip).
 * - Tidak bisa jika: turnamen selesai/dibatalkan, ada pengajuan pembatalan
 *   menunggu, sudah ada pertandingan berskor, atau ada laporan hasil menunggu.
 * - Tutup pendaftaran diperpanjang (ke masa depan) -> pendaftaran dibuka
 *   kembali, bracket kembali draft, status kembali "pendaftaran".
 * - Hanya jadwal main diperpanjang saat "berlangsung" -> status "pendaftaran"
 *   (tampil "Pendaftaran Ditutup") & bracket kembali draft.
 * - Hanya jadwal main diperpanjang sebelum berlangsung -> bracket tidak berubah.
 * - Roster tetap terkunci. Tidak ada pengumuman otomatis.
 */
class PerpanjanganJadwalService
{
    public const BATAS_HARI = 14;

    public function __construct(
        private PembatalanTurnamenService $pembatalan,
        private BracketService $bracket
    ) {
    }

    public function alasanTidakBisa(Turnamen $turnamen): ?string
    {
        if ($turnamen->sudahBerakhir()) {
            return $turnamen->pesanBerakhir();
        }

        if ($this->pembatalan->pengajuanMenunggu($turnamen)) {
            return 'Jadwal tidak dapat diperpanjang karena ada pengajuan pembatalan yang menunggu verifikasi Admin.';
        }

        if ($this->pembatalan->adaPertandinganBerskor($turnamen)) {
            return 'Jadwal tidak dapat diperpanjang karena sudah ada pertandingan yang memiliki skor.';
        }

        $laporanMenunggu = LaporanHasilPertandingan::menunggu()
            ->whereHas('pertandingan.bracket', fn ($q) => $q->where('id_turnamen', $turnamen->id_turnamen))
            ->exists();
        if ($laporanMenunggu) {
            return 'Jadwal tidak dapat diperpanjang karena masih ada laporan hasil pertandingan yang menunggu verifikasi.';
        }

        if (!$turnamen->jadwalPendaftaranTutupAwal() || !$turnamen->jadwalMainAwal()) {
            return 'Jadwal awal turnamen tidak ditemukan.';
        }

        return null;
    }

    /** Perbandingan jadwal per menit (input datetime-local FE tanpa detik). */
    private function menit($tanggal): Carbon
    {
        return Carbon::parse($tanggal)->setTimezone(config('app.timezone'))->startOfMinute();
    }

    public function batasTutupPendaftaran(Turnamen $turnamen): Carbon
    {
        return Carbon::parse($turnamen->jadwalPendaftaranTutupAwal())->addDays(self::BATAS_HARI);
    }

    public function batasMain(Turnamen $turnamen): Carbon
    {
        return Carbon::parse($turnamen->jadwalMainAwal())->addDays(self::BATAS_HARI);
    }

    /**
     * @return array<string, string>  field => pesan (kosong = valid)
     */
    public function validasi(Turnamen $turnamen, Carbon $tutupBaru, Carbon $mainBaru): array
    {
        $errors = [];
        $tutupAktif = $this->menit($turnamen->jadwalPendaftaranTutupAktif());
        $mainAktif = $this->menit($turnamen->jadwalMainAktif());
        $tutupBaru = $this->menit($tutupBaru);
        $mainBaru = $this->menit($mainBaru);
        $format = fn (Carbon $c) => $c->locale('id')->translatedFormat('d M Y H:i');

        $tutupBerubah = !$tutupBaru->equalTo($tutupAktif);
        $mainBerubah = !$mainBaru->equalTo($mainAktif);

        if ($tutupBaru->lt($tutupAktif)) {
            $errors['jadwal_pendaftaran_tutup_baru'] = 'Jadwal tutup pendaftaran baru tidak boleh lebih awal dari jadwal saat ini (' . $format($tutupAktif) . ').';
        } elseif ($tutupBaru->gt($this->batasTutupPendaftaran($turnamen))) {
            $errors['jadwal_pendaftaran_tutup_baru'] = 'Jadwal tutup pendaftaran baru maksimal 14 hari dari jadwal awal (paling lambat ' . $format($this->batasTutupPendaftaran($turnamen)) . ').';
        } elseif ($tutupBerubah && $tutupBaru->lte(now())) {
            $errors['jadwal_pendaftaran_tutup_baru'] = 'Jadwal tutup pendaftaran baru harus setelah waktu sekarang.';
        }

        if ($mainBaru->lt($mainAktif)) {
            $errors['jadwal_main_baru'] = 'Jadwal main baru tidak boleh lebih awal dari jadwal saat ini (' . $format($mainAktif) . ').';
        } elseif ($mainBaru->gt($this->batasMain($turnamen))) {
            $errors['jadwal_main_baru'] = 'Jadwal main baru maksimal 14 hari dari jadwal awal (paling lambat ' . $format($this->batasMain($turnamen)) . ').';
        } elseif ($mainBerubah && $mainBaru->lte(now())) {
            $errors['jadwal_main_baru'] = 'Jadwal main baru harus setelah waktu sekarang.';
        } elseif ($mainBaru->lt($tutupBaru->copy()->addDay())) {
            $errors['jadwal_main_baru'] = 'Jadwal main minimal 1 hari setelah jadwal tutup pendaftaran.';
        }

        if (!$errors && !$tutupBerubah && !$mainBerubah) {
            $errors['jadwal_main_baru'] = 'Tidak ada jadwal yang diperpanjang. Ubah minimal salah satu jadwal.';
        }

        return $errors;
    }

    /**
     * Simpan jadwal baru + terapkan efeknya. Panggil di dalam DB::transaction
     * dengan baris turnamen terkunci.
     *
     * @return array{pendaftaran_dibuka_kembali: bool, bracket_kembali_draft: bool, status_sebelumnya: string, status_sekarang: string}
     */
    public function terapkan(Turnamen $turnamen, Carbon $tutupBaru, Carbon $mainBaru): array
    {
        $tutupAktifAsli = Carbon::parse($turnamen->jadwalPendaftaranTutupAktif());
        $tutupAktif = $this->menit($tutupAktifAsli);
        $mainAktif = $this->menit($turnamen->jadwalMainAktif());
        $tutupBaru = $this->menit($tutupBaru);
        $mainBaru = $this->menit($mainBaru);
        $statusSebelumnya = $turnamen->status;

        $tutupBerubah = !$tutupBaru->equalTo($tutupAktif);
        $mainBerubah = !$mainBaru->equalTo($mainAktif);

        $turnamen->update([
            'jadwal_pendaftaran_tutup_baru' => $tutupBerubah ? $tutupBaru : $turnamen->jadwal_pendaftaran_tutup_baru,
            'jadwal_main_baru' => $mainBerubah ? $mainBaru : $turnamen->jadwal_main_baru,
        ]);

        // Pendaftaran dibuka kembali kalau tutup pendaftaran sebelumnya sudah lewat
        // atau bracket sudah dipublikasikan (SA B4).
        $bracket = $this->bracket->bracketDari($turnamen);
        $bracketDipublikasikan = $bracket && !$bracket->isDraft();
        $dibukaKembali = $tutupBerubah && $tutupBaru->gt(now())
            && (now()->gte($tutupAktifAsli) || $bracketDipublikasikan);

        $kembaliDraft = $bracketDipublikasikan
            && ($tutupBerubah || ($mainBerubah && $statusSebelumnya === 'berlangsung'));

        if ($kembaliDraft) {
            $bracket->update([
                'status_bracket' => BracketTurnamen::STATUS_DRAFT,
                'tanggal_publikasi' => null,
            ]);
        }

        if ($statusSebelumnya === 'berlangsung') {
            $turnamen->update(['status' => 'pendaftaran']);
        }

        return [
            'pendaftaran_dibuka_kembali' => $dibukaKembali,
            'bracket_kembali_draft' => $kembaliDraft,
            'status_sebelumnya' => $statusSebelumnya,
            'status_sekarang' => $turnamen->status,
        ];
    }

    public function info(Turnamen $turnamen): array
    {
        $alasan = $this->alasanTidakBisa($turnamen);
        $adaJadwal = $turnamen->jadwalPendaftaranTutupAwal() && $turnamen->jadwalMainAwal();

        return [
            'turnamen' => [
                'id_turnamen' => $turnamen->id_turnamen,
                'nama_turnamen' => $turnamen->pengajuan?->nama_turnamen,
                'status' => $turnamen->status,
                'pendaftaran_terbuka' => !$this->bracket->pendaftaranSudahTutup($turnamen),
            ],
            'bisa_perpanjang' => $alasan === null,
            'alasan_tidak_bisa_perpanjang' => $alasan,
            'sudah_diperpanjang' => $turnamen->sudahDiperpanjang(),
            'jadwal_awal' => [
                'jadwal_pendaftaran_tutup' => $turnamen->jadwalPendaftaranTutupAwal(),
                'jadwal_main' => $turnamen->jadwalMainAwal(),
            ],
            'jadwal_aktif' => [
                'jadwal_pendaftaran_tutup' => $turnamen->jadwalPendaftaranTutupAktif(),
                'jadwal_main' => $turnamen->jadwalMainAktif(),
            ],
            'batas_maksimal' => $adaJadwal ? [
                'jadwal_pendaftaran_tutup' => $this->batasTutupPendaftaran($turnamen),
                'jadwal_main' => $this->batasMain($turnamen),
            ] : null,
        ];
    }
}
