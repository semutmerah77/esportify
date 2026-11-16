<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Penyesuaian PDM terbaru (SA):
 * - laporan_hasil_pertandingan: + catatan_pelapor (catatan dari form pelapor)
 * - bukti_pertandingan: - catatan (tidak dipakai)
 * - babak_turnamen.waktu_mulai: DATETIME → TIME (cukup jam, format 24 jam WIB)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('laporan_hasil_pertandingan', function (Blueprint $table) {
            $table->text('catatan_pelapor')->nullable()->after('skor_squad_lawan');
        });

        Schema::table('bukti_pertandingan', function (Blueprint $table) {
            $table->dropColumn('catatan');
        });

        // DATETIME → TIME: data lama diambil jamnya saja.
        Schema::table('babak_turnamen', function (Blueprint $table) {
            $table->time('waktu_mulai_baru')->nullable()->after('nama_babak');
        });

        DB::table('babak_turnamen')->whereNotNull('waktu_mulai')->orderBy('id_babak')
            ->get(['id_babak', 'waktu_mulai'])
            ->each(fn ($b) => DB::table('babak_turnamen')->where('id_babak', $b->id_babak)
                ->update(['waktu_mulai_baru' => date('H:i:s', strtotime($b->waktu_mulai))]));

        Schema::table('babak_turnamen', function (Blueprint $table) {
            $table->dropColumn('waktu_mulai');
        });

        Schema::table('babak_turnamen', function (Blueprint $table) {
            $table->renameColumn('waktu_mulai_baru', 'waktu_mulai');
        });
    }

    public function down(): void
    {
        // TIME → DATETIME: tanggal diambil dari jadwal_main turnamen.
        Schema::table('babak_turnamen', function (Blueprint $table) {
            $table->dateTime('waktu_mulai_lama')->nullable()->after('nama_babak');
        });

        DB::table('babak_turnamen')
            ->join('bracket_turnamen', 'bracket_turnamen.id_bracket', '=', 'babak_turnamen.id_bracket')
            ->join('turnamen', 'turnamen.id_turnamen', '=', 'bracket_turnamen.id_turnamen')
            ->join('pengajuan_turnamen', 'pengajuan_turnamen.id_pengajuan', '=', 'turnamen.id_pengajuan')
            ->whereNotNull('babak_turnamen.waktu_mulai')
            ->get(['babak_turnamen.id_babak', 'babak_turnamen.waktu_mulai', 'pengajuan_turnamen.jadwal_main'])
            ->each(fn ($b) => DB::table('babak_turnamen')->where('id_babak', $b->id_babak)
                ->update(['waktu_mulai_lama' => date('Y-m-d', strtotime($b->jadwal_main ?? 'now')) . ' ' . $b->waktu_mulai]));

        Schema::table('babak_turnamen', function (Blueprint $table) {
            $table->dropColumn('waktu_mulai');
        });

        Schema::table('babak_turnamen', function (Blueprint $table) {
            $table->renameColumn('waktu_mulai_lama', 'waktu_mulai');
        });

        Schema::table('bukti_pertandingan', function (Blueprint $table) {
            $table->text('catatan')->nullable()->after('file_bukti');
        });

        Schema::table('laporan_hasil_pertandingan', function (Blueprint $table) {
            $table->dropColumn('catatan_pelapor');
        });
    }
};