<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PB-27/28: percakapan chat antara dua Player.
 * id_player_1 selalu id yang lebih kecil, supaya satu pasangan cuma punya 1 percakapan.
 * Kolom dibersihkan_* / dihapus_* berlaku per Player (seperti WhatsApp).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('percakapan', function (Blueprint $table) {
            $table->id('id_percakapan');
            $table->foreignId('id_player_1')->constrained('players', 'id_player')->cascadeOnDelete();
            $table->foreignId('id_player_2')->constrained('players', 'id_player')->cascadeOnDelete();
            $table->dateTime('dibersihkan_player_1_pada')->nullable();
            $table->dateTime('dibersihkan_player_2_pada')->nullable();
            $table->dateTime('dihapus_player_1_pada')->nullable();
            $table->dateTime('dihapus_player_2_pada')->nullable();
            $table->timestamps();

            $table->unique(['id_player_1', 'id_player_2'], 'percakapan_pasangan_unique');
            $table->index('id_player_2');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('percakapan');
    }
};