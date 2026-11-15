<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * status_pertandingan:
 * - menunggu    : salah satu / kedua slot belum terisi
 * - berlangsung : kedua Squad sudah ditentukan, skor belum ada
 * - selesai     : sudah ada pemenang (termasuk bye)
 *
 * is_bye = true : hanya 1 Squad (slot A), langsung selesai dan maju.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pertandingan', function (Blueprint $table) {
            $table->bigIncrements('id_pertandingan');

            $table->unsignedBigInteger('id_bracket');
            $table->unsignedBigInteger('id_babak');

            $table->unsignedInteger('nomor_pertandingan');

            $table->unsignedBigInteger('id_pendaftaran_a')->nullable();
            $table->unsignedBigInteger('id_pendaftaran_b')->nullable();
            $table->unsignedBigInteger('id_pendaftaran_pemenang')->nullable();

            $table->unsignedInteger('skor_a')->nullable();
            $table->unsignedInteger('skor_b')->nullable();

            $table->boolean('is_bye')->default(false);

            // Pemenang maju ke sini
            $table->unsignedBigInteger('id_pertandingan_selanjutnya')->nullable();
            $table->enum('posisi_pemenang_selanjutnya', ['A', 'B'])->nullable();

            // Yang kalah di semifinal ke perebutan Juara 3
            $table->unsignedBigInteger('id_pertandingan_kalah_selanjutnya')->nullable();
            $table->enum('posisi_kalah_selanjutnya', ['A', 'B'])->nullable();

            $table->enum('status_pertandingan', ['menunggu', 'berlangsung', 'selesai'])->default('menunggu');

            $table->timestamps();

            $table->unique(['id_bracket', 'nomor_pertandingan']);

            $table->foreign('id_bracket')
                ->references('id_bracket')->on('bracket_turnamen')
                ->cascadeOnDelete();

            $table->foreign('id_babak')
                ->references('id_babak')->on('babak_turnamen')
                ->cascadeOnDelete();

            foreach (['id_pendaftaran_a', 'id_pendaftaran_b', 'id_pendaftaran_pemenang'] as $kolom) {
                $table->foreign($kolom)
                    ->references('id_pendaftaran')->on('pendaftaran_turnamen')
                    ->nullOnDelete();
            }

            $table->foreign('id_pertandingan_selanjutnya')
                ->references('id_pertandingan')->on('pertandingan')
                ->nullOnDelete();

            $table->foreign('id_pertandingan_kalah_selanjutnya')
                ->references('id_pertandingan')->on('pertandingan')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pertandingan');
    }
};
