<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1) Nickname & UID game milik perwakilan (Player yang mendaftarkan)
        Schema::table('pendaftaran_turnamen', function (Blueprint $table) {
            $table->string('nickname_game', 50)->default('')->after('id_player');
            $table->string('uid_game', 50)->default('')->after('nickname_game');

            // Mempercepat cek UID game dobel dalam satu turnamen
            $table->index(['id_turnamen', 'uid_game']);
        });

        // 2) id_turnamen di anggota_pendaftaran_turnamen (sesuai PDM)
        Schema::table('anggota_pendaftaran_turnamen', function (Blueprint $table) {
            $table->unsignedBigInteger('id_turnamen')->nullable()->after('id_player');
        });

        // Isi id_turnamen untuk data yang sudah ada
        DB::table('anggota_pendaftaran_turnamen')
            ->orderBy('id_anggota_pendaftaran')
            ->select('id_anggota_pendaftaran', 'id_pendaftaran')
            ->get()
            ->each(function ($row) {
                $idTurnamen = DB::table('pendaftaran_turnamen')
                    ->where('id_pendaftaran', $row->id_pendaftaran)
                    ->value('id_turnamen');

                DB::table('anggota_pendaftaran_turnamen')
                    ->where('id_anggota_pendaftaran', $row->id_anggota_pendaftaran)
                    ->update(['id_turnamen' => $idTurnamen]);
            });

        Schema::table('anggota_pendaftaran_turnamen', function (Blueprint $table) {
            $table->unsignedBigInteger('id_turnamen')->nullable(false)->change();

            $table->index(['id_turnamen', 'id_player']);

            $table->foreign('id_turnamen')
                ->references('id_turnamen')
                ->on('turnamen')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('anggota_pendaftaran_turnamen', function (Blueprint $table) {
            $table->dropForeign(['id_turnamen']);
            $table->dropIndex(['id_turnamen', 'id_player']);
            $table->dropColumn('id_turnamen');
        });

        Schema::table('pendaftaran_turnamen', function (Blueprint $table) {
            $table->dropIndex(['id_turnamen', 'uid_game']);
            $table->dropColumn(['nickname_game', 'uid_game']);
        });
    }
};
?>