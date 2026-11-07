<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('squad', function (Blueprint $table) {
            $table->bigIncrements('id_squad');

            $table->unsignedBigInteger('id_leader_squad');

            // Squad ID yang ditampilkan ke user, contoh: SQD-7K2M9Q
            $table->string('kode_squad', 20)->unique();

            $table->string('logo_squad', 255);
            $table->string('nama_squad', 100)->unique();
            $table->text('deskripsi');

            // R1.04: kapasitas sementara maksimal 7 anggota
            $table->unsignedSmallInteger('maks_anggota')->default(7);

            // R1.16: Squad otomatis diarsipkan ketika tidak punya anggota
            $table->enum('status_squad', ['aktif', 'arsip'])->default('aktif');

            $table->timestamps();

            // R1.19: Squad tidak dihapus permanen, jadi restrict
            $table->foreign('id_leader_squad')
                ->references('id_leader_squad')
                ->on('leader_squad')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('squad');
    }
};
?>