<?php

namespace App\Models;

use App\Models\Player;
use App\Models\Admin;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    protected $table = 'users';

    protected $primaryKey = 'id_user';

    public $incrementing = true;

    protected $keyType = 'int';

    protected $fillable = [
        'username',
        'email',
        'password',
        'status',
        'terakhir_login',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'terakhir_login' => 'datetime',
        ];
    }

    /**
     * Relasi ke profil Player.
     */
    public function player(): HasOne
    {
        return $this->hasOne(
            Player::class,
            'id_user',
            'id_user'
        );
    }

    /**
     * Relasi ke profil Admin.
     */
    public function admin(): HasOne
    {
        return $this->hasOne(
            Admin::class,
            'id_user',
            'id_user'
        );
    }
    
    // ==========================================
    // PB-30 — SD Melihat dan Membuka Notifikasi / Tandai Semua Dibaca
    // R10.01: notifikasi hanya untuk Player (termasuk Leader & Penyelenggara).
    // ==========================================

    /**
     * Notifikasi milik user memakai model App\Models\Notification
     * (menggantikan bawaan DatabaseNotification dari trait Notifiable).
     */
    public function notifications()
    {
        return $this->morphMany(Notification::class, 'notifiable')->latest();
    }

    /** SD: hitungNotifikasiBelumDibaca() : int — untuk titik biru (30 hari terakhir). */
    public function hitungNotifikasiBelumDibaca(): int
    {
        return $this->notifications()->masihBerlaku()->unread()->count();
    }

    /** SD: lihatDaftarNotifikasi() — 30 hari terakhir, terbaru lebih dulu. */
    public function lihatDaftarNotifikasi(int $perHalaman = 20)
    {
        return $this->notifications()
            ->masihBerlaku()
            ->orderByDesc('id') // urutan tetap untuk notifikasi dengan waktu sama
            ->simplePaginate($perHalaman);
    }

    /**
     * SD: tandaiNotifikasiDibaca(id) → Notification.markAsRead().
     * Mengembalikan null kalau notifikasi bukan milik user / sudah lebih dari 30 hari.
     */
    public function tandaiNotifikasiDibaca(string $id): ?Notification
    {
        $notifikasi = $this->notifications()->masihBerlaku()->whereKey($id)->first();

        $notifikasi?->markAsRead();

        return $notifikasi;
    }

    /** SD: tandaiSemuaNotifikasiDibaca() : int — jumlah notifikasi yang ditandai. */
    public function tandaiSemuaNotifikasiDibaca(): int
    {
        return $this->notifications()
            ->masihBerlaku()
            ->unread()
            ->update(['read_at' => now(), 'updated_at' => now()]);
    }
}
?>