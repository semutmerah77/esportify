<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BracketTurnamen extends Model
{
    protected $table = 'bracket_turnamen';

    protected $primaryKey = 'id_bracket';

    public const STATUS_DRAFT = 'draft';
    public const STATUS_DIPUBLIKASIKAN = 'dipublikasikan';

    protected $fillable = [
        'id_turnamen',
        'status_bracket',
        'deskripsi_bracket',
        'tanggal_publikasi',
    ];

    protected $casts = [
        'tanggal_publikasi' => 'datetime',
    ];

    public function turnamen(): BelongsTo
    {
        return $this->belongsTo(Turnamen::class, 'id_turnamen', 'id_turnamen');
    }

    public function babak(): HasMany
    {
        return $this->hasMany(BabakTurnamen::class, 'id_bracket', 'id_bracket')
            ->orderBy('urutan_babak')
            ->orderBy('id_babak');
    }

    public function pertandingan(): HasMany
    {
        return $this->hasMany(Pertandingan::class, 'id_bracket', 'id_bracket')
            ->orderBy('nomor_pertandingan');
    }

    public function isDraft(): bool
    {
        return $this->status_bracket === self::STATUS_DRAFT;
    }

    // ==========================================
    // PENETAPAN JUARA (PB-21)
    // ==========================================

    /** Pertandingan perebutan Juara 3 (hanya ada kalau peserta >= 4). */
    public function pertandinganJuaraKetiga(): ?Pertandingan
    {
        $id = Pertandingan::where('id_bracket', $this->id_bracket)
            ->whereNotNull('id_pertandingan_kalah_selanjutnya')
            ->value('id_pertandingan_kalah_selanjutnya');

        return $id ? Pertandingan::find($id) : null;
    }

    /** Pertandingan final: tidak punya pertandingan selanjutnya dan bukan perebutan Juara 3. */
    public function pertandinganFinal(): ?Pertandingan
    {
        $idJuara3 = $this->pertandinganJuaraKetiga()?->id_pertandingan;

        return Pertandingan::where('id_bracket', $this->id_bracket)
            ->whereNull('id_pertandingan_selanjutnya')
            ->when($idJuara3, fn ($q) => $q->where('id_pertandingan', '!=', $idJuara3))
            ->first();
    }

    /**
     * SD: checkBracketStatus(id_turnamen) — final dan perebutan Juara 3
     * sudah punya hasil. Turnamen < 4 peserta cukup final.
     */
    public static function checkBracketStatus(int $idTurnamen): bool
    {
        $bracket = static::where('id_turnamen', $idTurnamen)->first();
        $final = $bracket?->pertandinganFinal();

        if (!$final || !$final->punyaSkor()) {
            return false;
        }

        $juara3 = $bracket->pertandinganJuaraKetiga();

        return $juara3 === null || $juara3->punyaSkor();
    }
}
