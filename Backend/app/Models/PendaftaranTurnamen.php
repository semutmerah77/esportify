<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PendaftaranTurnamen extends Model
{
    protected $table = 'pendaftaran_turnamen';

    protected $primaryKey = 'id_pendaftaran';

    /**
     * Status yang dihitung untuk slot, daftar dobel, dan player di squad lain.
     * Pendaftaran "ditolak" dianggap tidak ada.
     */
    public const STATUS_AKTIF = ['menunggu', 'diterima'];

    protected $fillable = [
        'id_squad',
        'id_turnamen',
        'id_player',
        'nickname_game',
        'uid_game',
        'bukti_pembayaran',
        'status_pendaftaran',
        'tanggal_daftar',
        'tanggal_verifikasi',
        'alasan_penolakan',
        'peringkat_akhir',
        'nomor_seed',
    ];

    protected $hidden = [
        'bukti_pembayaran',
    ];

    protected $casts = [
        'tanggal_daftar' => 'datetime',
        'tanggal_verifikasi' => 'datetime',
    ];

    public function squad(): BelongsTo
    {
        return $this->belongsTo(Squad::class, 'id_squad', 'id_squad');
    }

    public function turnamen(): BelongsTo
    {
        return $this->belongsTo(Turnamen::class, 'id_turnamen', 'id_turnamen');
    }

    /**
     * Player yang mendaftarkan (perwakilan).
     */
    public function pendaftar(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'id_player', 'id_player');
    }

    /**
     * Roster yang didaftarkan (snapshot anggota saat mendaftar).
     */
    public function anggota(): HasMany
    {
        return $this->hasMany(AnggotaPendaftaranTurnamen::class, 'id_pendaftaran', 'id_pendaftaran');
    }

    /**
     * "terkunci" kalau masih ada pemain di roster ini yang terkunci.
     */
    public function statusRoster(): string
    {
        return $this->anggota()->where('status_roster', 'terkunci')->exists()
            ? 'terkunci'
            : 'terbuka';
    }

    public function scopeAktif(Builder $query): Builder
    {
        return $query->whereIn('status_pendaftaran', self::STATUS_AKTIF);
    }

    // ==========================================
    // PENETAPAN JUARA (PB-21)
    // peringkat_akhir diisi sementara selama masa koreksi; baru dianggap
    // final (ditampilkan, dihitung win rate & badge) setelah turnamen selesai.
    // ==========================================

    /** SD: saveJuaraPertamaKedua(id_pertandingan) — pemenang final = 1, yang kalah = 2. */
    public static function saveJuaraPertamaKedua(int $idPertandingan): array
    {
        return self::simpanPeringkat($idPertandingan, 1, 2);
    }

    /** SD: saveJuaraKetiga(id_pertandingan) — pemenang perebutan Juara 3 = 3. */
    public static function saveJuaraKetiga(int $idPertandingan): array
    {
        return self::simpanPeringkat($idPertandingan, 3, null);
    }

    private static function simpanPeringkat(int $idPertandingan, int $peringkatMenang, ?int $peringkatKalah): array
    {
        $pertandingan = Pertandingan::with('bracket')->findOrFail($idPertandingan);
        $idTurnamen = $pertandingan->bracket->id_turnamen;
        $idMenang = $pertandingan->id_pendaftaran_pemenang;
        $idKalah = (int) $idMenang === (int) $pertandingan->id_pendaftaran_a
            ? $pertandingan->id_pendaftaran_b
            : $pertandingan->id_pendaftaran_a;

        // Koreksi hasil: kosongkan peringkat lama dulu supaya tidak dobel.
        static::where('id_turnamen', $idTurnamen)
            ->whereIn('peringkat_akhir', array_filter([$peringkatMenang, $peringkatKalah]))
            ->update(['peringkat_akhir' => null]);

        static::whereKey($idMenang)->update(['peringkat_akhir' => $peringkatMenang]);
        if ($peringkatKalah !== null && $idKalah) {
            static::whereKey($idKalah)->update(['peringkat_akhir' => $peringkatKalah]);
        }

        return [
            'id_pendaftaran_menang' => $idMenang,
            'id_pendaftaran_kalah' => $idKalah,
        ];
    }

    // ==========================================
    // WIN RATE & BADGE SQUAD (PB-21)
    // Hanya turnamen berstatus selesai dengan pendaftaran diterima.
    // ==========================================

    public function scopeHasilAkhirSquad(Builder $query, int $idSquad, ?int $idGame = null): Builder
    {
        return $query
            ->join('turnamen as t', 't.id_turnamen', '=', 'pendaftaran_turnamen.id_turnamen')
            ->join('pengajuan_turnamen as pg', 'pg.id_pengajuan', '=', 't.id_pengajuan')
            ->where('pendaftaran_turnamen.id_squad', $idSquad)
            ->where('pendaftaran_turnamen.status_pendaftaran', 'diterima')
            ->where('t.status', Turnamen::STATUS_SELESAI)
            ->when($idGame, fn ($q) => $q->where('pg.id_game', $idGame));
    }

    /** SD: getWinRateBySquad(id_squad) — jumlah turnamen selesai & jumlah Juara 1. */
    public static function getWinRateBySquad(int $idSquad): array
    {
        return self::hitungJuara($idSquad);
    }

    /** SD: getStatistikKemenanganBySquad(id_squad) — jumlah Juara 1. */
    public static function getStatistikKemenanganBySquad(int $idSquad): int
    {
        return static::hasilAkhirSquad($idSquad)->where('pendaftaran_turnamen.peringkat_akhir', 1)->count();
    }

    /** SD: getStatistikByGame(id_squad, id_game) — jumlah turnamen selesai & Juara 1 per game. */
    public static function getStatistikByGame(int $idSquad, int $idGame): array
    {
        return self::hitungJuara($idSquad, $idGame);
    }

    /** SD: getBadgePrestasiJuara(id_squad) — berapa kali Juara 1, 2, 3. */
    public static function getBadgePrestasiJuara(int $idSquad): array
    {
        $hasil = self::hitungJuara($idSquad);

        return [
            'juara_1' => $hasil['total_juara_1'],
            'juara_2' => $hasil['total_juara_2'],
            'juara_3' => $hasil['total_juara_3'],
        ];
    }

    /** SD: getDaftarPencapaianSquad(id_squad) — riwayat turnamen selesai + peringkat_akhir. */
    public static function getDaftarPencapaianSquad(int $idSquad)
    {
        return self::daftarPencapaian($idSquad);
    }

    /** SD: getPencapaianSquadByGame(id_squad, id_game) */
    public static function getPencapaianSquadByGame(int $idSquad, int $idGame)
    {
        return self::daftarPencapaian($idSquad, $idGame);
    }

    // ==========================================
    // PIALA INDIVIDU PLAYER (PB-23)
    // Dari roster pendaftaran (anggota_pendaftaran_turnamen), bukan keanggotaan
    // Squad saat ini: pemain cadangan ikut dapat, anggota di luar roster tidak,
    // dan piala tetap ada walau Player keluar / pindah Squad.
    // ==========================================

    /** SD: getPrestasiByPlayer(id_player) — Gold = Juara 1, Silver = Juara 2, Bronze = Juara 3. */
    public static function getPrestasiByPlayer(int $idPlayer): array
    {
        $baris = AnggotaPendaftaranTurnamen::query()
            ->join('pendaftaran_turnamen as pt', 'pt.id_pendaftaran', '=', 'anggota_pendaftaran_turnamen.id_pendaftaran')
            ->join('turnamen as t', 't.id_turnamen', '=', 'pt.id_turnamen')
            ->where('anggota_pendaftaran_turnamen.id_player', $idPlayer)
            ->where('pt.status_pendaftaran', 'diterima')
            ->where('t.status', Turnamen::STATUS_SELESAI)
            ->whereIn('pt.peringkat_akhir', [1, 2, 3])
            ->selectRaw('SUM(CASE WHEN pt.peringkat_akhir = 1 THEN 1 ELSE 0 END) as gold')
            ->selectRaw('SUM(CASE WHEN pt.peringkat_akhir = 2 THEN 1 ELSE 0 END) as silver')
            ->selectRaw('SUM(CASE WHEN pt.peringkat_akhir = 3 THEN 1 ELSE 0 END) as bronze')
            ->toBase()
            ->first();

        return [
            'gold' => (int) ($baris->gold ?? 0),
            'silver' => (int) ($baris->silver ?? 0),
            'bronze' => (int) ($baris->bronze ?? 0),
        ];
    }

    private static function hitungJuara(int $idSquad, ?int $idGame = null): array
    {
        $baris = static::hasilAkhirSquad($idSquad, $idGame)
            ->selectRaw('COUNT(*) as total_turnamen')
            ->selectRaw('SUM(CASE WHEN pendaftaran_turnamen.peringkat_akhir = 1 THEN 1 ELSE 0 END) as total_juara_1')
            ->selectRaw('SUM(CASE WHEN pendaftaran_turnamen.peringkat_akhir = 2 THEN 1 ELSE 0 END) as total_juara_2')
            ->selectRaw('SUM(CASE WHEN pendaftaran_turnamen.peringkat_akhir = 3 THEN 1 ELSE 0 END) as total_juara_3')
            ->toBase()
            ->first();

        return [
            'total_turnamen' => (int) ($baris->total_turnamen ?? 0),
            'total_juara_1' => (int) ($baris->total_juara_1 ?? 0),
            'total_juara_2' => (int) ($baris->total_juara_2 ?? 0),
            'total_juara_3' => (int) ($baris->total_juara_3 ?? 0),
        ];
    }

    private static function daftarPencapaian(int $idSquad, ?int $idGame = null)
    {
        return static::hasilAkhirSquad($idSquad, $idGame)
            ->leftJoin('games as g', 'g.id_game', '=', 'pg.id_game')
            ->select([
                'pendaftaran_turnamen.id_pendaftaran',
                'pendaftaran_turnamen.peringkat_akhir',
                't.id_turnamen',
                'pg.nama_turnamen',
                'pg.poster',
                'pg.id_game',
                'g.nama_game',
                'g.avatar as avatar_game',
            ])
            ->selectRaw('COALESCE(t.jadwal_main_baru, t.jadwal_main, pg.jadwal_main) as jadwal_main_aktif')
            ->orderByDesc('jadwal_main_aktif')
            ->orderByDesc('t.id_turnamen')
            ->toBase()
            ->get();
    }
}
?>