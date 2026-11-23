<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * PB-28 — Blokir pesan antar Player (R8.07, R8.08).
 * Blokir berlaku dua arah untuk pengiriman pesan sampai pemblokir membuka blokir.
 */
class BlokirChat extends Model
{
    protected $table = 'blokir_chat';

    protected $primaryKey = 'id_blokir';

    public const CREATED_AT = null;

    public const STATUS_DIBLOKIR = 'diblokir';
    public const STATUS_TIDAK_DIBLOKIR = 'tidak_diblokir';

    protected $fillable = [
        'id_player_pemblokir',
        'id_player_diblokir',
        'tanggal_diblokir',
        'status_blokir',
    ];

    protected $casts = [
        'tanggal_diblokir' => 'datetime',
    ];

    public function aktif(): bool
    {
        return $this->status_blokir === self::STATUS_DIBLOKIR;
    }

    /** SD: cekStatusBlokir(id_player_pemblokir, id_player_diblokir) */
    public static function cekStatusBlokir(int $idPlayerPemblokir, int $idPlayerDiblokir): ?self
    {
        return static::where('id_player_pemblokir', $idPlayerPemblokir)
            ->where('id_player_diblokir', $idPlayerDiblokir)
            ->first();
    }

    /** SD: createBlokir(id_player_pemblokir, id_player_diblokir) */
    public static function createBlokir(int $idPlayerPemblokir, int $idPlayerDiblokir): self
    {
        return static::create([
            'id_player_pemblokir' => $idPlayerPemblokir,
            'id_player_diblokir' => $idPlayerDiblokir,
            'tanggal_diblokir' => now(),
            'status_blokir' => self::STATUS_DIBLOKIR,
        ]);
    }

    /** SD: updateStatusBlokir(id_blokir, status_blokir) */
    public static function updateStatusBlokir(int $idBlokir, string $statusBlokir): bool
    {
        $data = ['status_blokir' => $statusBlokir];
        if ($statusBlokir === self::STATUS_DIBLOKIR) {
            $data['tanggal_diblokir'] = now();
        }

        return static::whereKey($idBlokir)->update($data) > 0;
    }
}