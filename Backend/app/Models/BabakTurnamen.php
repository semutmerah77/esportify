<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BabakTurnamen extends Model
{
    protected $table = 'babak_turnamen';

    protected $primaryKey = 'id_babak';

    protected $fillable = [
        'id_bracket',
        'urutan_babak',
        'nama_babak',
        'waktu_mulai',
    ];

    protected $casts = [
        'urutan_babak' => 'integer',
    ];

    public function bracket(): BelongsTo
    {
        return $this->belongsTo(BracketTurnamen::class, 'id_bracket', 'id_bracket');
    }

    public function pertandingan(): HasMany
    {
        return $this->hasMany(Pertandingan::class, 'id_babak', 'id_babak')
            ->orderBy('nomor_pertandingan');
    }
}
