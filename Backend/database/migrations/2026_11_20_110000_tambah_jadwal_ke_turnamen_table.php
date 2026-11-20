<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * PB-24: jadwal turnamen disimpan di tabel turnamen (PDM terbaru, keputusan SA).
 * - jadwal_pendaftaran_tutup & jadwal_main  = jadwal awal saat pengajuan disetujui
 * - *_baru                                  = jadwal hasil perpanjangan (NULL = belum pernah)
 * pengajuan_turnamen tidak diubah (arsip).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('turnamen', function (Blueprint $table) {
            $table->dateTime('jadwal_pendaftaran_tutup')->nullable()->after('status');
            $table->dateTime('jadwal_main')->nullable()->after('jadwal_pendaftaran_tutup');
            $table->dateTime('jadwal_pendaftaran_tutup_baru')->nullable()->after('jadwal_main');
            $table->dateTime('jadwal_main_baru')->nullable()->after('jadwal_pendaftaran_tutup_baru');
        });

        // Salin jadwal awal untuk turnamen yang sudah ada
        DB::table('turnamen')->orderBy('id_turnamen')->each(function ($t) {
            $p = DB::table('pengajuan_turnamen')->where('id_pengajuan', $t->id_pengajuan)
                ->first(['jadwal_pendaftaran_tutup', 'jadwal_main']);

            if ($p) {
                DB::table('turnamen')->where('id_turnamen', $t->id_turnamen)->update([
                    'jadwal_pendaftaran_tutup' => $p->jadwal_pendaftaran_tutup,
                    'jadwal_main' => $p->jadwal_main,
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('turnamen', function (Blueprint $table) {
            $table->dropColumn(['jadwal_pendaftaran_tutup', 'jadwal_main', 'jadwal_pendaftaran_tutup_baru', 'jadwal_main_baru']);
        });
    }
};
