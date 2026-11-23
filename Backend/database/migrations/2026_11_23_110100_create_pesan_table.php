<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PB-27/28: pesan teks dalam percakapan (R8.04).
 * dibaca_pada NULL = belum dibaca penerima (R8.05 indikator Terbaca).
 * Pesan > 6 bulan dihapus otomatis oleh scheduler chat:hapus-pesan-lama (R8.06).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pesan', function (Blueprint $table) {
            $table->id('id_pesan');
            $table->foreignId('id_percakapan')->constrained('percakapan', 'id_percakapan')->cascadeOnDelete();
            $table->foreignId('id_player_pengirim')->constrained('players', 'id_player')->cascadeOnDelete();
            $table->text('isi_pesan');
            $table->dateTime('dibaca_pada')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['id_percakapan', 'created_at'], 'pesan_percakapan_waktu_index');
            $table->index(['id_percakapan', 'id_player_pengirim', 'dibaca_pada'], 'pesan_belum_dibaca_index');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pesan');
    }
};