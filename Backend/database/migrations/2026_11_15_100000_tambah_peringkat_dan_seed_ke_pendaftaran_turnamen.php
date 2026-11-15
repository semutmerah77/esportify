<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 2:
 * - peringkat_akhir: 1, 2, 3, atau NULL (ditetapkan saat hasil akhir)
 * - nomor_seed: urutan peserta di bracket (berubah saat diacak)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pendaftaran_turnamen', function (Blueprint $table) {
            $table->unsignedTinyInteger('peringkat_akhir')->nullable()->after('alasan_penolakan');
            $table->unsignedInteger('nomor_seed')->nullable()->after('peringkat_akhir');
        });
    }

    public function down(): void
    {
        Schema::table('pendaftaran_turnamen', function (Blueprint $table) {
            $table->dropColumn(['peringkat_akhir', 'nomor_seed']);
        });
    }
};
