<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Roster lock sekarang per pemain (sesuai PDM terbaru):
 * - anggota_pendaftaran_turnamen: + status_roster, tanggal_penguncian, tanggal_pembukaan
 * - pendaftaran_turnamen: - status_roster, roster_locked_at, roster_unlocked_at
 * - squad.maks_anggota: kapasitas maksimal 10 anggota
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1) Kolom kunci per pemain (lewati kalau sudah ada)
        if (!Schema::hasColumn('anggota_pendaftaran_turnamen', 'status_roster')) {
            Schema::table('anggota_pendaftaran_turnamen', function (Blueprint $table) {
                $table->enum('status_roster', ['terkunci', 'terbuka'])
                    ->default('terkunci')
                    ->after('id_turnamen');
            });
        }

        if (!Schema::hasColumn('anggota_pendaftaran_turnamen', 'tanggal_penguncian')) {
            Schema::table('anggota_pendaftaran_turnamen', function (Blueprint $table) {
                $table->dateTime('tanggal_penguncian')->nullable()->after('status_roster');
            });
        }

        if (!Schema::hasColumn('anggota_pendaftaran_turnamen', 'tanggal_pembukaan')) {
            Schema::table('anggota_pendaftaran_turnamen', function (Blueprint $table) {
                $table->dateTime('tanggal_pembukaan')->nullable()->after('tanggal_penguncian');
            });
        }

        if (!Schema::hasIndex('anggota_pendaftaran_turnamen', 'anggota_pendaftaran_turnamen_id_player_status_roster_index')) {
            Schema::table('anggota_pendaftaran_turnamen', function (Blueprint $table) {
                $table->index(['id_player', 'status_roster']);
            });
        }

        // 2) Index pengganti untuk foreign key id_squad.
        //    MySQL tidak mengizinkan index (id_squad, status_roster) dihapus
        //    sebelum ada index lain yang diawali id_squad.
        if (!Schema::hasIndex('pendaftaran_turnamen', 'pendaftaran_turnamen_id_squad_index')) {
            Schema::table('pendaftaran_turnamen', function (Blueprint $table) {
                $table->index('id_squad');
            });
        }

        // 3) Salin status kunci lama lalu hapus kolom lama
        //    (hanya kalau kolom lama masih ada)
        if (Schema::hasColumn('pendaftaran_turnamen', 'status_roster')) {
            DB::table('pendaftaran_turnamen')
                ->select('id_pendaftaran', 'status_roster', 'roster_locked_at', 'roster_unlocked_at', 'tanggal_daftar')
                ->orderBy('id_pendaftaran')
                ->get()
                ->each(function ($p) {
                    DB::table('anggota_pendaftaran_turnamen')
                        ->where('id_pendaftaran', $p->id_pendaftaran)
                        ->update([
                            'status_roster' => $p->status_roster,
                            'tanggal_penguncian' => $p->roster_locked_at ?? $p->tanggal_daftar,
                            'tanggal_pembukaan' => $p->roster_unlocked_at,
                        ]);
                });

            if (Schema::hasIndex('pendaftaran_turnamen', 'pendaftaran_turnamen_id_squad_status_roster_index')) {
                Schema::table('pendaftaran_turnamen', function (Blueprint $table) {
                    $table->dropIndex(['id_squad', 'status_roster']);
                });
            }

            Schema::table('pendaftaran_turnamen', function (Blueprint $table) {
                $table->dropColumn(['status_roster', 'roster_locked_at', 'roster_unlocked_at']);
            });
        }

        // 4) Kapasitas maksimal anggota Squad = 10
        Schema::table('squad', function (Blueprint $table) {
            $table->unsignedSmallInteger('maks_anggota')->default(10)->change();
        });

        DB::table('squad')->update(['maks_anggota' => 10]);
    }

    public function down(): void
    {
        Schema::table('squad', function (Blueprint $table) {
            $table->unsignedSmallInteger('maks_anggota')->default(7)->change();
        });

        Schema::table('pendaftaran_turnamen', function (Blueprint $table) {
            $table->enum('status_roster', ['terkunci', 'terbuka'])->default('terkunci')->after('status_pendaftaran');
            $table->dateTime('roster_locked_at')->nullable()->after('tanggal_verifikasi');
            $table->dateTime('roster_unlocked_at')->nullable()->after('alasan_penolakan');

            $table->index(['id_squad', 'status_roster']);
        });

        // Baru hapus index id_squad setelah index pengganti ada (aturan MySQL)
        Schema::table('pendaftaran_turnamen', function (Blueprint $table) {
            $table->dropIndex(['id_squad']);
        });

        // Pendaftaran dianggap terkunci kalau masih ada pemain yang terkunci
        DB::table('pendaftaran_turnamen')->orderBy('id_pendaftaran')->get()->each(function ($p) {
            $anggota = DB::table('anggota_pendaftaran_turnamen')->where('id_pendaftaran', $p->id_pendaftaran);
            $terkunci = (clone $anggota)->where('status_roster', 'terkunci')->exists();

            DB::table('pendaftaran_turnamen')->where('id_pendaftaran', $p->id_pendaftaran)->update([
                'status_roster' => $terkunci ? 'terkunci' : 'terbuka',
                'roster_locked_at' => (clone $anggota)->min('tanggal_penguncian'),
                'roster_unlocked_at' => $terkunci ? null : (clone $anggota)->max('tanggal_pembukaan'),
            ]);
        });

        Schema::table('anggota_pendaftaran_turnamen', function (Blueprint $table) {
            $table->dropIndex(['id_player', 'status_roster']);
            $table->dropColumn(['status_roster', 'tanggal_penguncian', 'tanggal_pembukaan']);
        });
    }
};