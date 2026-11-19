<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PB-25: pengajuan pembatalan turnamen + bukti pendukungnya (PDM terbaru,
 * ditambah penjelasan_pembatalan sesuai keputusan SA).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pengajuan_pembatalan_turnamen', function (Blueprint $table) {
            $table->id('id_pengajuan_pembatalan');
            $table->unsignedBigInteger('id_turnamen');
            $table->unsignedBigInteger('id_penyelenggara');
            $table->unsignedBigInteger('id_admin')->nullable();
            $table->text('alasan_pembatalan');
            $table->text('penjelasan_pembatalan');
            $table->enum('status_pengajuan', ['menunggu', 'disetujui', 'ditolak'])->default('menunggu');
            $table->text('catatan_admin')->nullable();
            $table->dateTime('rencana_pengembalian_dana')->nullable();
            $table->dateTime('tanggal_pengajuan');
            $table->dateTime('tanggal_verifikasi')->nullable();

            $table->foreign('id_turnamen')->references('id_turnamen')->on('turnamen')->cascadeOnDelete();
            $table->foreign('id_penyelenggara')->references('id_penyelenggara')->on('penyelenggara')->cascadeOnDelete();
            $table->foreign('id_admin')->references('id_admin')->on('admins')->nullOnDelete();
            $table->index(['status_pengajuan', 'tanggal_pengajuan'], 'pembatalan_status_tanggal_index');
        });

        Schema::create('bukti_pembatalan_turnamen', function (Blueprint $table) {
            $table->id('id_bukti_pembatalan');
            $table->unsignedBigInteger('id_pengajuan_pembatalan');
            $table->unsignedBigInteger('id_penyelenggara');
            $table->string('file_bukti_pendukung', 255);
            $table->timestamp('created_at')->nullable();

            $table->foreign('id_pengajuan_pembatalan')->references('id_pengajuan_pembatalan')->on('pengajuan_pembatalan_turnamen')->cascadeOnDelete();
            $table->foreign('id_penyelenggara')->references('id_penyelenggara')->on('penyelenggara')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bukti_pembatalan_turnamen');
        Schema::dropIfExists('pengajuan_pembatalan_turnamen');
    }
};
