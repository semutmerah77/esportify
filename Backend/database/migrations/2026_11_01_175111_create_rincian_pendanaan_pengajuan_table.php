<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rincian_pendanaan_pengajuan', function (Blueprint $table) {
            $table->bigIncrements('id_rincian');
            $table->unsignedBigInteger('id_pengajuan');

            $table->string('peruntukanDana', 100);
            $table->text('keterangan')->nullable();
            $table->decimal('nominal', 12, 2);

            $table->foreign('id_pengajuan')
                ->references('id_pengajuan')
                ->on('pengajuan_turnamen')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rincian_pendanaan_pengajuan');
    }
};