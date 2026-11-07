<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('permintaan_bergabung', function (Blueprint $table) {
            $table->bigIncrements('id_permintaan');

            $table->unsignedBigInteger('id_squad');
            $table->unsignedBigInteger('id_player');
            $table->unsignedBigInteger('id_leader_squad');

            $table->enum('status_permintaan', [
                'menunggu',
                'diterima',
                'ditolak',
            ])->default('menunggu');

            $table->dateTime('tanggal_diproses')->nullable();

            $table->timestamps();

            $table->index(['id_squad', 'status_permintaan']);
            $table->index(['id_player', 'status_permintaan']);

            $table->foreign('id_squad')
                ->references('id_squad')

                ->on('squad')
                ->cascadeOnDelete();

            $table->foreign('id_player')
                ->references('id_player')
                ->on('players')
                ->cascadeOnDelete();

            $table->foreign('id_leader_squad')
                ->references('id_leader_squad')
                ->on('leader_squad')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('permintaan_bergabung');
    }
};
?>