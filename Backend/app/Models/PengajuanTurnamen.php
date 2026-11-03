<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class PengajuanTurnamen extends Model
{
    protected $table = 'pengajuan_turnamen';

    protected $primaryKey = 'id_pengajuan';

    protected $fillable = [
        'id_player',
        'id_game',
        'id_admin',
        'id_kota',
        'poster',
        'nama_turnamen',
        'nama_penanggung_jawab',   // ganti dari 'nama_penyelenggara'
        'nama_instansi',
        'nomor_instansi',
        'tipe_turnamen',
        'deskripsi_lokasi',
        'slot',
        'jadwal_pendaftaran_tutup',
        'jadwal_main',
        'deskripsi_turnamen',
        'total_hadiah',
        'ktp',
        'rincian_pendanaan',
        'setuju_pertanggungjawaban',
        'status',
        'alasan_admin',
        'revisi_diminta_pada',
        'diajukan_ulang_pada',
    ];

    protected function casts(): array
    {
        return [
            'jadwal_pendaftaran_tutup' => 'datetime',
            'jadwal_main' => 'datetime',
            'revisi_diminta_pada' => 'datetime',
            'diajukan_ulang_pada' => 'datetime',
            'total_hadiah' => 'decimal:2',
            'setuju_pertanggungjawaban' => 'boolean',
        ];
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(
            Player::class,
            'id_player',
            'id_player'
        );
    }

    public function game(): BelongsTo
    {
        return $this->belongsTo(
            Game::class,
            'id_game',
            'id_game'
        );
    }
    public function kota(): BelongsTo
{
    return $this->belongsTo(
        Kota::class,
        'id_kota',
        'id_kota'
    );
}

    public function admin(): BelongsTo
    {
        return $this->belongsTo(
            Admin::class,
            'id_admin',
            'id_admin'
        );
    }

    public function turnamen(): HasOne
    {
        return $this->hasOne(
            Turnamen::class,
            'id_pengajuan',
            'id_pengajuan'
        );
    }

    public function pendanaan(): HasOne
    {
        return $this->hasOne(
            Pendanaan::class,
            'id_pengajuan',
            'id_pengajuan'
        );
    }

    public function pembayaran(): HasOne
    {
        return $this->hasOne(
            Pembayaran::class,
            'id_pengajuan',
            'id_pengajuan'
        );
    }

    public function sponsor(): HasMany
    {
        return $this->hasMany(
            SponsorPengajuan::class,
            'id_pengajuan',
            'id_pengajuan'
        );
    }
    public function rincian(): HasMany
    {
        return $this->hasMany(
            RincianPendanaan::class,
            'id_pengajuan',
            'id_pengajuan'
        );
    }


    public function sumberPendanaan(): BelongsToMany
    {
        return $this->belongsToMany(
            SumberPendanaan::class,
            'pengajuan_sumber_pendanaan',
            'id_pengajuan',
            'id_sumber',
            'id_pengajuan',
            'id_sumber'
        )->using(PengajuanSumberPendanaan::class);
    }
}
?>