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
    // ==========================================
    // SYARAT PEMBENTUKAN
    // ==========================================

    public function pendaftaranSudahTutup(Turnamen $turnamen): bool
    {
        $pengajuan = $turnamen->pengajuan;
        $tutup = $pengajuan?->jadwal_pendaftaran_tutup ?? $pengajuan?->jadwal_main;

        return $tutup !== null && now()->gte(Carbon::parse($tutup));
    }

    public function jumlahMenunggu(Turnamen $turnamen): int
    {
        return PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->where('status_pendaftaran', 'menunggu')
            ->count();
    }

    public function jumlahDiterima(Turnamen $turnamen): int
    {
        return PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->where('status_pendaftaran', 'diterima')
            ->count();
    }

    /**
     * Alasan bracket belum bisa dibentuk, atau null kalau bisa.
     */
    public function alasanBelumBisaDibentuk(Turnamen $turnamen): ?string
    {
        if ($turnamen->status === 'selesai') {
            return 'Turnamen sudah selesai.';
        }

        if (!$this->pendaftaranSudahTutup($turnamen)) {
            return 'Bracket dibentuk otomatis setelah pendaftaran ditutup.';
        }

        $menunggu = $this->jumlahMenunggu($turnamen);
        if ($menunggu > 0) {
            return "Masih ada {$menunggu} pendaftaran yang menunggu verifikasi. Verifikasi terlebih dahulu sebelum membentuk bracket.";
        }

        if ($this->jumlahDiterima($turnamen) < 2) {
            return 'Bracket membutuhkan minimal 2 peserta yang diterima.';
        }

        return null;
    }

    // ==========================================
    // PEMBENTUKAN, ACAK, PUBLIKASI
    // ==========================================

    /**
     * Bracket turnamen ini. Kalau belum ada dan syarat terpenuhi,
     * dibentuk otomatis (draft) sesuai urutan daftar peserta.
     * Panggil di dalam DB::transaction setelah baris turnamen dikunci.
     */
    public function bentukJikaBisa(Turnamen $turnamen): ?BracketTurnamen
    {
        $bracket = BracketTurnamen::where('id_turnamen', $turnamen->id_turnamen)->first();
        if ($bracket) {
            return $bracket;
        }

        if ($this->alasanBelumBisaDibentuk($turnamen) !== null) {
            return null;
        }

        // R6.26: diisi berurutan sesuai urutan daftar peserta.
        $peserta = $this->pesertaDiterima($turnamen);

        $bracket = BracketTurnamen::create([
            'id_turnamen' => $turnamen->id_turnamen,
            'status_bracket' => BracketTurnamen::STATUS_DRAFT,
        ]);

        $this->buatStruktur($bracket, $peserta->count());
        $this->isiPeserta($bracket, $peserta);

        return $bracket;
    }

    /**
     * US45: acak posisi Squad selama bracket masih draft.
     * Status pendaftaran tidak berubah, babak (nama & jadwal) tetap.
     */
    public function acak(BracketTurnamen $bracket): void
    {
        $turnamen = $bracket->turnamen;

        $peserta = $this->pesertaDiterima($turnamen)->shuffle()->values();

        $this->isiPeserta($bracket, $peserta);
    }

    /**
     * US46: publikasi bracket. Turnamen baru "berlangsung" kalau
     * jadwal_main sudah tiba (lihat mulaiJikaSiap).
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
     * Mengubah status turnamen menjadi "berlangsung" kalau semua syarat
     * terpenuhi: jadwal_main tiba, tidak ada pendaftaran menunggu,
     * bracket terbentuk (dipublikasikan otomatis kalau masih draft).
     * Tidak pernah menerima pendaftaran secara otomatis.
     * Panggil di dalam DB::transaction setelah baris turnamen dikunci.
     */
    public function mulaiJikaSiap(Turnamen $turnamen): bool
    {
        if ($turnamen->status !== 'pendaftaran') {
            return false;
        }

        $jadwalMain = $turnamen->pengajuan?->jadwal_main;
        if (!$jadwalMain || now()->lt(Carbon::parse($jadwalMain))) {
            return false;
        }

        $bracket = $this->bentukJikaBisa($turnamen);
        if (!$bracket) {
            return false;
        }

        $this->publikasikan($bracket);

        $turnamen->update(['status' => 'berlangsung']);

        return true;
    }

    /**
     * Dipanggil scheduler tiap menit (command turnamen:mulai).
     *
     * @return int jumlah turnamen yang dimulai
     */
    public function prosesTurnamenSiapMulai(): int
    {
        $kandidat = Turnamen::where('status', 'pendaftaran')
            ->whereHas('pengajuan', fn ($q) => $q->where('jadwal_main', '<=', now()))
            ->pluck('id_turnamen');

        $dimulai = 0;

        foreach ($kandidat as $idTurnamen) {
            $dimulai += DB::transaction(function () use ($idTurnamen) {
                $turnamen = Turnamen::whereKey($idTurnamen)->lockForUpdate()->first();
                $turnamen?->load('pengajuan');

                return $turnamen && $this->mulaiJikaSiap($turnamen) ? 1 : 0;
            });
        }

        return $dimulai;
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
    // FORMAT RESPONSE
    // ==========================================

    /**
     * Bracket lengkap per babak. $idPendaftaranSaya dipakai untuk
     * menandai pertandingan Squad milik user (PB-14).
     */
    public function formatBracket(BracketTurnamen $bracket, ?int $idPendaftaranSaya = null): array
    {
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
            'tanggal_publikasi' => $bracket->tanggal_publikasi,
            'jumlah_peserta' => $jumlahPeserta,
            'jumlah_slot' => $this->ukuranBracket(max(2, $jumlahPeserta)),

            'babak' => $bracket->babak->map(fn (BabakTurnamen $b) => [
                'id_babak' => $b->id_babak,
                'urutan_babak' => $b->urutan_babak,
                'nama_babak' => $b->nama_babak,
                'waktu_mulai' => $b->waktu_mulai,
                'is_perebutan_juara_3' => $idJuara3 !== null
                    && $b->pertandingan->contains('id_pertandingan', $idJuara3),

                'pertandingan' => $b->pertandingan->map(fn (Pertandingan $p) => [
                    'id_pertandingan' => $p->id_pertandingan,
                    'nomor_pertandingan' => $p->nomor_pertandingan,
                    'status_pertandingan' => $p->status_pertandingan,
                    'is_bye' => $p->is_bye,
                    'squad_a' => $this->formatSlot($p->pendaftaranA),
                    'squad_b' => $this->formatSlot($p->pendaftaranB),
                    'skor_a' => $p->skor_a,
                    'skor_b' => $p->skor_b,
                    'id_pendaftaran_pemenang' => $p->id_pendaftaran_pemenang,
                    'id_pertandingan_selanjutnya' => $p->id_pertandingan_selanjutnya,
                    'posisi_pemenang_selanjutnya' => $p->posisi_pemenang_selanjutnya,
                    'id_pertandingan_kalah_selanjutnya' => $p->id_pertandingan_kalah_selanjutnya,
                    'posisi_kalah_selanjutnya' => $p->posisi_kalah_selanjutnya,
                    'melibatkan_squad_saya' => $idPendaftaranSaya !== null && in_array(
                        $idPendaftaranSaya,
                        [(int) $p->id_pendaftaran_a, (int) $p->id_pendaftaran_b],
                        true
                    ),
                ])->values(),
            ])->values(),
        ];
    }

    private function formatSlot(?PendaftaranTurnamen $p): ?array
    {
        if (!$p) {
            return null;
        }

        return [
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
?>