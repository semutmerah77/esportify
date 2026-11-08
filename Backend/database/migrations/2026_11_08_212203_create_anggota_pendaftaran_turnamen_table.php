<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('anggota_pendaftaran_turnamen', function (Blueprint $table) {
            $table->bigIncrements('id_anggota_pendaftaran');

            $table->unsignedBigInteger('id_pendaftaran');
            $table->unsignedBigInteger('id_player');

            // UQ_1: satu Player tidak boleh dobel dalam satu roster pendaftaran
            $table->unique(['id_pendaftaran', 'id_player']);
            $table->index('id_player');

            $table->foreign('id_pendaftaran')
                ->references('id_pendaftaran')
                ->on('pendaftaran_turnamen')
                ->cascadeOnDelete();

            $table->foreign('id_player')
                ->references('id_player')
                ->on('players')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('anggota_pendaftaran_turnamen');
    }
};
?>