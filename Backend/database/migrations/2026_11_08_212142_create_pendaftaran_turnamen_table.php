<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pendaftaran_turnamen', function (Blueprint $table) {
            $table->bigIncrements('id_pendaftaran');

            $table->unsignedBigInteger('id_squad');
            $table->unsignedBigInteger('id_turnamen');

            // Player yang menekan tombol daftar (perwakilan)
            $table->unsignedBigInteger('id_player');

            // Wajib untuk turnamen berbayar, NULL untuk turnamen gratis
            $table->string('bukti_pembayaran', 255)->nullable();

            $table->enum('status_pendaftaran', [
                'menunggu',
                'diterima',
                'ditolak',
            ])->default('menunggu');

            // R2.01: roster terkunci segera setelah mendaftar
            $table->enum('status_roster', [
                'terkunci',
                'terbuka',
            ])->default('terkunci');

            $table->dateTime('tanggal_daftar');
            $table->dateTime('tanggal_verifikasi')->nullable();
            $table->dateTime('roster_locked_at')->nullable();
            $table->text('alasan_penolakan')->nullable();
            $table->dateTime('roster_unlocked_at')->nullable();

            $table->timestamps();

            // Tidak unique: Squad yang ditolak boleh mendaftar ulang
            $table->index(['id_turnamen', 'status_pendaftaran']);
            $table->index(['id_squad', 'status_roster']);

            $table->foreign('id_squad')
                ->references('id_squad')
                ->on('squad')
                ->cascadeOnDelete();

            $table->foreign('id_turnamen')
                ->references('id_turnamen')
                ->on('turnamen')
                ->cascadeOnDelete();

            $table->foreign('id_player')
                ->references('id_player')
                ->on('players')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pendaftaran_turnamen');
    }
};
?>