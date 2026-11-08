<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Menyesuaikan tabel squad dan leader_squad dengan PDM terbaru:
 * - squad.id_leader_squad  → diganti squad.id_player_pembuat
 * - squad.status_squad     → 'aktif' / 'disable' (sebelumnya 'aktif' / 'arsip')
 * - leader_squad           → riwayat kepemimpinan per Squad
 *                            (id_player, id_squad, tanggal_pengangkatan, tanggal_berakhir)
 *                            Leader aktif = baris dengan tanggal_berakhir NULL.
 *
 * Data lama tetap dipertahankan.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Satu Player sekarang boleh punya banyak baris leader_squad
        //    (beda Squad / beda masa jabatan), jadi unique id_player dilepas.
        Schema::table('leader_squad', function (Blueprint $table) {
            $table->dropForeign(['id_player']);

            if (Schema::hasIndex('leader_squad', 'leader_squad_id_player_unique')) {
                $table->dropUnique(['id_player']);
            }
        });

        // Kolom baru (sementara nullable agar data lama bisa diisi)
        Schema::table('leader_squad', function (Blueprint $table) {
            $table->unsignedBigInteger('id_squad')->nullable()->after('id_player');
            $table->dateTime('tanggal_pengangkatan')->nullable()->after('id_squad');
            $table->dateTime('tanggal_berakhir')->nullable()->after('tanggal_pengangkatan');
        });

        Schema::table('squad', function (Blueprint $table) {
            $table->unsignedBigInteger('id_player_pembuat')->nullable()->after('id_squad');
            $table->enum('status_squad', ['aktif', 'arsip', 'disable'])->default('aktif')->change();
        });

        // 2. Pindahkan data lama
        $squads = DB::table('squad')->get();

        foreach ($squads as $squad) {
            $leaderPlayer = DB::table('leader_squad')
                ->where('id_leader_squad', $squad->id_leader_squad)
                ->value('id_player');

            // Pembuat = anggota pertama yang tercatat di Squad
            $pembuat = DB::table('anggota_squad')
                ->where('id_squad', $squad->id_squad)
                ->orderBy('id_anggota_squad')
                ->value('id_player') ?? $leaderPlayer;

            // Satu baris leader_squad aktif per Squad
            $idLeaderBaru = DB::table('leader_squad')->insertGetId([
                'id_player' => $leaderPlayer,
                'id_squad' => $squad->id_squad,
                'tanggal_pengangkatan' => $squad->created_at ?? now(),
                'tanggal_berakhir' => $squad->status_squad === 'arsip' ? ($squad->updated_at ?? now()) : null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('squad')
                ->where('id_squad', $squad->id_squad)
                ->update([
                    'id_player_pembuat' => $pembuat,
                    'status_squad' => $squad->status_squad === 'arsip' ? 'disable' : $squad->status_squad,
                ]);

            // Undangan & permintaan diarahkan ke baris leader milik Squad tersebut
            DB::table('undangan_squad')
                ->where('id_squad', $squad->id_squad)
                ->update(['id_leader_squad' => $idLeaderBaru]);

            DB::table('permintaan_bergabung')
                ->where('id_squad', $squad->id_squad)
                ->update(['id_leader_squad' => $idLeaderBaru]);
        }

        // 3. Lepas relasi lama squad → leader_squad
        Schema::table('squad', function (Blueprint $table) {
            $table->dropForeign(['id_leader_squad']);
            $table->dropColumn('id_leader_squad');
        });

        // 4. Hapus baris leader_squad lama (yang tidak terikat ke Squad)
        DB::table('leader_squad')->whereNull('id_squad')->delete();

        // 5. Kunci struktur akhir sesuai PDM
        Schema::table('leader_squad', function (Blueprint $table) {
            $table->unsignedBigInteger('id_squad')->nullable(false)->change();
            $table->dateTime('tanggal_pengangkatan')->nullable(false)->change();

            $table->index(['id_squad', 'tanggal_berakhir']);

            $table->foreign('id_player')
                ->references('id_player')
                ->on('players')
                ->cascadeOnDelete();

            $table->foreign('id_squad')
                ->references('id_squad')
                ->on('squad')
                ->cascadeOnDelete();
        });

        Schema::table('squad', function (Blueprint $table) {
            $table->unsignedBigInteger('id_player_pembuat')->nullable(false)->change();
            $table->enum('status_squad', ['aktif', 'disable'])->default('aktif')->change();

            $table->foreign('id_player_pembuat')
                ->references('id_player')
                ->on('players')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('squad', function (Blueprint $table) {
            $table->dropForeign(['id_player_pembuat']);
            $table->enum('status_squad', ['aktif', 'arsip', 'disable'])->default('aktif')->change();
            $table->unsignedBigInteger('id_leader_squad')->nullable()->after('id_squad');
        });

        DB::table('squad')->where('status_squad', 'disable')->update(['status_squad' => 'arsip']);

        // Leader aktif terakhir per Squad dikembalikan ke squad.id_leader_squad
        foreach (DB::table('squad')->get() as $squad) {
            $idLeader = DB::table('leader_squad')
                ->where('id_squad', $squad->id_squad)
                ->orderByRaw('tanggal_berakhir IS NULL DESC')
                ->orderByDesc('tanggal_pengangkatan')
                ->value('id_leader_squad');

            DB::table('squad')->where('id_squad', $squad->id_squad)->update(['id_leader_squad' => $idLeader]);
        }

        Schema::table('leader_squad', function (Blueprint $table) {
            $table->dropForeign(['id_squad']);
            $table->dropIndex(['id_squad', 'tanggal_berakhir']);
            $table->dropColumn(['id_squad', 'tanggal_pengangkatan', 'tanggal_berakhir']);
        });

        Schema::table('squad', function (Blueprint $table) {
            $table->enum('status_squad', ['aktif', 'arsip'])->default('aktif')->change();
            $table->dropColumn('id_player_pembuat');

            $table->foreign('id_leader_squad')
                ->references('id_leader_squad')
                ->on('leader_squad')
                ->restrictOnDelete();
        });
    }
};
?>