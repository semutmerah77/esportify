<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Turnamen extends Model
{
    protected $table = 'turnamen';

    protected $primaryKey = 'id_turnamen';

    protected $fillable = [
        'id_pengajuan',
        'id_penyelenggara',
        'status',
        'jadwal_pendaftaran_tutup',
        'jadwal_main',
        'jadwal_pendaftaran_tutup_baru',
        'jadwal_main_baru',
        'waktu_mulai_koreksi',
    ];

    protected $casts = [
        'jadwal_pendaftaran_tutup' => 'datetime',
        'jadwal_main' => 'datetime',
        'jadwal_pendaftaran_tutup_baru' => 'datetime',
        'jadwal_main_baru' => 'datetime',
        'waktu_mulai_koreksi' => 'datetime',
    ];

    /**
     * PB-24: jadwal awal disalin dari pengajuan saat turnamen dibuat
     * (Admin menyetujui pengajuan), supaya controller Admin tidak perlu diubah.
     */
    protected static function booted(): void
    {
        static::creating(function (Turnamen $turnamen) {
            if ($turnamen->jadwal_pendaftaran_tutup !== null && $turnamen->jadwal_main !== null) {
                return;
            }

            $pengajuan = PengajuanTurnamen::find($turnamen->id_pengajuan);
            $turnamen->jadwal_pendaftaran_tutup ??= $pengajuan?->jadwal_pendaftaran_tutup;
            $turnamen->jadwal_main ??= $pengajuan?->jadwal_main;
        });
    }

    // ==========================================
    // JADWAL (PB-24)
    // Aktif = hasil perpanjangan kalau ada, kalau tidak jadwal awal.
    // Selalu pakai *Aktif() untuk logika & tampilan operasional.
    // ==========================================

    public function jadwalPendaftaranTutupAwal(): ?Carbon
    {
        return $this->jadwal_pendaftaran_tutup ?? $this->pengajuan?->jadwal_pendaftaran_tutup;
    }

    public function jadwalMainAwal(): ?Carbon
    {
        return $this->jadwal_main ?? $this->pengajuan?->jadwal_main;
    }

    public function jadwalPendaftaranTutupAktif(): ?Carbon
    {
        return $this->jadwal_pendaftaran_tutup_baru ?? $this->jadwalPendaftaranTutupAwal();
    }

    public function jadwalMainAktif(): ?Carbon
    {
        return $this->jadwal_main_baru ?? $this->jadwalMainAwal();
    }

    public function sudahDiperpanjang(): bool
    {
        return $this->jadwal_pendaftaran_tutup_baru !== null || $this->jadwal_main_baru !== null;
    }

    public const STATUS_DIBATALKAN = 'dibatalkan';

    /** Turnamen sudah berakhir (selesai atau dibatalkan): tidak ada aksi operasional lagi. */
    public function sudahBerakhir(): bool
    {
        return in_array($this->status, ['selesai', self::STATUS_DIBATALKAN], true);
    }

    public function pesanBerakhir(): string
    {
        return $this->status === self::STATUS_DIBATALKAN
            ? 'Turnamen sudah dibatalkan.'
            : 'Turnamen sudah selesai.';
    }

    // ==========================================
    // MASA KOREKSI HASIL FINAL (PB-21)
    // ==========================================

    public const STATUS_SELESAI = 'selesai';
    public const MASA_KOREKSI_MENIT = 30;
    public const PESAN_HASIL_TERKUNCI = 'Turnamen sudah selesai, hasil tidak dapat diubah.';

    /** SD: getStatusTurnamen(id_turnamen) — status terbaru langsung dari database. */
    public static function getStatusTurnamen(int $idTurnamen): ?string
    {
        return static::whereKey($idTurnamen)->value('status');
    }

    
    /**
     * PB-29 — SD Melihat Home Player: getTurnamenTerbaru().
     * Turnamen publik (sama dengan daftar /turnamen: bukan selesai/dibatalkan dan
     * hari main belum lewat), urut paling baru dibuat, maksimal 5 (Player::BATAS_HOME).
     */
    public static function getTurnamenTerbaru(): array
    {
        $query = static::query()
            ->join('pengajuan_turnamen as pj', 'pj.id_pengajuan', '=', 'turnamen.id_pengajuan')
            ->where(fn ($q) => $q->whereNull('turnamen.status')
                ->orWhereNotIn('turnamen.status', [self::STATUS_SELESAI, self::STATUS_DIBATALKAN]))
            ->whereRaw(
                'COALESCE(turnamen.jadwal_main_baru, turnamen.jadwal_main, pj.jadwal_main) >= ?',
                [now()->startOfDay()->toDateTimeString()]
            );

        return [
            'total' => (clone $query)->count(),
            'data' => $query
                ->select('turnamen.*')
                ->with([
                    'pengajuan:id_pengajuan,id_game,nama_turnamen,poster,tipe_turnamen,slot,total_hadiah,jadwal_pendaftaran_tutup,jadwal_main',
                    'pengajuan.game:id_game,nama_game',
                    'pengajuan.pendanaan',
                ])
                // slot terisi = pendaftaran menunggu + diterima (1 query untuk semua)
                ->withCount(['pendaftaran as slot_terisi' => fn ($q) => $q->aktif()])
                ->orderByDesc('turnamen.created_at')
                ->orderByDesc('turnamen.id_turnamen')
                ->limit(Player::BATAS_HOME)
                ->get(),
        ];
    }

    /**
     * SD: mulaiMasaKoreksi(id_turnamen). Dipanggil saat hasil final & perebutan
     * Juara 3 lengkap, dan dipanggil lagi setiap ada koreksi (waktu di-reset).
     */
    public static function mulaiMasaKoreksi(int $idTurnamen): bool
    {
        return static::whereKey($idTurnamen)->update(['waktu_mulai_koreksi' => now()]) > 0;
    }

    /** SD: getTurnamenMasaKoreksiBerakhir() — dipakai Scheduler tiap menit. */
    public static function getTurnamenMasaKoreksiBerakhir()
    {
        return static::where('status', 'berlangsung')
            ->whereNotNull('waktu_mulai_koreksi')
            ->where('waktu_mulai_koreksi', '<=', now()->subMinutes(self::MASA_KOREKSI_MENIT))
            ->get();
    }

    public function batasMasaKoreksi(): ?Carbon
    {
        return $this->waktu_mulai_koreksi?->copy()->addMinutes(self::MASA_KOREKSI_MENIT);
    }

    public function masaKoreksiBerakhir(): bool
    {
        return $this->waktu_mulai_koreksi !== null && now()->gte($this->batasMasaKoreksi());
    }

    // ==========================================
    // STATISTIK SQUAD (PB-21) — hanya turnamen selesai & pendaftaran diterima
    // ==========================================

    /** SD: getTotalTurnamenBySquad(id_squad) */
    public static function getTotalTurnamenBySquad(int $idSquad): int
    {
        return static::where('status', self::STATUS_SELESAI)
            ->whereHas('pendaftaran', fn ($q) => $q->where('id_squad', $idSquad)->where('status_pendaftaran', 'diterima'))
            ->count();
    }

    /** SD: getTotalTurnamenBySquadAndGame(id_squad, id_game) */
    public static function getTotalTurnamenBySquadAndGame(int $idSquad, int $idGame): int
    {
        return static::where('status', self::STATUS_SELESAI)
            ->whereHas('pengajuan', fn ($q) => $q->where('id_game', $idGame))
            ->whereHas('pendaftaran', fn ($q) => $q->where('id_squad', $idSquad)->where('status_pendaftaran', 'diterima'))
            ->count();
    }

    public function pengajuanPembatalan(): HasMany
    {
        return $this->hasMany(PengajuanPembatalanTurnamen::class, 'id_turnamen', 'id_turnamen');
    }

    /**
     * Pengajuan pembatalan paling baru (kartu turnamen kelolaan).
     */
    public function pengajuanPembatalanTerakhir(): HasOne
    {
        return $this->hasOne(PengajuanPembatalanTurnamen::class, 'id_turnamen', 'id_turnamen')
            ->latestOfMany('id_pengajuan_pembatalan');
    }

    public function pengajuan(): BelongsTo
    {
        return $this->belongsTo(
            PengajuanTurnamen::class,
            'id_pengajuan',
            'id_pengajuan'
        );
    }

    public function penyelenggara(): BelongsTo
    {
        return $this->belongsTo(
            Penyelenggara::class,
            'id_penyelenggara',
            'id_penyelenggara'
        );
    }

    public function pendaftaran(): HasMany
    {
        return $this->hasMany(
            PendaftaranTurnamen::class,
            'id_turnamen',
            'id_turnamen'
        );
    }

    public function bracket(): HasOne
    {
        return $this->hasOne(BracketTurnamen::class, 'id_turnamen', 'id_turnamen');
    }

    public function pengumuman(): HasMany
    {
        return $this->hasMany(Pengumuman::class, 'id_turnamen', 'id_turnamen')
            ->latest();
    }

    /**
     * Jumlah slot yang terisi (pendaftaran menunggu + diterima).
     */
    public function slotTerisi(): int
    {
        // Sudah dihitung di query daftar (withCount 'pendaftaran as slot_terisi')
        if (array_key_exists('slot_terisi', $this->attributes)) {
            return (int) $this->attributes['slot_terisi'];
        }

        return $this->pendaftaran()->aktif()->count();
    }
}
