<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tanpa UNIQUE (id_pertandingan, id_squad_pelapor): laporan yang ditolak
 * dikirim ulang sebagai laporan baru, dan sanggahan juga laporan baru.
 * "Maksimal 1 laporan menunggu per Squad per pertandingan" dicek di Backend.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('laporan_hasil_pertandingan', function (Blueprint $table) {
            $table->bigIncrements('id_laporan');

            $table->unsignedBigInteger('id_pertandingan');
            $table->unsignedBigInteger('id_squad_pelapor');
            $table->unsignedBigInteger('id_player_pelapor');

            $table->unsignedInteger('skor_squad_pelapor');
            $table->unsignedInteger('skor_squad_lawan');

            $table->enum('status_laporan', ['menunggu', 'disetujui', 'ditolak'])->default('menunggu');
            $table->text('catatan_verifikasi')->nullable();

            $table->unsignedBigInteger('id_penyelenggara_verifikator')->nullable();

            $table->dateTime('tanggal_laporan');
            $table->dateTime('tanggal_verifikasi')->nullable();

            $table->timestamps();

            $table->index(['id_pertandingan', 'id_squad_pelapor', 'status_laporan'], 'laporan_pertandingan_squad_status_index');

            $table->foreign('id_pertandingan')
                ->references('id_pertandingan')->on('pertandingan')
                ->cascadeOnDelete();

            $table->foreign('id_squad_pelapor')
                ->references('id_squad')->on('squad')
                ->cascadeOnDelete();

            $table->foreign('id_player_pelapor')
                ->references('id_player')->on('players')
                ->cascadeOnDelete();

            $table->foreign('id_penyelenggara_verifikator')
                ->references('id_penyelenggara')->on('penyelenggara')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('laporan_hasil_pertandingan');
    }
};
