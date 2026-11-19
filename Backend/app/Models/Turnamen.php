<?php

namespace App\Models;

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
    ];

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
