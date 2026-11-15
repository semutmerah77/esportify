<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pengumuman', function (Blueprint $table) {
            $table->bigIncrements('id_pengumuman');

            $table->unsignedBigInteger('id_turnamen');
            $table->unsignedBigInteger('id_penyelenggara');

            $table->string('judul', 150);
            $table->text('isi_pengumuman');

            $table->timestamps();

            $table->index(['id_turnamen', 'created_at']);

            $table->foreign('id_turnamen')
                ->references('id_turnamen')->on('turnamen')
                ->cascadeOnDelete();

            $table->foreign('id_penyelenggara')
                ->references('id_penyelenggara')->on('penyelenggara')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pengumuman');
    }
};
