<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * PB-30 & PB-31 — Notification (tabel notifications, Laravel Database Notifications).
 *
 * Atribut: id (uuid), type (jenis notifikasi), notifiable_type, notifiable_id,
 * data (JSON: judul, pesan, pengirim, terkait, tautan, kunci), read_at, created_at, updated_at.
 *
 * markAsRead() : void diwarisi dari DatabaseNotification (UPDATE read_at = NOW()).
 *
 * data.kunci = penanda kejadian (mis. "bracket_dipublikasikan:turnamen:7").
 * Satu kejadian hanya membuat satu notifikasi per penerima (R10.16).
 */
class Notification extends DatabaseNotification
{
    /** R10.04: notifikasi ditampilkan & disimpan 30 hari. */
    public const MASA_SIMPAN_HARI = 30;

    /** Notifikasi 30 hari terakhir (yang lebih lama tidak ditampilkan). */
    public function scopeMasihBerlaku(Builder $query): Builder
    {
        return $query->where('created_at', '>=', now()->subDays(self::MASA_SIMPAN_HARI));
    }

    /**
     * R10.04: pengelompokan Halaman Notifikasi.
     * hari_ini | 7_hari_terakhir | 30_hari_terakhir
     */
    public function kelompokWaktu(): string
    {
        if ($this->created_at->isToday()) {
            return 'hari_ini';
        }

        return $this->created_at->gte(now()->subDays(7)->startOfDay())
            ? '7_hari_terakhir'
            : '30_hari_terakhir';
    }

    /**
     * SD (Scheduler): hapusNotifikasiKedaluwarsa() : int
     * DELETE notifications WHERE created_at < NOW() - INTERVAL 30 DAY.
     */
    public static function hapusNotifikasiKedaluwarsa(): int
    {
        return static::where('created_at', '<', now()->subDays(self::MASA_SIMPAN_HARI))->delete();
    }

    // ==========================================
    // PB-31 — PEMBUAT NOTIFIKASI
    // ==========================================

    public const JENIS_PENGUMUMAN_BARU = 'pengumuman_baru';
    public const JENIS_TURNAMEN_DIBATALKAN = 'turnamen_dibatalkan';
    public const JENIS_BRACKET_DIPUBLIKASIKAN = 'bracket_dipublikasikan';
    public const JENIS_PENDAFTARAN_DITERIMA = 'pendaftaran_diterima';
    public const JENIS_PENDAFTARAN_DITOLAK = 'pendaftaran_ditolak';

    public const JENIS_JUARA_DITETAPKAN = 'juara_ditetapkan';
    public const JENIS_PERMINTAAN_BERGABUNG = 'permintaan_bergabung';
    public const JENIS_UNDANGAN_SQUAD = 'undangan_squad';
    public const JENIS_PENGAJUAN_DISETUJUI = 'pengajuan_disetujui';
    public const JENIS_PENGAJUAN_PERLU_REVISI = 'pengajuan_perlu_revisi';
    public const JENIS_PENGAJUAN_DITOLAK = 'pengajuan_ditolak';

    /** R10.15: peran pengirim. */
    public const PENGIRIM_PENYELENGGARA = 'Penyelenggara';
    public const PENGIRIM_LEADER = 'Leader';
    public const PENGIRIM_PLAYER = 'Player';
    public const PENGIRIM_ADMIN = 'Admin Platform';
    public const PENGIRIM_SISTEM = 'Sistem';

    /**
     * SD: cekNotifikasiSudahDibuat() : boolean
     * Apakah kejadian (kunci) ini sudah pernah dinotifikasikan ke user tersebut.
     */
    public static function cekNotifikasiSudahDibuat(string $kunci, int $idUser): bool
    {
        return static::where('notifiable_type', (new User())->getMorphClass())
            ->where('notifiable_id', $idUser)
            ->where('data->kunci', $kunci)
            ->exists();
    }

    /** R10.06 — anggota roster peserta (diterima) saat Penyelenggara menyimpan pengumuman baru. */
    public static function buatNotifikasiPengumumanBaru(Pengumuman $pengumuman): void
    {
        $turnamen = Turnamen::with('pengajuan:id_pengajuan,nama_turnamen,nama_penyelenggara')
            ->find($pengumuman->id_turnamen);
        if (!$turnamen) {
            return;
        }

        static::kirim(
            static::penerimaRosterPeserta($turnamen->id_turnamen),
            self::JENIS_PENGUMUMAN_BARU,
            [
                'judul' => 'Pengumuman baru',
                'pesan' => $pengumuman->judul,
                'pengirim' => static::pengirimPenyelenggara($turnamen),
                'terkait' => static::terkaitTurnamen($turnamen),
                'tautan' => "/turnamen/ikut/{$turnamen->id_turnamen}?tab=pengumuman&pengumuman={$pengumuman->id_pengumuman}",
                'id_pengumuman' => $pengumuman->id_pengumuman,
            ],
            "pengumuman_baru:pengumuman:{$pengumuman->id_pengumuman}"
        );
    }

    /**
     * R10.07 — anggota roster peserta setelah Admin menyetujui pembatalan.
     * Turnamen berbayar: ajakan mengisi data refund + tab Refund.
     */
    public static function buatNotifikasiTurnamenDibatalkan(Turnamen $turnamen, bool $berbayar): void
    {
        $turnamen->loadMissing('pengajuan:id_pengajuan,nama_turnamen,nama_penyelenggara');
        $id = $turnamen->id_turnamen;

        static::kirim(
            static::penerimaRosterPeserta($id),
            self::JENIS_TURNAMEN_DIBATALKAN,
            [
                'judul' => 'Turnamen dibatalkan',
                'pesan' => $berbayar
                    ? 'Turnamen ini dibatalkan. Silakan isi data pengembalian dana pada tab Refund.'
                    : 'Turnamen ini dibatalkan.',
                'pengirim' => ['peran' => self::PENGIRIM_ADMIN, 'nama' => 'Admin ESPORTIFY'],
                'terkait' => static::terkaitTurnamen($turnamen),
                'tautan' => $berbayar ? "/turnamen/ikut/{$id}?tab=pengembalian" : "/turnamen/ikut/{$id}",
            ],
            "turnamen_dibatalkan:turnamen:{$id}"
        );
    }

    /**
     * SD: buatNotifikasiBracketDipublikasikan() — R10.08.
     * Manual oleh Penyelenggara atau otomatis oleh sistem (scheduler turnamen:mulai).
     */
    public static function buatNotifikasiBracketDipublikasikan(Turnamen $turnamen, bool $otomatis = false): void
    {
        $turnamen->loadMissing('pengajuan:id_pengajuan,nama_turnamen,nama_penyelenggara');
        $id = $turnamen->id_turnamen;

        static::kirim(
            static::penerimaRosterPeserta($id),
            self::JENIS_BRACKET_DIPUBLIKASIKAN,
            [
                'judul' => 'Bracket dipublikasikan',
                'pesan' => 'Bracket turnamen sudah dipublikasikan. Cek jadwal dan lawan Squad kamu.',
                'pengirim' => $otomatis
                    ? ['peran' => self::PENGIRIM_SISTEM, 'nama' => 'ESPORTIFY']
                    : static::pengirimPenyelenggara($turnamen),
                'terkait' => static::terkaitTurnamen($turnamen),
                'tautan' => "/turnamen/ikut/{$id}?tab=bracket",
            ],
            "bracket_dipublikasikan:turnamen:{$id}"
        );
    }

    /**
     * R10.10 — anggota roster yang didaftarkan saat Penyelenggara memverifikasi
     * pendaftaran turnamen berbayar. Penolakan memuat alasan.
     */
    public static function buatNotifikasiHasilPendaftaran(PendaftaranTurnamen $pendaftaran): void
    {
        $diterima = $pendaftaran->status_pendaftaran === 'diterima';
        $turnamen = Turnamen::with('pengajuan:id_pengajuan,nama_turnamen,nama_penyelenggara')
            ->find($pendaftaran->id_turnamen);
        if (!$turnamen) {
            return;
        }

        $idUser = DB::table('anggota_pendaftaran_turnamen as a')
            ->join('players as pl', 'pl.id_player', '=', 'a.id_player')
            ->where('a.id_pendaftaran', $pendaftaran->id_pendaftaran)
            ->distinct()
            ->pluck('pl.id_user');

        static::kirim(
            $idUser,
            $diterima ? self::JENIS_PENDAFTARAN_DITERIMA : self::JENIS_PENDAFTARAN_DITOLAK,
            [
                'judul' => $diterima ? 'Pendaftaran diterima' : 'Pendaftaran ditolak',
                'pesan' => $diterima
                    ? 'Pendaftaran Squad kamu diterima. Squad kamu resmi menjadi peserta turnamen.'
                    : 'Pendaftaran Squad kamu ditolak. Alasan: ' . $pendaftaran->alasan_penolakan,
                'pengirim' => static::pengirimPenyelenggara($turnamen),
                'terkait' => static::terkaitTurnamen($turnamen),
                'tautan' => "/pendaftaran/{$pendaftaran->id_pendaftaran}",
                'alasan_penolakan' => $diterima ? null : $pendaftaran->alasan_penolakan,
            ],
            "pendaftaran_{$pendaftaran->status_pendaftaran}:pendaftaran:{$pendaftaran->id_pendaftaran}"
        );
    }

     /**
     * SD: buatNotifikasiJuaraDitetapkan() — R10.09.
     * Anggota roster semua Squad peserta + Penyelenggara, setelah masa koreksi
     * berakhir dan turnamen berstatus Selesai. Mengarah ke tab Bracket.
     */
    public static function buatNotifikasiJuaraDitetapkan(Turnamen $turnamen): void
    {
        $turnamen->loadMissing('pengajuan:id_pengajuan,nama_turnamen,nama_penyelenggara', 'penyelenggara.player');
        $id = $turnamen->id_turnamen;

        $juara1 = DB::table('pendaftaran_turnamen as p')
            ->join('squad as s', 's.id_squad', '=', 'p.id_squad')
            ->where('p.id_turnamen', $id)
            ->where('p.peringkat_akhir', 1)
            ->value('s.nama_squad');
        if (!$juara1) {
            return; // belum ada hasil akhir
        }

        $data = [
            'judul' => 'Juara ditetapkan',
            'pesan' => "Hasil akhir turnamen sudah ditetapkan. Juara 1: {$juara1}.",
            'pengirim' => ['peran' => self::PENGIRIM_SISTEM, 'nama' => 'ESPORTIFY'],
            'terkait' => static::terkaitTurnamen($turnamen),
        ];
        $kunci = "juara_ditetapkan:turnamen:{$id}";

        static::kirim(static::penerimaRosterPeserta($id), self::JENIS_JUARA_DITETAPKAN,
            $data + ['tautan' => "/turnamen/ikut/{$id}?tab=bracket"], $kunci);

        $idPenyelenggara = $turnamen->penyelenggara?->player?->id_user;
        if ($idPenyelenggara) {
            static::kirim([$idPenyelenggara], self::JENIS_JUARA_DITETAPKAN,
                $data + ['tautan' => "/turnamen/{$id}/kelola?tab=bracket"], $kunci);
        }
    }

    /** R10.11 — ke Leader saat Player mengajukan permintaan bergabung. */
    public static function buatNotifikasiPermintaanBergabung(PermintaanBergabung $permintaan): void
    {
        $squad = Squad::with('leader.player')->find($permintaan->id_squad);
        $idLeader = $squad?->leader?->player?->id_user;
        if (!$idLeader) {
            return;
        }

        $pemohon = Player::with('user:id_user,username')->find($permintaan->id_player);

        static::kirim(
            [$idLeader],
            self::JENIS_PERMINTAAN_BERGABUNG,
            [
                'judul' => 'Permintaan bergabung',
                'pesan' => ($pemohon?->user?->username ?? 'Seorang Player') . " ingin bergabung ke Squad {$squad->nama_squad}.",
                'pengirim' => ['peran' => self::PENGIRIM_PLAYER, 'nama' => $pemohon?->user?->username],
                'terkait' => static::terkaitSquad($squad),
                'tautan' => "/squad/{$squad->id_squad}?tab=permintaan",
                'id_permintaan' => $permintaan->id_permintaan,
            ],
            "permintaan_bergabung:permintaan:{$permintaan->id_permintaan}"
        );
    }

    /** R10.12 — ke Player yang diundang saat Leader mengirim undangan. */
    public static function buatNotifikasiUndanganSquad(UndanganSquad $undangan): void
    {
        $squad = Squad::with('leader.player.user:id_user,username')->find($undangan->id_squad);
        $idDiundang = Player::whereKey($undangan->id_player)->value('id_user');
        if (!$squad || !$idDiundang) {
            return;
        }

        $namaLeader = $squad->leader?->player?->user?->username;

        static::kirim(
            [$idDiundang],
            self::JENIS_UNDANGAN_SQUAD,
            [
                'judul' => 'Undangan Squad',
                'pesan' => ($namaLeader ?? 'Leader') . " mengundang kamu bergabung ke Squad {$squad->nama_squad}.",
                'pengirim' => ['peran' => self::PENGIRIM_LEADER, 'nama' => $namaLeader],
                'terkait' => static::terkaitSquad($squad),
                'tautan' => "/squad/{$squad->id_squad}",
                'id_undangan' => $undangan->id_undangan,
            ],
            "undangan_squad:undangan:{$undangan->id_undangan}"
        );
    }

    /**
     * R10.14 — ke Player pengaju saat Admin menyetujui, menolak, atau meminta revisi.
     * Disetujui → Kelola Turnamen; lainnya → Detail Pengajuan.
     */
    public static function buatNotifikasiHasilVerifikasiPengajuan(PengajuanTurnamen $pengajuan): void
    {
        $idPengaju = Player::whereKey($pengajuan->id_player)->value('id_user');
        if (!$idPengaju) {
            return;
        }

        $id = $pengajuan->id_pengajuan;
        $tautanDetail = "/turnamen/pengajuan/{$id}";
        $admin = ['peran' => self::PENGIRIM_ADMIN, 'nama' => 'Admin ESPORTIFY'];

        switch ($pengajuan->status) {
            case 'Disetujui':
                $idTurnamen = Turnamen::where('id_pengajuan', $id)->value('id_turnamen');
                $jenis = self::JENIS_PENGAJUAN_DISETUJUI;
                $judul = 'Pengajuan turnamen disetujui';
                $pesan = 'Pengajuan turnamen kamu disetujui. Turnamen sudah dibuat dan siap dikelola.';
                $tautan = $idTurnamen ? "/turnamen/{$idTurnamen}/kelola" : '/turnamen/kelola';
                $kunci = "pengajuan_disetujui:pengajuan:{$id}";
                break;
            case 'Revisi':
                $batas = app(\App\Services\BatasWaktuPengajuan::class)->batasRevisi($pengajuan);
                $jenis = self::JENIS_PENGAJUAN_PERLU_REVISI;
                $judul = 'Pengajuan turnamen perlu revisi';
                $pesan = 'Pengajuan turnamen kamu perlu direvisi. Catatan Admin: ' . $pengajuan->alasan_admin
                    . ($batas ? '. Kirim revisi paling lambat ' . $batas->translatedFormat('d M Y H:i') . '.' : '');
                $tautan = $tautanDetail;
                $kunci = "pengajuan_perlu_revisi:pengajuan:{$id}:" . strtotime((string) $pengajuan->revisi_diminta_pada);
                break;
            case 'Ditolak':
                $jenis = self::JENIS_PENGAJUAN_DITOLAK;
                $judul = 'Pengajuan turnamen ditolak';
                $pesan = 'Pengajuan turnamen kamu ditolak. Alasan: ' . $pengajuan->alasan_admin;
                $tautan = $tautanDetail;
                $kunci = "pengajuan_ditolak:pengajuan:{$id}:" . strtotime((string) $pengajuan->updated_at);
                break;
            default:
                return;
        }

        static::kirim([$idPengaju], $jenis, [
            'judul' => $judul,
            'pesan' => $pesan,
            'pengirim' => $admin,
            'terkait' => static::terkaitPengajuan($pengajuan),
            'tautan' => $tautan,
        ], $kunci);
    }

    /**
     * SD: buatNotifikasiPengajuanDitolak() — R10.14 & R10.16.
     * Pengajuan ditolak otomatis karena revisi tidak dikirim sampai batas waktu.
     */
    public static function buatNotifikasiPengajuanDitolak(PengajuanTurnamen $pengajuan): void
    {
        $idPengaju = Player::whereKey($pengajuan->id_player)->value('id_user');
        if (!$idPengaju) {
            return;
        }

        static::kirim([$idPengaju], self::JENIS_PENGAJUAN_DITOLAK, [
            'judul' => 'Pengajuan turnamen ditolak otomatis',
            'pesan' => $pengajuan->alasan_admin,
            'pengirim' => ['peran' => self::PENGIRIM_SISTEM, 'nama' => 'ESPORTIFY'],
            'terkait' => static::terkaitPengajuan($pengajuan),
            'tautan' => "/turnamen/pengajuan/{$pengajuan->id_pengajuan}",
        ], "pengajuan_ditolak_otomatis:pengajuan:{$pengajuan->id_pengajuan}:" . strtotime((string) $pengajuan->revisi_diminta_pada));
    }

    /**
     * SD (Scheduler): jalankanPengecekanNotifikasiOtomatis() — R10.16, tiap menit.
     * 1. Pengajuan yang revisinya lewat batas → Ditolak + notifikasi.
     * 2. Jaring pengaman: bracket dipublikasikan & juara ditetapkan dalam 24 jam terakhir
     *    yang notifikasinya belum terkirim (notifikasi utama dibuat saat prosesnya terjadi).
     * Notifikasi yang sudah ada tidak dibuat ulang.
     */
    public static function jalankanPengecekanNotifikasiOtomatis(): array
    {
        $ditolak = app(\App\Services\BatasWaktuPengajuan::class)->perbaruiSemua();

        $kemarin = now()->subDay();

        $bracket = 0;
        $idBracket = BracketTurnamen::where('status_bracket', BracketTurnamen::STATUS_DIPUBLIKASIKAN)
            ->where('tanggal_publikasi', '>=', $kemarin)
            ->pluck('id_turnamen');
        foreach (Turnamen::whereIn('id_turnamen', $idBracket)->get() as $turnamen) {
            static::buatNotifikasiBracketDipublikasikan($turnamen, true);
            $bracket++;
        }

        $juara = 0;
        foreach (Turnamen::where('status', Turnamen::STATUS_SELESAI)->where('updated_at', '>=', $kemarin)->get() as $turnamen) {
            static::buatNotifikasiJuaraDitetapkan($turnamen);
            $juara++;
        }

        return ['pengajuan_ditolak' => $ditolak, 'bracket_dicek' => $bracket, 'juara_dicek' => $juara];
    }

    /**
     * R10.13: label Diterima/Ditolak untuk notifikasi permintaan bergabung & undangan.
     * Dihitung sekaligus untuk satu halaman daftar (maks. 2 query).
     *
     * @param  iterable<Notification>  $daftar
     * @return array<string, string|null>  [id notifikasi => 'diterima'|'ditolak'|null]
     */
    public static function statusTanggapan(iterable $daftar): array
    {
        $daftar = collect($daftar);

        $idPermintaan = $daftar->where('type', self::JENIS_PERMINTAAN_BERGABUNG)
            ->map(fn ($n) => $n->data['id_permintaan'] ?? null)->filter()->unique();
        $idUndangan = $daftar->where('type', self::JENIS_UNDANGAN_SQUAD)
            ->map(fn ($n) => $n->data['id_undangan'] ?? null)->filter()->unique();

        $statusPermintaan = $idPermintaan->isEmpty() ? collect()
            : PermintaanBergabung::whereIn('id_permintaan', $idPermintaan)->pluck('status_permintaan', 'id_permintaan');
        $statusUndangan = $idUndangan->isEmpty() ? collect()
            : UndanganSquad::whereIn('id_undangan', $idUndangan)->pluck('status_undangan', 'id_undangan');

        $hasil = [];
        foreach ($daftar as $n) {
            $status = match ($n->type) {
                self::JENIS_PERMINTAAN_BERGABUNG => $statusPermintaan[$n->data['id_permintaan'] ?? 0] ?? null,
                self::JENIS_UNDANGAN_SQUAD => $statusUndangan[$n->data['id_undangan'] ?? 0] ?? null,
                default => null,
            };
            $hasil[$n->id] = in_array($status, ['diterima', 'ditolak'], true) ? $status : null;
        }

        return $hasil;
    }
    

    // ==========================================
    // HELPER
    // ==========================================

    /**
     * Membuat notifikasi untuk banyak user sekaligus (1 query cek + 1 query insert).
     * User yang sudah pernah menerima notifikasi untuk kejadian yang sama dilewati.
     */
    protected static function kirim(iterable $idUser, string $jenis, array $data, string $kunci): int
    {
        $idUser = collect($idUser)->map(fn ($id) => (int) $id)->filter()->unique()->values();
        if ($idUser->isEmpty()) {
            return 0;
        }

        $morph = (new User())->getMorphClass();

        $sudahAda = static::where('notifiable_type', $morph)
            ->whereIn('notifiable_id', $idUser)
            ->where('data->kunci', $kunci)
            ->pluck('notifiable_id')
            ->map(fn ($id) => (int) $id);

        $baru = $idUser->diff($sudahAda);
        if ($baru->isEmpty()) {
            return 0;
        }

        $sekarang = now();
        $json = json_encode($data + ['kunci' => $kunci], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        static::insert($baru->map(fn ($id) => [
            'id' => (string) Str::uuid(),
            'type' => $jenis,
            'notifiable_type' => $morph,
            'notifiable_id' => $id,
            'data' => $json,
            'read_at' => null,
            'created_at' => $sekarang,
            'updated_at' => $sekarang,
        ])->all());

        return $baru->count();
    }

    /** User anggota roster semua Squad peserta (pendaftaran diterima) suatu turnamen. */
    protected static function penerimaRosterPeserta(int $idTurnamen)
    {
        return DB::table('anggota_pendaftaran_turnamen as a')
            ->join('pendaftaran_turnamen as p', 'p.id_pendaftaran', '=', 'a.id_pendaftaran')
            ->join('players as pl', 'pl.id_player', '=', 'a.id_player')
            ->where('p.id_turnamen', $idTurnamen)
            ->where('p.status_pendaftaran', 'diterima')
            ->distinct()
            ->pluck('pl.id_user');
    }

    protected static function pengirimPenyelenggara(Turnamen $turnamen): array
    {
        return [
            'peran' => self::PENGIRIM_PENYELENGGARA,
            'nama' => $turnamen->pengajuan?->nama_penyelenggara,
        ];
    }

    protected static function terkaitSquad(Squad $squad): array
    {
        return ['tipe' => 'squad', 'id' => $squad->id_squad, 'nama' => $squad->nama_squad];
    }

    protected static function terkaitPengajuan(PengajuanTurnamen $pengajuan): array
    {
        return ['tipe' => 'pengajuan', 'id' => $pengajuan->id_pengajuan, 'nama' => $pengajuan->nama_turnamen];
    }

    protected static function terkaitTurnamen(Turnamen $turnamen): array
    {
        return [
            'tipe' => 'turnamen',
            'id' => $turnamen->id_turnamen,
            'nama' => $turnamen->pengajuan?->nama_turnamen,
        ];
    }
}