<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bukti_pertandingan', function (Blueprint $table) {
            $table->bigIncrements('id_bukti');

            $table->unsignedBigInteger('id_laporan');

            $table->string('file_bukti', 255);
            $table->text('catatan')->nullable();

            $table->dateTime('tanggal_upload');
            $table->dateTime('tanggal_verifikasi')->nullable();

            // PDM: hanya created_at
            $table->timestamp('created_at')->nullable();

            $table->foreign('id_laporan')
                ->references('id_laporan')->on('laporan_hasil_pertandingan')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bukti_pertandingan');
    }
};
