<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('anggota_squad', function (Blueprint $table) {
            $table->bigIncrements('id_anggota_squad');

            $table->unsignedBigInteger('id_squad');
            $table->unsignedBigInteger('id_player');

            // Dipakai R1.13: Leader pengganti = anggota aktif paling awal
            $table->dateTime('tanggal_bergabung');

            $table->enum('status_anggota', [
                'aktif',
                'keluar',
                'dikeluarkan',
            ])->default('aktif');

            $table->timestamps();

            // Tidak dibuat unique karena Player boleh bergabung lagi
            // setelah keluar (baris lama tetap jadi riwayat).
            $table->index(['id_squad', 'id_player', 'status_anggota']);

            $table->foreign('id_squad')
                ->references('id_squad')
                ->on('squad')
                ->cascadeOnDelete();

            $table->foreign('id_player')
                ->references('id_player')
                ->on('players')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('anggota_squad');
    }
};
?>