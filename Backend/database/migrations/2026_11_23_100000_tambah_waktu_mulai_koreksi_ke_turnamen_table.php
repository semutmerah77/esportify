<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PB-21: masa koreksi hasil final 30 menit.
 * Diisi saat hasil final & perebutan Juara 3 lengkap, di-reset setiap ada koreksi.
 * NULL = turnamen belum memasuki masa koreksi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('turnamen', function (Blueprint $table) {
            $table->dateTime('waktu_mulai_koreksi')->nullable()->after('jadwal_main_baru');
        });
    }

    public function down(): void
    {
        Schema::table('turnamen', function (Blueprint $table) {
            $table->dropColumn('waktu_mulai_koreksi');
        });
    }
};