<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('undangan_squad', function (Blueprint $table) {
            $table->bigIncrements('id_undangan');

            $table->unsignedBigInteger('id_squad');
            $table->unsignedBigInteger('id_leader_squad');
            $table->unsignedBigInteger('id_player');

            // R1.09: undangan tidak memiliki masa kedaluwarsa
            $table->enum('status_undangan', [
                'menunggu',
                'diterima',
                'ditolak',
            ])->default('menunggu');

            $table->timestamps();

            $table->index(['id_player', 'status_undangan']);
            $table->index(['id_squad', 'status_undangan']);

            $table->foreign('id_squad')
                ->references('id_squad')
                ->on('squad')

                ->cascadeOnDelete();

            $table->foreign('id_leader_squad')
                ->references('id_leader_squad')
                ->on('leader_squad')
                ->cascadeOnDelete();

            $table->foreign('id_player')
                ->references('id_player')
                ->on('players')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('undangan_squad');
    }
};
?>