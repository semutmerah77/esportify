<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Pertandingan extends Model
{
    protected $table = 'pertandingan';

    protected $primaryKey = 'id_pertandingan';

    public const STATUS_MENUNGGU = 'menunggu';
    public const STATUS_BERLANGSUNG = 'berlangsung';
    public const STATUS_SELESAI = 'selesai';

    protected $fillable = [
        'id_bracket',
        'id_babak',
        'nomor_pertandingan',
        'id_pendaftaran_a',
        'id_pendaftaran_b',
        'id_pendaftaran_pemenang',
        'skor_a',
        'skor_b',
        'is_bye',
        'id_pertandingan_selanjutnya',
        'posisi_pemenang_selanjutnya',
        'id_pertandingan_kalah_selanjutnya',
        'posisi_kalah_selanjutnya',
        'status_pertandingan',
    ];

    protected $casts = [
        'nomor_pertandingan' => 'integer',
        'skor_a' => 'integer',
        'skor_b' => 'integer',
        'is_bye' => 'boolean',
    ];

    public function bracket(): BelongsTo
    {
        return $this->belongsTo(BracketTurnamen::class, 'id_bracket', 'id_bracket');
    }

    public function babak(): BelongsTo
    {
        return $this->belongsTo(BabakTurnamen::class, 'id_babak', 'id_babak');
    }

    public function pendaftaranA(): BelongsTo
    {
        return $this->belongsTo(PendaftaranTurnamen::class, 'id_pendaftaran_a', 'id_pendaftaran');
    }

    public function pendaftaranB(): BelongsTo
    {
        return $this->belongsTo(PendaftaranTurnamen::class, 'id_pendaftaran_b', 'id_pendaftaran');
    }

    public function pemenang(): BelongsTo
    {
        return $this->belongsTo(PendaftaranTurnamen::class, 'id_pendaftaran_pemenang', 'id_pendaftaran');
    }

    public function selanjutnya(): BelongsTo
    {
        return $this->belongsTo(self::class, 'id_pertandingan_selanjutnya', 'id_pertandingan');
    }

    public function kalahSelanjutnya(): BelongsTo
    {
        return $this->belongsTo(self::class, 'id_pertandingan_kalah_selanjutnya', 'id_pertandingan');
    }

    public function laporan(): HasMany
    {
        return $this->hasMany(LaporanHasilPertandingan::class, 'id_pertandingan', 'id_pertandingan');
    }

    /** Kedua Squad sudah ditentukan (syarat lapor hasil, R6.23). */
    public function keduaSquadAda(): bool
    {
        return $this->id_pendaftaran_a !== null && $this->id_pendaftaran_b !== null;
    }

    public function punyaSkor(): bool
    {
        return $this->skor_a !== null && $this->skor_b !== null;
    }
}
