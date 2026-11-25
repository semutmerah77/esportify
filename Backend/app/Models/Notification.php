<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Notifications\DatabaseNotification;

/**
 * PB-30 & PB-31 — Notification (tabel notifications, Laravel Database Notifications).
 *
 * Atribut: id (uuid), type (jenis notifikasi), notifiable_type, notifiable_id,
 * data (JSON: judul, pesan, pengirim, terkait, tautan), read_at, created_at, updated_at.
 *
 * markAsRead() : void diwarisi dari DatabaseNotification (UPDATE read_at = NOW()).
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
}