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
}
