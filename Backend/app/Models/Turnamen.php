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
    ];

    protected $casts = [
        'jadwal_pendaftaran_tutup' => 'datetime',
        'jadwal_main' => 'datetime',
        'jadwal_pendaftaran_tutup_baru' => 'datetime',
        'jadwal_main_baru' => 'datetime',
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

    public function pengajuanPembatalan(): HasMany
    {
        return $this->hasMany(PengajuanPembatalanTurnamen::class, 'id_turnamen', 'id_turnamen');
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
