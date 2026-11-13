<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hadiah_lainnya_pengajuan', function (Blueprint $table) {
            $table->bigIncrements('id_hadiah');
            $table->unsignedBigInteger('id_pengajuan');

            $table->string('nama_hadiah', 150);
            $table->string('keterangan', 255)->nullable();

            $table->foreign('id_pengajuan')
                ->references('id_pengajuan')
                ->on('pengajuan_turnamen')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hadiah_lainnya_pengajuan');
    }
};