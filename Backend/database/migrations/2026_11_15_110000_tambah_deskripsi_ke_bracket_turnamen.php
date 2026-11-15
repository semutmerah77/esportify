<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Revisi PDM (SA): deskripsi bracket yang bisa ditambah/diedit
 * Penyelenggara di bagian "Deskripsi Bracket" pada tab Bracket.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bracket_turnamen', function (Blueprint $table) {
            $table->text('deskripsi_bracket')->nullable()->after('status_bracket');
        });
    }

    public function down(): void
    {
        Schema::table('bracket_turnamen', function (Blueprint $table) {
            $table->dropColumn('deskripsi_bracket');
        });
    }
};
