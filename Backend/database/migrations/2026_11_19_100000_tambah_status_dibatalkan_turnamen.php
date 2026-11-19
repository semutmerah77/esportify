<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PB-25: status turnamen "dibatalkan" (PDM terbaru).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('turnamen', function (Blueprint $table) {
            $table->enum('status', ['pendaftaran', 'berlangsung', 'selesai', 'dibatalkan'])->change();
        });
    }

    public function down(): void
    {
        Schema::table('turnamen', function (Blueprint $table) {
            $table->enum('status', ['pendaftaran', 'berlangsung', 'selesai'])->change();
        });
    }
};
