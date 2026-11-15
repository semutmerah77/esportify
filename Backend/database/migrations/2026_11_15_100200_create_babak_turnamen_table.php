<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('babak_turnamen', function (Blueprint $table) {
            $table->bigIncrements('id_babak');

            $table->unsignedBigInteger('id_bracket');

            // 1 = babak pertama. Perebutan Juara 3 memakai urutan yang sama dengan Final.
            $table->unsignedTinyInteger('urutan_babak');

            // Bisa diubah Penyelenggara (AD Edit Babak: Judul Babak, Jam)
            $table->string('nama_babak', 50)->nullable();
            $table->dateTime('waktu_mulai')->nullable();

            $table->timestamps();

            $table->index(['id_bracket', 'urutan_babak']);

            $table->foreign('id_bracket')
                ->references('id_bracket')
                ->on('bracket_turnamen')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('babak_turnamen');
    }
};
