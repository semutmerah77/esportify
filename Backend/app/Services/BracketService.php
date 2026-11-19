<?php

namespace App\Services;

use App\Models\BabakTurnamen;
use App\Models\BracketTurnamen;
use App\Models\PendaftaranTurnamen;
use App\Models\Pertandingan;
use App\Models\Turnamen;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Satu tempat untuk aturan bracket (PB-13, PB-14):
 * pembentukan otomatis, acak, publikasi, dan mulai turnamen.
 *
 * Format: single elimination. Jumlah slot = pangkat dua terdekat
 * di atas jumlah peserta, sisanya bye. Perebutan Juara 3 dibuat
 * kalau peserta >= 4.
 */
class BracketService
{
    public const GRACE_PERIOD_MENIT = 60;

    // ==========================================
    // KONDISI TURNAMEN
    // ==========================================

    /**
     * Pendaftaran ditutup berdasarkan jadwal_pendaftaran_tutup (bukan turnamen.status).
     */
    public function pendaftaranSudahTutup(Turnamen $turnamen): bool
    {
        $pengajuan = $turnamen->pengajuan;
        $tutup = $pengajuan?->jadwal_pendaftaran_tutup ?? $pengajuan?->jadwal_main;

        return $tutup !== null && now()->gte(Carbon::parse($tutup));
    }

    public function jadwalMainSudahTiba(Turnamen $turnamen): bool
    {
        $jadwalMain = $turnamen->pengajuan?->jadwal_main;

        return $jadwalMain !== null && now()->gte(Carbon::parse($jadwalMain));
    }

    /**
     * Untuk endpoint daftar (Turnamen Kelolaan, Turnamen Saya):
     * muat bracket dan hitungan pendaftaran untuk semua turnamen sekaligus,
     * supaya infoPersiapan() dan slotTerisi() tidak query per turnamen.
     *
     * @param  \Illuminate\Database\Eloquent\Builder|\Illuminate\Database\Eloquent\Relations\Relation  $query
     */
    public function muatInfoPersiapan($query)
    {
        return $query->with('bracket')->withCount([
            'pendaftaran as info_jumlah_menunggu' => fn ($q) => $q->where('status_pendaftaran', 'menunggu'),
            'pendaftaran as info_jumlah_diterima' => fn ($q) => $q->where('status_pendaftaran', 'diterima'),
            'pendaftaran as slot_terisi' => fn ($q) => $q->aktif(),
        ]);
    }

    public function jumlahMenunggu(Turnamen $turnamen): int
    {
        if (array_key_exists('info_jumlah_menunggu', $turnamen->getAttributes())) {
            return (int) $turnamen->getAttributes()['info_jumlah_menunggu'];
        }

        return PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->where('status_pendaftaran', 'menunggu')
            ->count();
    }

    public function jumlahDiterima(Turnamen $turnamen): int
    {
        if (array_key_exists('info_jumlah_diterima', $turnamen->getAttributes())) {
            return (int) $turnamen->getAttributes()['info_jumlah_diterima'];
        }

        return PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->where('status_pendaftaran', 'diterima')
            ->count();
    }

    public function bracketDari(Turnamen $turnamen): ?BracketTurnamen
    {
        // Sudah dimuat lewat muatInfoPersiapan()
        if ($turnamen->relationLoaded('bracket')) {
            return $turnamen->getRelation('bracket');
        }

        return BracketTurnamen::where('id_turnamen', $turnamen->id_turnamen)->first();
    }

    /**
     * Alasan bracket tidak bisa dipublikasikan (dipakai publikasi manual,
     * scheduler, dan tampilan), atau null kalau bisa.
     */
    public function alasanTidakBisaDipublikasikan(Turnamen $turnamen, ?BracketTurnamen $bracket): ?string
    {
        if ($turnamen->sudahBerakhir()) {
            return $turnamen->pesanBerakhir();
        }

        if ($bracket && !$bracket->isDraft()) {
            return 'Bracket sudah dipublikasikan.';
        }

        if (!$this->pendaftaranSudahTutup($turnamen)) {
            return 'Pendaftaran turnamen masih dibuka. Bracket hanya dapat dipublikasikan setelah pendaftaran ditutup.';
        }

        $menunggu = $this->jumlahMenunggu($turnamen);
        if ($menunggu > 0) {
            return "Masih ada {$menunggu} pendaftaran yang menunggu verifikasi. Selesaikan seluruh verifikasi terlebih dahulu sebelum memublikasikan bracket.";
        }

        if (!$bracket) {
            return $this->jumlahDiterima($turnamen) === 0
                ? 'Bracket belum dapat dipublikasikan karena belum ada pendaftaran yang diterima.'
                : 'Bracket belum siap dipublikasikan. Sistem belum berhasil membentuk bracket. Silakan coba kembali.';
        }

        return null;
    }

    /**
     * Awal grace period 1 jam:
     * - verifikasi selesai sebelum jadwal_main → saat jadwal_main tiba;
     * - verifikasi selesai setelah jadwal_main → saat verifikasi terakhir.
     * Null kalau jadwal_main belum tiba atau masih ada pendaftaran menunggu.
     */
    public function awalGracePeriod(Turnamen $turnamen): ?Carbon
    {
        if (!$this->jadwalMainSudahTiba($turnamen) || $this->jumlahMenunggu($turnamen) > 0) {
            return null;
        }

        $jadwalMain = Carbon::parse($turnamen->pengajuan->jadwal_main);

        $verifikasiTerakhir = PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->whereIn('status_pendaftaran', ['diterima', 'ditolak'])
            ->max('tanggal_verifikasi');

        if ($verifikasiTerakhir && Carbon::parse($verifikasiTerakhir)->gt($jadwalMain)) {
            return Carbon::parse($verifikasiTerakhir);
        }

        return $jadwalMain;
    }

    public function batasPublikasiOtomatis(Turnamen $turnamen): ?Carbon
    {
        return $this->awalGracePeriod($turnamen)?->copy()->addMinutes(self::GRACE_PERIOD_MENIT);
    }

    /**
     * Indikator tampilan untuk FE (tidak disimpan di DB), sesuai catatan
     * final SA bagian 13: badge pendaftaran, jumlah menunggu, persiapan
     * tertunda, countdown grace period, kesiapan publikasi, pengingat H-1.
     */
    public function infoPersiapan(Turnamen $turnamen): array
    {
        $turnamen->loadMissing('pengajuan');

        $bracket = $this->bracketDari($turnamen);
        $menunggu = $this->jumlahMenunggu($turnamen);
        $alasanPublikasi = $this->alasanTidakBisaDipublikasikan($turnamen, $bracket);

        // Hanya relevan sebelum bracket dipublikasikan & setelah jadwal_main tiba.
        $belumMulai = $turnamen->status === 'pendaftaran'
            && !($bracket && !$bracket->isDraft())
            && $this->jadwalMainSudahTiba($turnamen);

        $tertunda = $belumMulai && ($menunggu > 0 || !$bracket);

        // Countdown hanya selama grace period berjalan.
        $batas = $belumMulai && !$tertunda ? $this->batasPublikasiOtomatis($turnamen) : null;

        return [
            'pendaftaran_ditutup' => $this->pendaftaranSudahTutup($turnamen),
            'jumlah_menunggu' => $menunggu,

            'persiapan_tertunda' => $tertunda,
            'alasan_tertunda' => $tertunda
                ? ($menunggu > 0
                    ? 'Publikasi otomatis tertunda karena masih terdapat pendaftaran yang belum diverifikasi. Selesaikan seluruh verifikasi terlebih dahulu.'
                    : $alasanPublikasi)
                : null,

            'batas_publikasi_otomatis' => $batas,
            'sisa_detik_publikasi_otomatis' => $batas ? max(0, (int) now()->diffInSeconds($batas, false)) : null,

            'bisa_dipublikasikan' => $alasanPublikasi === null,
            'alasan_tidak_bisa_dipublikasikan' => $alasanPublikasi,

            'pengingat_h1' => $this->pengingatH1($turnamen, $bracket, $menunggu),
            'waktu_server' => now(),
        ];
    }

    /**
     * Pengingat H-1 di Turnamen Kelolaan (24 jam sebelum jadwal_main).
     */
    private function pengingatH1(Turnamen $turnamen, ?BracketTurnamen $bracket, int $menunggu): ?array
    {
        $jadwalMain = $turnamen->pengajuan?->jadwal_main;

        if ($turnamen->status !== 'pendaftaran' || !$jadwalMain) {
            return null;
        }

        $jadwalMain = Carbon::parse($jadwalMain);
        if (now()->gte($jadwalMain) || now()->lt($jadwalMain->copy()->subDay())) {
            return null;
        }

        $prioritas = match (true) {
            $menunggu > 0 => 'verifikasi',
            $bracket === null => 'pembentukan_bracket',
            $bracket->isDraft() => 'publikasi',
            default => 'selesai',
        };

        return [
            'pesan' => 'Jadwal pertandingan tinggal 1 hari lagi. Pastikan seluruh persiapan turnamen telah selesai, termasuk verifikasi pendaftaran (jika diperlukan), pembentukan bracket, dan publikasi bracket sebelum pertandingan dimulai.',
            'prioritas' => $prioritas,
            'keterangan' => match ($prioritas) {
                'verifikasi' => "Masih ada {$menunggu} pendaftaran yang menunggu verifikasi.",
                'pembentukan_bracket' => 'Bracket belum terbentuk karena belum ada pendaftaran yang diterima.',
                'publikasi' => 'Bracket masih draft. Publikasikan bracket setelah pendaftaran ditutup.',
                default => 'Persiapan bracket sudah selesai.',
            },
        ];
    }

    // ==========================================
    // PEMBENTUKAN, ACAK, PUBLIKASI
    // ==========================================

    /**
     * Bracket draft dibentuk/disesuaikan otomatis dari pendaftaran yang
     * diterima (tidak menunggu pendaftaran ditutup). Idempotent.
     * - belum ada bracket & ada peserta → dibentuk;
     * - peserta berubah selama draft → disesuaikan (urutan lama dipertahankan,
     *   peserta baru di belakang; struktur dibangun ulang kalau ukurannya berubah);
     * - sudah dipublikasikan → tidak diubah.
     * Mengunci baris turnamen supaya tidak terbentuk dobel.
     */
    public function sinkronkanBracket(Turnamen $turnamen): ?BracketTurnamen
    {
        Turnamen::whereKey($turnamen->id_turnamen)->lockForUpdate()->first();

        $bracket = $this->bracketDari($turnamen);

        if ($turnamen->sudahBerakhir() || ($bracket && !$bracket->isDraft())) {
            return $bracket;
        }

        $peserta = $this->pesertaDiterima($turnamen);
        if ($peserta->isEmpty()) {
            return $bracket;
        }

        if (!$bracket) {
            $bracket = BracketTurnamen::create([
                'id_turnamen' => $turnamen->id_turnamen,
                'status_bracket' => BracketTurnamen::STATUS_DRAFT,
            ]);

            $this->buatStruktur($bracket, $peserta->count());
            $this->isiPeserta($bracket, $peserta);

            return $bracket;
        }

        $idSeedLama = PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->whereNotNull('nomor_seed')
            ->orderBy('nomor_seed')
            ->pluck('id_pendaftaran');

        $idPeserta = $peserta->pluck('id_pendaftaran');

        if ($idSeedLama->sort()->values()->all() === $idPeserta->sort()->values()->all()) {
            return $bracket;
        }

        // Urutan lama (hasil acak) dipertahankan, peserta baru di belakang.
        $urut = $idSeedLama->intersect($idPeserta)->values()
            ->merge($idPeserta->diff($idSeedLama)->values());
        $pesertaUrut = $urut->map(fn ($id) => $peserta->firstWhere('id_pendaftaran', $id))->values();

        $jumlahLama = $idSeedLama->count();
        $jumlahBaru = $pesertaUrut->count();
        $strukturSama = $jumlahLama > 0
            && $this->ukuranBracket($jumlahLama) === $this->ukuranBracket($jumlahBaru)
            && ($jumlahLama >= 4) === ($jumlahBaru >= 4);

        if (!$strukturSama) {
            Pertandingan::where('id_bracket', $bracket->id_bracket)->delete();
            BabakTurnamen::where('id_bracket', $bracket->id_bracket)->delete();
            $this->buatStruktur($bracket, $jumlahBaru);
        }

        $this->isiPeserta($bracket, $pesertaUrut);

        return $bracket;
    }

    /**
     * US45: acak posisi Squad selama bracket masih draft.
     * Status pendaftaran tidak berubah, babak (nama & jadwal) tetap.
     */
    public function acak(BracketTurnamen $bracket): void
    {
        $peserta = $this->pesertaDiterima($bracket->turnamen)->shuffle()->values();

        $this->isiPeserta($bracket, $peserta);
    }

    /**
     * US46: publikasi bracket (manual / otomatis). Syarat dicek pemanggil
     * lewat alasanTidakBisaDipublikasikan.
     */
    public function publikasikan(BracketTurnamen $bracket): void
    {
        if (!$bracket->isDraft()) {
            return;
        }

        $bracket->update([
            'status_bracket' => BracketTurnamen::STATUS_DIPUBLIKASIKAN,
            'tanggal_publikasi' => now(),
        ]);
    }

    /**
     * Status "berlangsung" hanya kalau jadwal_main sudah tiba dan
     * bracket sudah dipublikasikan.
     */
    public function terapkanBerlangsung(Turnamen $turnamen): bool
    {
        $bracket = $this->bracketDari($turnamen);

        if ($turnamen->status !== 'pendaftaran' || !$bracket || $bracket->isDraft()
            || !$this->jadwalMainSudahTiba($turnamen)) {
            return false;
        }

        $turnamen->update(['status' => 'berlangsung']);

        return true;
    }

    /**
     * Proses otomatis satu turnamen (scheduler). Panggil di dalam DB::transaction.
     * 1. sinkronkan bracket draft dengan peserta diterima;
     * 2. sudah dipublikasikan & jadwal_main tiba → berlangsung;
     * 3. belum dipublikasikan → publikasi otomatis kalau grace period habis
     *    dan semua syarat publikasi terpenuhi (tidak pernah menerima
     *    pendaftaran otomatis).
     *
     * @return string|null 'dipublikasikan' | 'berlangsung' | null
     */
    public function prosesOtomatis(Turnamen $turnamen): ?string
    {
        if ($turnamen->status !== 'pendaftaran') {
            return null;
        }

        $bracket = $this->sinkronkanBracket($turnamen);

        if ($this->terapkanBerlangsung($turnamen)) {
            return 'berlangsung';
        }

        if (!$this->jadwalMainSudahTiba($turnamen)
            || $this->alasanTidakBisaDipublikasikan($turnamen, $bracket) !== null) {
            return null;
        }

        $batas = $this->batasPublikasiOtomatis($turnamen);
        if (!$batas || now()->lt($batas)) {
            return null;
        }

        $this->publikasikan($bracket);
        $this->terapkanBerlangsung($turnamen);

        return 'dipublikasikan';
    }

    /**
     * Dipanggil scheduler tiap menit (command turnamen:mulai).
     *
     * @return array{dipublikasikan:int, berlangsung:int}
     */
    public function prosesSemuaTurnamen(): array
    {
        $hasil = ['dipublikasikan' => 0, 'berlangsung' => 0];

        $kandidat = Turnamen::where('status', 'pendaftaran')->pluck('id_turnamen');

        foreach ($kandidat as $idTurnamen) {
            $status = DB::transaction(function () use ($idTurnamen) {
                $turnamen = Turnamen::with('pengajuan')->lockForUpdate()->find($idTurnamen);

                return $turnamen ? $this->prosesOtomatis($turnamen) : null;
            });

            if ($status === 'dipublikasikan') {
                $hasil['dipublikasikan']++;
                $hasil['berlangsung']++;
            } elseif ($status === 'berlangsung') {
                $hasil['berlangsung']++;
            }
        }

        return $hasil;
    }

    // ==========================================
    // STRUKTUR BRACKET
    // ==========================================

    /**
     * Membuat babak dan pertandingan kosong beserta jalurnya
     * (pemenang maju, yang kalah di semifinal ke perebutan Juara 3).
     */
    private function buatStruktur(BracketTurnamen $bracket, int $jumlahPeserta): void
    {
        $slot = $this->ukuranBracket($jumlahPeserta);
        $jumlahBabak = (int) log($slot, 2);
        $adaJuara3 = $jumlahPeserta >= 4;

        $nomor = 1;
        $idPerBabak = [];

        for ($r = 1; $r <= $jumlahBabak; $r++) {
            $isFinal = $r === $jumlahBabak;

            // Perebutan Juara 3 dibuat sebelum Final (tampil & bernomor lebih dulu).
            if ($isFinal && $adaJuara3) {
                $babakJuara3 = BabakTurnamen::create([
                    'id_bracket' => $bracket->id_bracket,
                    'urutan_babak' => $r,
                    'nama_babak' => 'Perebutan Juara 3',
                ]);

                $idJuara3 = Pertandingan::create([
                    'id_bracket' => $bracket->id_bracket,
                    'id_babak' => $babakJuara3->id_babak,
                    'nomor_pertandingan' => $nomor++,
                ])->id_pertandingan;
            }

            $babak = BabakTurnamen::create([
                'id_bracket' => $bracket->id_bracket,
                'urutan_babak' => $r,
                'nama_babak' => $this->namaBabak($slot / (2 ** ($r - 1))),
            ]);

            $jumlahPertandingan = $slot / (2 ** $r);
            for ($j = 0; $j < $jumlahPertandingan; $j++) {
                $idPerBabak[$r][$j] = Pertandingan::create([
                    'id_bracket' => $bracket->id_bracket,
                    'id_babak' => $babak->id_babak,
                    'nomor_pertandingan' => $nomor++,
                ])->id_pertandingan;
            }
        }

        // Jalur pemenang (dan yang kalah di semifinal).
        for ($r = 1; $r < $jumlahBabak; $r++) {
            foreach ($idPerBabak[$r] as $j => $idPertandingan) {
                $data = [
                    'id_pertandingan_selanjutnya' => $idPerBabak[$r + 1][intdiv($j, 2)],
                    'posisi_pemenang_selanjutnya' => $j % 2 === 0 ? 'A' : 'B',
                ];

                if ($adaJuara3 && $r === $jumlahBabak - 1) {
                    $data['id_pertandingan_kalah_selanjutnya'] = $idJuara3;
                    $data['posisi_kalah_selanjutnya'] = $j % 2 === 0 ? 'A' : 'B';
                }

                Pertandingan::whereKey($idPertandingan)->update($data);
            }
        }
    }

    /**
     * Mengosongkan semua pertandingan lalu mengisi babak pertama
     * sesuai urutan $peserta (index 0 = seed 1). Bye langsung maju.
     *
     * @param  \Illuminate\Support\Collection<int, PendaftaranTurnamen>  $peserta
     */
    private function isiPeserta(BracketTurnamen $bracket, Collection $peserta): void
    {
        $peserta = $peserta->values();

        // nomor_seed disimpan sesuai urutan baru
        PendaftaranTurnamen::where('id_turnamen', $bracket->id_turnamen)->update(['nomor_seed' => null]);
        foreach ($peserta as $i => $p) {
            PendaftaranTurnamen::whereKey($p->id_pendaftaran)->update(['nomor_seed' => $i + 1]);
        }

        Pertandingan::where('id_bracket', $bracket->id_bracket)->update([
            'id_pendaftaran_a' => null,
            'id_pendaftaran_b' => null,
            'id_pendaftaran_pemenang' => null,
            'skor_a' => null,
            'skor_b' => null,
            'is_bye' => false,
            'status_pertandingan' => Pertandingan::STATUS_MENUNGGU,
        ]);

        $jumlah = $peserta->count();
        $slot = $this->ukuranBracket($jumlah);
        $urutanSeed = $this->urutanSeed($slot);

        // Babak pertama selalu urutan 1. Perebutan Juara 3 tidak pernah di
        // urutan 1 karena hanya ada kalau peserta >= 4 (minimal 2 babak).
        $babakPertama = BabakTurnamen::where('id_bracket', $bracket->id_bracket)
            ->where('urutan_babak', 1)
            ->firstOrFail();

        $babakAwal = Pertandingan::where('id_babak', $babakPertama->id_babak)
            ->orderBy('nomor_pertandingan')
            ->get()
            ->values();

        foreach ($babakAwal as $j => $pertandingan) {
            $seedA = $urutanSeed[2 * $j];
            $seedB = $urutanSeed[2 * $j + 1];

            $idA = $seedA <= $jumlah ? $peserta[$seedA - 1]->id_pendaftaran : null;
            $idB = $seedB <= $jumlah ? $peserta[$seedB - 1]->id_pendaftaran : null;

            $pertandingan->id_pendaftaran_a = $idA;
            $pertandingan->id_pendaftaran_b = $idB;

            if ($idB === null) {
                // Bye: hanya satu Squad, langsung selesai dan maju.
                $pertandingan->is_bye = true;
                $pertandingan->id_pendaftaran_pemenang = $idA;
                $pertandingan->status_pertandingan = Pertandingan::STATUS_SELESAI;
                $pertandingan->save();

                $this->majukan($pertandingan, $idA, null);
            } else {
                $pertandingan->status_pertandingan = Pertandingan::STATUS_BERLANGSUNG;
                $pertandingan->save();
            }
        }
    }

    /**
     * Pemenang ke pertandingan selanjutnya, yang kalah (semifinal)
     * ke perebutan Juara 3.
     */
    public function majukan(Pertandingan $pertandingan, ?int $idPemenang, ?int $idKalah): void
    {
        if ($pertandingan->id_pertandingan_selanjutnya) {
            $this->isiSlot(
                $pertandingan->id_pertandingan_selanjutnya,
                $pertandingan->posisi_pemenang_selanjutnya,
                $idPemenang
            );
        }

        if ($pertandingan->id_pertandingan_kalah_selanjutnya) {
            $this->isiSlot(
                $pertandingan->id_pertandingan_kalah_selanjutnya,
                $pertandingan->posisi_kalah_selanjutnya,
                $idKalah
            );
        }
    }

    private function isiSlot(int $idPertandingan, ?string $posisi, ?int $idPendaftaran): void
    {
        $tujuan = Pertandingan::find($idPertandingan);
        if (!$tujuan || !$posisi) {
            return;
        }

        $kolom = $posisi === 'A' ? 'id_pendaftaran_a' : 'id_pendaftaran_b';
        $tujuan->{$kolom} = $idPendaftaran;

        $tujuan->status_pertandingan = match (true) {
            $tujuan->id_pendaftaran_pemenang !== null => Pertandingan::STATUS_SELESAI,
            $tujuan->keduaSquadAda() => Pertandingan::STATUS_BERLANGSUNG,
            default => Pertandingan::STATUS_MENUNGGU,
        };

        $tujuan->save();
    }

    // ==========================================
    // HASIL PERTANDINGAN (PB-14, PB-18, PB-19)
    // ==========================================

    /**
     * Alasan skor pertandingan tidak bisa diisi/dikoreksi, atau null kalau bisa.
     */
    public function alasanTidakBisaUbahSkor(Turnamen $turnamen, Pertandingan $pertandingan): ?string
    {
        if ($turnamen->sudahBerakhir()) {
            return $turnamen->pesanBerakhir();
        }

        if ($pertandingan->bracket?->isDraft()) {
            return 'Bracket belum dipublikasikan.';
        }

        if ($turnamen->status !== 'berlangsung') {
            return 'Turnamen belum berlangsung.';
        }

        if ($pertandingan->is_bye) {
            return 'Pertandingan bye tidak memiliki skor.';
        }

        if (!$pertandingan->keduaSquadAda()) {
            return 'Kedua Squad pada pertandingan ini belum ditentukan.';
        }

        if ($pertandingan->punyaSkor()) {
            return $this->alasanTidakBisaDikoreksi($pertandingan);
        }

        return null;
    }

    /**
     * R6.22: koreksi hanya selama pertandingan berikutnya (jalur pemenang,
     * dan jalur yang kalah untuk semifinal) belum memiliki skor.
     */
    public function alasanTidakBisaDikoreksi(Pertandingan $pertandingan): ?string
    {
        $berikutnya = array_filter([
            $pertandingan->id_pertandingan_selanjutnya,
            $pertandingan->id_pertandingan_kalah_selanjutnya,
        ]);

        foreach ($berikutnya as $idPertandingan) {
            if (Pertandingan::find($idPertandingan)?->punyaSkor()) {
                return 'Skor tidak dapat dikoreksi karena pertandingan berikutnya sudah memiliki skor.';
            }
        }

        return null;
    }

    /**
     * Inti penetapan hasil: simpan skor, tentukan pemenang, pemenang maju,
     * yang kalah di semifinal ke perebutan Juara 3. Dipakai update skor
     * langsung (PB-18), koreksi (PB-19), dan persetujuan laporan (PB-16).
     * Kalau koreksi mengubah pemenang, slot berikutnya ikut diganti.
     * Panggil di dalam DB::transaction. Skor tidak boleh seri.
     */
    public function tetapkanHasil(Pertandingan $pertandingan, int $skorA, int $skorB): Pertandingan
    {
        $menangA = $skorA > $skorB;

        $idPemenang = $menangA ? $pertandingan->id_pendaftaran_a : $pertandingan->id_pendaftaran_b;
        $idKalah = $menangA ? $pertandingan->id_pendaftaran_b : $pertandingan->id_pendaftaran_a;

        $pertandingan->update([
            'skor_a' => $skorA,
            'skor_b' => $skorB,
            'id_pendaftaran_pemenang' => $idPemenang,
            'status_pertandingan' => Pertandingan::STATUS_SELESAI,
        ]);

        $this->majukan($pertandingan, $idPemenang, $idKalah);

        return $pertandingan;
    }

    // ==========================================
    // FORMAT RESPONSE
    // ==========================================

    /**
     * Bracket lengkap per babak. $idPendaftaranSaya dipakai untuk
     * menandai pertandingan Squad milik user (PB-14).
     */
    /**
     * @param  int|int[]|null  $idPendaftaranSaya  pendaftaran Squad milik Player login (penanda & tidak disamarkan)
     * @param  bool  $samarkan  R6.29: bracket draft untuk peserta, identitas Squad lain disamarkan
     */
    public function formatBracket(BracketTurnamen $bracket, int|array|null $idPendaftaranSaya = null, bool $untukPenyelenggara = false, bool $samarkan = false): array
    {
        $idSaya = array_values(array_map('intval', array_filter((array) $idPendaftaranSaya)));

        $turnamen = $untukPenyelenggara ? $bracket->turnamen()->with('pengajuan')->first() : null;

        $bracket->load([
            'babak.pertandingan.pendaftaranA.squad',
            'babak.pertandingan.pendaftaranB.squad',
        ]);

        $idJuara3 = Pertandingan::where('id_bracket', $bracket->id_bracket)
            ->whereNotNull('id_pertandingan_kalah_selanjutnya')
            ->value('id_pertandingan_kalah_selanjutnya');

        $jumlahPeserta = PendaftaranTurnamen::where('id_turnamen', $bracket->id_turnamen)
            ->whereNotNull('nomor_seed')
            ->count();

        return [
            'id_bracket' => $bracket->id_bracket,
            'status_bracket' => $bracket->status_bracket,
            'deskripsi_bracket' => $bracket->deskripsi_bracket,
            'tanggal_publikasi' => $bracket->tanggal_publikasi,
            'jumlah_peserta' => $jumlahPeserta,
            'jumlah_slot' => $this->ukuranBracket(max(2, $jumlahPeserta)),

            'babak' => $bracket->babak->map(fn (BabakTurnamen $b) => [
                'id_babak' => $b->id_babak,
                'urutan_babak' => $b->urutan_babak,
                'nama_babak' => $b->nama_babak,
                // Jam saja "HH:MM" (24 jam WIB)
                'waktu_mulai' => $b->waktu_mulai ? substr($b->waktu_mulai, 0, 5) : null,
                'is_perebutan_juara_3' => $idJuara3 !== null
                    && $b->pertandingan->contains('id_pertandingan', $idJuara3),

                'pertandingan' => $b->pertandingan->map(fn (Pertandingan $p) => [
                    'id_pertandingan' => $p->id_pertandingan,
                    'nomor_pertandingan' => $p->nomor_pertandingan,
                    'status_pertandingan' => $p->status_pertandingan,
                    'is_bye' => $p->is_bye,
                    'squad_a' => $this->formatSlot($p->pendaftaranA, $samarkan, $idSaya),
                    'squad_b' => $this->formatSlot($p->pendaftaranB, $samarkan, $idSaya),
                    'skor_a' => $p->skor_a,
                    'skor_b' => $p->skor_b,
                    'id_pendaftaran_pemenang' => $samarkan && !in_array((int) $p->id_pendaftaran_pemenang, $idSaya, true)
                        ? null
                        : $p->id_pendaftaran_pemenang,
                    'id_pertandingan_selanjutnya' => $p->id_pertandingan_selanjutnya,
                    'posisi_pemenang_selanjutnya' => $p->posisi_pemenang_selanjutnya,
                    'id_pertandingan_kalah_selanjutnya' => $p->id_pertandingan_kalah_selanjutnya,
                    'posisi_kalah_selanjutnya' => $p->posisi_kalah_selanjutnya,
                    // Penyelenggara: ikon pensil (update/koreksi skor) aktif atau tidak
                    'bisa_update_skor' => $turnamen !== null
                        && $this->alasanTidakBisaUbahSkor($turnamen, $p->setRelation('bracket', $bracket)) === null,
                    'melibatkan_squad_saya' => array_intersect(
                        $idSaya,
                        [(int) $p->id_pendaftaran_a, (int) $p->id_pendaftaran_b]
                    ) !== [],
                ])->values(),
            ])->values(),
        ];
    }

    private function formatSlot(?PendaftaranTurnamen $p, bool $samarkan = false, array $idSaya = []): ?array
    {
        if (!$p) {
            return null;
        }

        // R6.29: identitas Squad lain tidak dikirim sama sekali (bukan hanya disembunyikan di FE)
        if ($samarkan && !in_array((int) $p->id_pendaftaran, $idSaya, true)) {
            return [
                'tersembunyi' => true,
                'id_pendaftaran' => null,
                'nomor_seed' => null,
                'id_squad' => null,
                'kode_squad' => null,
                'nama_squad' => 'Squad tersembunyi',
                'logo_url' => null,
            ];
        }

        return [
            'tersembunyi' => false,
            'id_pendaftaran' => $p->id_pendaftaran,
            'nomor_seed' => $p->nomor_seed,
            'id_squad' => $p->id_squad,
            'kode_squad' => $p->squad?->kode_squad,
            'nama_squad' => $p->squad?->nama_squad,
            'logo_url' => $p->squad?->logo_squad ? asset('storage/' . $p->squad->logo_squad) : null,
        ];
    }

    // ==========================================
    // HELPER
    // ==========================================

    /**
     * Pendaftaran diterima milik Player login: Squad yang roster-nya memuat Player
     * didahulukan, lalu Squad lain tempat Player menjadi anggota aktif.
     * Kosong = bukan peserta (tidak boleh melihat bracket).
     *
     * @return \Illuminate\Support\Collection<int, PendaftaranTurnamen>
     */
    public function pendaftaranPesertaPlayer(Turnamen $turnamen, int $idPlayer): Collection
    {
        return PendaftaranTurnamen::with('squad')
            ->where('id_turnamen', $turnamen->id_turnamen)
            ->where('status_pendaftaran', 'diterima')
            ->where(fn ($q) => $q
                ->whereHas('anggota', fn ($a) => $a->where('id_player', $idPlayer))
                ->orWhereHas('squad.anggotaAktif', fn ($a) => $a->where('id_player', $idPlayer)))
            ->withExists(['anggota as di_roster' => fn ($a) => $a->where('id_player', $idPlayer)])
            ->get()
            ->sortByDesc('di_roster')
            ->values();
    }

    /**
     * @return \Illuminate\Support\Collection<int, PendaftaranTurnamen>
     */
    public function pesertaDiterima(Turnamen $turnamen): Collection
    {
        return PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->where('status_pendaftaran', 'diterima')
            ->orderBy('tanggal_verifikasi')
            ->orderBy('id_pendaftaran')
            ->get();
    }

    /** Pangkat dua terdekat (6 peserta → 8 slot). */
    public function ukuranBracket(int $jumlahPeserta): int
    {
        $slot = 2;
        while ($slot < $jumlahPeserta) {
            $slot *= 2;
        }

        return $slot;
    }

    /**
     * Urutan seed standar per slot, supaya bye tidak bertemu bye
     * dan bye jatuh ke seed teratas. 8 slot: 1,8,4,5,2,7,3,6.
     *
     * @return int[]
     */
    private function urutanSeed(int $slot): array
    {
        $urutan = [1, 2];

        while (count($urutan) < $slot) {
            $total = count($urutan) * 2 + 1;
            $baru = [];
            foreach ($urutan as $seed) {
                $baru[] = $seed;
                $baru[] = $total - $seed;
            }
            $urutan = $baru;
        }

        return $urutan;
    }

    private function namaBabak(int $jumlahSlotBabak): string
    {
        return match ($jumlahSlotBabak) {
            2 => 'Final',
            4 => 'Semifinal',
            8 => 'Perempat Final',
            default => "Babak {$jumlahSlotBabak} Besar",
        };
    }
}
