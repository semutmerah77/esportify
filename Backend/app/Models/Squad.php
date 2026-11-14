<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class Squad extends Model
{
    protected $table = 'squad';

    protected $primaryKey = 'id_squad';

    protected $fillable = [
        'id_player_pembuat',
        'kode_squad',
        'logo_squad',
        'nama_squad',
        'deskripsi',
        'maks_anggota',
        'status_squad',
    ];

    protected $casts = [
        'maks_anggota' => 'integer',
    ];

    /**
     * Leader yang sedang menjabat (tanggal_berakhir NULL).
     */
    public function leader(): HasOne
    {
        return $this->hasOne(LeaderSquad::class, 'id_squad', 'id_squad')
            ->whereNull('tanggal_berakhir');
    }

    /**
     * Seluruh riwayat kepemimpinan Squad.
     */
    public function riwayatLeader(): HasMany
    {
        return $this->hasMany(LeaderSquad::class, 'id_squad', 'id_squad');
    }

    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(Player::class, 'id_player_pembuat', 'id_player');
    }

    /**
     * Seluruh baris keanggotaan, termasuk yang sudah keluar (riwayat).
     */
    public function anggota(): HasMany
    {
        return $this->hasMany(AnggotaSquad::class, 'id_squad', 'id_squad');
    }

    public function anggotaAktif(): HasMany
    {
        return $this->anggota()->where('status_anggota', 'aktif');
    }

    public function permintaan(): HasMany
    {
        return $this->hasMany(PermintaanBergabung::class, 'id_squad', 'id_squad');
    }

    public function undangan(): HasMany
    {
        return $this->hasMany(UndanganSquad::class, 'id_squad', 'id_squad');
    }

    public function pendaftaranTurnamen(): HasMany
    {
        return $this->hasMany(PendaftaranTurnamen::class, 'id_squad', 'id_squad');
    }

    public function scopeAktif(Builder $query): Builder
    {
        return $query->where('status_squad', 'aktif');
    }

    public function isLeader(?Player $player): bool
    {
        return $player !== null
            && $this->leader
            && (int) $this->leader->id_player === (int) $player->id_player;
    }

    public function isAnggotaAktif(?Player $player): bool
    {
        return $player !== null
            && $this->anggotaAktif()->where('id_player', $player->id_player)->exists();
    }

    /**
     * Mengakhiri masa jabatan Leader saat ini dan (opsional) mengangkat Leader baru.
     * Panggil di dalam DB::transaction.
     */
    public function gantiLeader(?int $idPlayerBaru): ?LeaderSquad
    {
        $this->riwayatLeader()
            ->whereNull('tanggal_berakhir')
            ->update(['tanggal_berakhir' => now()]);

        $leaderBaru = null;

        if ($idPlayerBaru !== null) {
            $leaderBaru = $this->riwayatLeader()->create([
                'id_player' => $idPlayerBaru,
                'tanggal_pengangkatan' => now(),
            ]);
        }

        $this->unsetRelation('leader');

        return $leaderBaru;
    }

    public function isFull(): bool
    {
        return $this->anggotaAktif()->count() >= $this->maks_anggota;
    }

    /**
     * Mencari Squad berdasarkan id_squad (angka) atau kode_squad (contoh: SQD-7K2M9Q).
     */
    public static function cariDenganKunci($key): ?self
    {
        $query = static::with('leader');

        return ctype_digit((string) $key)
            ? $query->find($key)
            : $query->where('kode_squad', strtoupper(ltrim((string) $key, '#')))->first();
    }

    /**
     * Roster lock per pemain: pendaftaran milik Squad ini (menunggu/diterima)
     * yang masih mengunci Player tersebut. Null kalau Player bebas.
     */
    public function pendaftaranTerkunciUntuk(int $idPlayer): ?PendaftaranTurnamen
    {
        return $this->pendaftaranTurnamen()
            ->aktif()
            ->whereHas('anggota', fn ($q) => $q
                ->where('id_player', $idPlayer)
                ->where('status_roster', 'terkunci'))
            ->with('turnamen.pengajuan')
            ->latest('tanggal_daftar')
            ->first();
    }

    /**
     * Pemain Squad ini yang sedang terkunci roster, beserta turnamennya.
     * Hasil: [id_player => [ {id_turnamen, nama_turnamen}, ... ]]
     */
    public function pemainTerkunci(): \Illuminate\Support\Collection
    {
        return AnggotaPendaftaranTurnamen::query()
            ->where('status_roster', 'terkunci')
            ->whereHas('pendaftaran', fn ($q) => $q->aktif()->where('id_squad', $this->id_squad))
            ->with('turnamen.pengajuan')
            ->get()
            ->groupBy('id_player')
            ->map(fn ($rows) => $rows->map(fn ($a) => [
                'id_turnamen' => $a->id_turnamen,
                'nama_turnamen' => $a->turnamen?->pengajuan?->nama_turnamen,
            ])->unique('id_turnamen')->values());
    }

    /**
     * Membuat Squad ID unik, contoh: SQD-7K2M9Q
     */
    public static function generateKode(): string
    {
        do {
            $kode = 'SQD-' . strtoupper(Str::random(6));
        } while (static::where('kode_squad', $kode)->exists());

        return $kode;
    }
}
?>