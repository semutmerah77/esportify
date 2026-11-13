<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pengajuan_turnamen', function (Blueprint $table) {
            $table->unsignedTinyInteger('min_roster')->default(1)->after('deskripsi_lokasi');
            $table->unsignedTinyInteger('maks_roster')->default(10)->after('min_roster');
        });
    }

    public function down(): void
    {
        Schema::table('pengajuan_turnamen', function (Blueprint $table) {
            $table->dropColumn(['min_roster', 'maks_roster']);
        });
    }
};