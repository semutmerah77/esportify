<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    if (!Schema::hasColumn('pengajuan_turnamen', 'nomor_telepon_penyelenggara')) {
        Schema::table('pengajuan_turnamen', function (Blueprint $table) {
            $table->string('nomor_telepon_penyelenggara', 20)
                ->nullable()
                ->after('nama_penyelenggara');
        });
    }
}

public function down(): void
{
    if (Schema::hasColumn('pengajuan_turnamen', 'nomor_telepon_penyelenggara')) {
        Schema::table('pengajuan_turnamen', function (Blueprint $table) {
            $table->dropColumn('nomor_telepon_penyelenggara');
        });
    }
}
};
