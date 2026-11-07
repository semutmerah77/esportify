<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leader_squad', function (Blueprint $table) {
            $table->bigIncrements('id_leader_squad');

            // Satu Player cukup punya satu baris leader_squad,
            // meskipun ia memimpin lebih dari satu Squad.
            $table->unsignedBigInteger('id_player')->unique();

            $table->timestamps();

            $table->foreign('id_player')
                ->references('id_player')
                ->on('players')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leader_squad');
    }
};
?>