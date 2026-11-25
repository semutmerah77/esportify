<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PB-30 — tabel notifikasi bawaan Laravel Database Notifications (sesuai PDM).
 * Satu tabel untuk semua jenis notifikasi; isi & tujuan navigasi di kolom data (JSON).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->string('notifiable_type');
            $table->unsignedBigInteger('notifiable_id');
            $table->json('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            // daftar & titik biru: milik user X, 30 hari terakhir, urut terbaru
            $table->index(['notifiable_type', 'notifiable_id', 'created_at'], 'notifications_penerima_waktu_index');
            // pembersihan > 30 hari
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};