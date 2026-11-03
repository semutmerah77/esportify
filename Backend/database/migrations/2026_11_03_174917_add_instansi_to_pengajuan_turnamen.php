<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pengajuan_turnamen', function (Blueprint $table) {
            if (!Schema::hasColumn('pengajuan_turnamen', 'nama_instansi')) {
                $table->string('nama_instansi', 150)->nullable()->after('nama_penyelenggara');
            }

            if (!Schema::hasColumn('pengajuan_turnamen', 'nomor_instansi')) {
                $table->string('nomor_instansi', 20)->nullable()->after('nama_instansi');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pengajuan_turnamen', function (Blueprint $table) {
            $drop = array_filter(
                ['nama_instansi', 'nomor_instansi'],
                fn ($c) => Schema::hasColumn('pengajuan_turnamen', $c)
            );

            if ($drop) {
                $table->dropColumn($drop);
            }
        });
    }
};