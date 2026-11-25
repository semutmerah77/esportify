<?php

namespace App\Services;

use App\Models\Admin;
use App\Models\AnggotaPendaftaranTurnamen;
use App\Models\BuktiPembatalanTurnamen;
use App\Models\PendaftaranTurnamen;
use App\Models\PengajuanPembatalanTurnamen;
use App\Models\Pertandingan;
use App\Models\Notification;
use App\Models\Turnamen;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Aturan pembatalan turnamen (PB-25, US59 & US60, R7.07 s.d. R7.10).
 *
 * - Penyelenggara mengajukan pembatalan dengan kategori alasan + penjelasan.
 * - Tidak boleh jika masih ada pendaftaran menunggu (R7.08), sudah ada
 *   pertandingan yang memiliki skor (keputusan SA), turnamen sudah berakhir,
 *   atau masih ada pengajuan yang menunggu keputusan Admin.
 * - Turnamen berbayar wajib mengisi rencana tanggal pengembalian dana (>= besok).
 * - Admin menyetujui -> turnamen dibatalkan & roster dibuka kembali (R2.06, R7.10).
 *   Admin menolak -> wajib alasan; penyelenggara boleh mengajukan lagi.
 */
class PembatalanTurnamenService
{
    public const ALASAN_PEMBATALAN = [
        'peserta_kurang' => 'Peserta kurang dari kuota minimum',
        'jadwal_bentrok' => 'Jadwal bentrok',
        'kendala_teknis' => 'Kendala teknis (server, platform, game)',
        'kendala_venue' => 'Kendala venue atau lokasi',
        'kendala_sponsor' => 'Kendala sponsor atau pendanaan',
        'force_majeure' => 'Bencana atau kejadian di luar kendali',
        'lainnya' => 'Lainnya',
    ];

    /** Kategori yang wajib menyertakan bukti pendukung (keputusan SA). */
    public const WAJIB_BUKTI = ['kendala_venue', 'kendala_sponsor', 'force_majeure'];

    public const ALASAN_PENOLAKAN = [
        'penjelasan_tidak_jelas' => 'Penjelasan tidak cukup jelas/detail',
        'bukti_tidak_valid' => 'Bukti pendukung tidak valid',
        'alasan_tidak_sesuai' => 'Alasan tidak sesuai dengan kondisi sebenarnya',
        'estimasi_tidak_realistis' => 'Estimasi pengembalian dana tidak realistis',
        'lainnya' => 'Lainnya',
    ];

    /** Pengajuan yang belum diproses lebih dari ini mengunci halaman Admin lain. */
    public const BATAS_HARI_VERIFIKASI = 3;

    // ==========================================
    // PENYELENGGARA
    // ==========================================

    public function berbayar(Turnamen $turnamen): bool
    {
        return DB::table('pendanaan')
            ->where('id_pengajuan', $turnamen->id_pengajuan)
            ->value('jenis_biaya') === 'berbayar';
    }

    public function pengajuanMenunggu(Turnamen $turnamen): ?PengajuanPembatalanTurnamen
    {
        return PengajuanPembatalanTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->menunggu()
            ->first();
    }

    public function adaPertandinganBerskor(Turnamen $turnamen): bool
    {
        return Pertandingan::whereHas('bracket', fn ($q) => $q->where('id_turnamen', $turnamen->id_turnamen))
            ->where('is_bye', false)
            ->where(fn ($q) => $q->whereNotNull('skor_a')->orWhereNotNull('skor_b'))
            ->exists();
    }

    public function alasanTidakBisaAjukan(Turnamen $turnamen): ?string
    {
        if ($turnamen->sudahBerakhir()) {
            return $turnamen->pesanBerakhir();
        }

        if ($this->pengajuanMenunggu($turnamen)) {
            return 'Pengajuan pembatalan sebelumnya masih menunggu verifikasi Admin.';
        }

        if (PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)->where('status_pendaftaran', 'menunggu')->exists()) {
            return 'Masih ada pendaftaran yang menunggu verifikasi. Verifikasi semua pendaftaran terlebih dahulu.';
        }

        if ($this->adaPertandinganBerskor($turnamen)) {
            return 'Pembatalan tidak dapat diajukan karena sudah ada pertandingan yang memiliki skor.';
        }

        return null;
    }

    /**
     * @param  string[]  $pathBukti
     */
    public function ajukan(Turnamen $turnamen, string $alasan, string $penjelasan, ?string $rencana, array $pathBukti): PengajuanPembatalanTurnamen
    {
        $pengajuan = PengajuanPembatalanTurnamen::create([
            'id_turnamen' => $turnamen->id_turnamen,
            'id_penyelenggara' => $turnamen->id_penyelenggara,
            'alasan_pembatalan' => $alasan,
            'penjelasan_pembatalan' => $penjelasan,
            'status_pengajuan' => PengajuanPembatalanTurnamen::STATUS_MENUNGGU,
            'rencana_pengembalian_dana' => $this->berbayar($turnamen) && $rencana
                ? Carbon::parse($rencana)->startOfDay()
                : null,
            'tanggal_pengajuan' => now(),
        ]);

        foreach ($pathBukti as $path) {
            BuktiPembatalanTurnamen::create([
                'id_pengajuan_pembatalan' => $pengajuan->id_pengajuan_pembatalan,
                'id_penyelenggara' => $turnamen->id_penyelenggara,
                'file_bukti_pendukung' => $path,
            ]);
        }

        return $pengajuan;
    }

    // ==========================================
    // ADMIN
    // ==========================================

    public function alasanTidakBisaDiverifikasi(PengajuanPembatalanTurnamen $pengajuan): ?string
    {
        if ($pengajuan->status_pengajuan !== PengajuanPembatalanTurnamen::STATUS_MENUNGGU) {
            return 'Pengajuan pembatalan sudah diverifikasi sebelumnya.';
        }

        $turnamen = $pengajuan->turnamen;
        if (!$turnamen) {
            return 'Turnamen tidak ditemukan.';
        }

        if ($turnamen->sudahBerakhir()) {
            return $turnamen->pesanBerakhir();
        }

        return null;
    }

    /**
     * Disetujui: turnamen dibatalkan & roster seluruh pendaftaran dibuka kembali.
     */
    public function setujui(PengajuanPembatalanTurnamen $pengajuan, Admin $admin): void
    {
        $pengajuan->update([
            'status_pengajuan' => PengajuanPembatalanTurnamen::STATUS_DISETUJUI,
            'id_admin' => $admin->id_admin,
            'tanggal_verifikasi' => now(),
        ]);

        $turnamen = $pengajuan->turnamen;
        $turnamen->update(['status' => Turnamen::STATUS_DIBATALKAN]);

        // R2.06
        AnggotaPendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->where('status_roster', 'terkunci')
            ->update(['status_roster' => 'terbuka', 'tanggal_pembukaan' => now()]);
            // PB-26: data refund untuk setiap peserta diterima (hanya turnamen berbayar)
            app(RefundTurnamenService::class)->buatUntukTurnamen($turnamen);

        // PB-31 (R10.07): notifikasi pembatalan ke anggota roster peserta
        Notification::buatNotifikasiTurnamenDibatalkan($turnamen, $this->berbayar($turnamen));
    }

    public function tolak(PengajuanPembatalanTurnamen $pengajuan, Admin $admin, string $catatan): void
    {
        $pengajuan->update([
            'status_pengajuan' => PengajuanPembatalanTurnamen::STATUS_DITOLAK,
            'id_admin' => $admin->id_admin,
            'catatan_admin' => $catatan,
            'tanggal_verifikasi' => now(),
        ]);
    }

    public function batasVerifikasi(PengajuanPembatalanTurnamen $pengajuan): Carbon
    {
        return Carbon::parse($pengajuan->tanggal_pengajuan)->addDays(self::BATAS_HARI_VERIFIKASI);
    }

    /** Pengajuan menunggu yang sudah melewati 3 hari (untuk forced action Admin). */
    public function pengajuanTerlambat()
    {
        return PengajuanPembatalanTurnamen::menunggu()
            ->where('tanggal_pengajuan', '<=', now()->subDays(self::BATAS_HARI_VERIFIKASI))
            ->with('turnamen.pengajuan:id_pengajuan,nama_turnamen')
            ->orderBy('tanggal_pengajuan')
            ->get();
    }

    // ==========================================
    // FORMAT RESPONSE
    // ==========================================

    public function labelAlasan(?string $kode): ?string
    {
        return $kode === null ? null : (self::ALASAN_PEMBATALAN[$kode] ?? $kode);
    }

    public function format(PengajuanPembatalanTurnamen $p, string $prefixBukti, bool $untukAdmin = false): array
    {
        $p->loadMissing(['bukti', 'turnamen.pengajuan', 'penyelenggara.player.user', 'admin.user']);
        $turnamen = $p->turnamen;

        $data = [
            'id_pengajuan_pembatalan' => $p->id_pengajuan_pembatalan,
            'id_turnamen' => $p->id_turnamen,
            'status_pengajuan' => $p->status_pengajuan,
            'alasan_pembatalan' => $p->alasan_pembatalan,
            'label_alasan_pembatalan' => $this->labelAlasan($p->alasan_pembatalan),
            'penjelasan_pembatalan' => $p->penjelasan_pembatalan,
            'rencana_pengembalian_dana' => $p->rencana_pengembalian_dana?->toDateString(),
            'catatan_admin' => $p->catatan_admin,
            'tanggal_pengajuan' => $p->tanggal_pengajuan?->toIso8601String(),
            'tanggal_verifikasi' => $p->tanggal_verifikasi?->toIso8601String(),
            'bukti' => $p->bukti->map(fn (BuktiPembatalanTurnamen $b) => [
                'id_bukti_pembatalan' => $b->id_bukti_pembatalan,
                'nama_file' => basename($b->file_bukti_pendukung),
                'jenis' => strtolower(pathinfo($b->file_bukti_pendukung, PATHINFO_EXTENSION)) === 'pdf' ? 'pdf' : 'gambar',
                'url' => "{$prefixBukti}/{$p->id_pengajuan_pembatalan}/bukti/{$b->id_bukti_pembatalan}",
            ])->values(),
        ];

        if ($untukAdmin) {
            $batas = $this->batasVerifikasi($p);
            $data['turnamen'] = [
                'id_turnamen' => $turnamen?->id_turnamen,
                'nama_turnamen' => $turnamen?->pengajuan?->nama_turnamen,
                'nama_penyelenggara' => $turnamen?->pengajuan?->nama_penyelenggara,
                'status' => $turnamen?->status,
                'jenis_biaya' => $turnamen && $this->berbayar($turnamen) ? 'berbayar' : 'gratis',
                'jumlah_peserta_diterima' => $turnamen
                    ? PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)->where('status_pendaftaran', 'diterima')->count()
                    : 0,
            ];
            $data['diajukan_oleh'] = [
                'id_player' => $p->penyelenggara?->player?->id_player,
                'username' => $p->penyelenggara?->player?->user?->username,
            ];
            $data['diverifikasi_oleh'] = $p->admin?->user?->username;
            $data['batas_verifikasi'] = $batas->toIso8601String();
            $data['melewati_batas'] = $p->status_pengajuan === PengajuanPembatalanTurnamen::STATUS_MENUNGGU && now()->gte($batas);
        }

        return $data;
    }
}
