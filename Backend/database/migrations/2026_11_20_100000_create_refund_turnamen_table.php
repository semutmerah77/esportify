<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * PB-26: pengembalian dana (refund) peserta turnamen berbayar yang dibatalkan.
 *
 * Satu baris per pendaftaran diterima, dibuat otomatis saat Admin menyetujui
 * pembatalan. metode_refund & atas_nama NULL sampai pendaftar mengisi data.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refund_turnamen', function (Blueprint $table) {
            $table->id('id_refund');
            $table->unsignedBigInteger('id_pendaftaran')->unique();
            $table->enum('metode_refund', ['transfer_bank', 'qris'])->nullable();
            $table->string('nomor_rekening', 150)->nullable();
            $table->string('file_qris', 255)->nullable();
            $table->string('atas_nama', 150)->nullable();
            $table->string('bukti_transfer', 255)->nullable();
            $table->enum('status_refund', ['menunggu_data', 'menunggu_transfer', 'selesai'])->default('menunggu_data');
            $table->dateTime('tanggal_pengajuan')->nullable();
            $table->dateTime('tanggal_refund')->nullable();

            $table->foreign('id_pendaftaran')->references('id_pendaftaran')->on('pendaftaran_turnamen')->cascadeOnDelete();
        });

        // Turnamen berbayar yang sudah dibatalkan sebelum fitur ini ada
        DB::table('refund_turnamen')->insertUsing(
            ['id_pendaftaran', 'status_refund'],
            DB::table('pendaftaran_turnamen as p')
                ->join('turnamen as t', 't.id_turnamen', '=', 'p.id_turnamen')
                ->join('pendanaan as d', 'd.id_pengajuan', '=', 't.id_pengajuan')
                ->where('t.status', 'dibatalkan')
                ->where('d.jenis_biaya', 'berbayar')
                ->where('p.status_pendaftaran', 'diterima')
                ->select('p.id_pendaftaran', DB::raw("'menunggu_data'"))
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('refund_turnamen');
    }
};
