<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bracket_turnamen', function (Blueprint $table) {
            $table->bigIncrements('id_bracket');

            // Satu turnamen hanya punya satu bracket
            $table->unsignedBigInteger('id_turnamen')->unique();

            $table->enum('status_bracket', ['draft', 'dipublikasikan'])->default('draft');
            $table->dateTime('tanggal_publikasi')->nullable();

            $table->timestamps();

            $table->foreign('id_turnamen')
                ->references('id_turnamen')
                ->on('turnamen')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bracket_turnamen');
    }
};
