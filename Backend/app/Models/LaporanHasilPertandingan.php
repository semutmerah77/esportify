<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LaporanHasilPertandingan extends Model
{
    protected $table = 'laporan_hasil_pertandingan';

    protected $primaryKey = 'id_laporan';

    public const STATUS_MENUNGGU = 'menunggu';
    public const STATUS_DISETUJUI = 'disetujui';
    public const STATUS_DITOLAK = 'ditolak';

    protected $fillable = [
        'id_pertandingan',
        'id_squad_pelapor',
        'id_player_pelapor',
        'skor_squad_pelapor',
        'skor_squad_lawan',
        'catatan_pelapor',
        'status_laporan',
        'catatan_verifikasi',
        'id_penyelenggara_verifikator',
        'tanggal_laporan',
        'tanggal_verifikasi',
    ];

    protected $casts = [
        'skor_squad_pelapor' => 'integer',
        'skor_squad_lawan' => 'integer',
        'tanggal_laporan' => 'datetime',
        'tanggal_verifikasi' => 'datetime',
    ];

    public function pertandingan(): BelongsTo
    {
        return $this->belongsTo(Pertandingan::class, 'id_pertandingan', 'id_pertandingan');
    }

    public function squadPelapor(): BelongsTo
    {
        return $this->belongsTo(Squad::class, 'id_squad_pelapor', 'id_squad');
    }

    public function playerPelapor(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'id_player_pelapor', 'id_player');
    }

    public function verifikator(): BelongsTo
    {
        return $this->belongsTo(Penyelenggara::class, 'id_penyelenggara_verifikator', 'id_penyelenggara');
    }

    public function bukti(): HasMany
    {
        return $this->hasMany(BuktiPertandingan::class, 'id_laporan', 'id_laporan')
            ->orderBy('id_bukti');
    }

    public function scopeMenunggu(Builder $query): Builder
    {
        return $query->where('status_laporan', self::STATUS_MENUNGGU);
    }
}