<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PB-28: blokir pesan antar Player (R8.07, R8.08).
 * Satu baris per pasangan (pemblokir -> diblokir); buka blokir = status 'tidak_diblokir'.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blokir_chat', function (Blueprint $table) {
            $table->id('id_blokir');
            $table->foreignId('id_player_pemblokir')->constrained('players', 'id_player')->cascadeOnDelete();
            $table->foreignId('id_player_diblokir')->constrained('players', 'id_player')->cascadeOnDelete();
            $table->dateTime('tanggal_diblokir');
            $table->enum('status_blokir', ['diblokir', 'tidak_diblokir'])->default('diblokir');
            $table->timestamp('updated_at')->nullable();

            $table->unique(['id_player_pemblokir', 'id_player_diblokir'], 'blokir_chat_pasangan_unique');
            $table->index('id_player_diblokir');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blokir_chat');
    }
};