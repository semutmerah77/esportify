<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TurnamenSeeder extends Seeder
{
    public function run(): void
    {
        $player = DB::table('players')->first();
        $games = DB::table('games')->get();
        $kotas = DB::table('kota')->get();

        if (!$player) {
            $this->command->error('Belum ada data players. Register 1 akun Player dulu.');
            return;
        }

        if ($games->isEmpty()) {
            $this->command->error('Belum ada data games.');
            return;
        }

        // Penyelenggara milik player (dipakai ulang kalau sudah ada).
        $idPenyelenggara = DB::table('penyelenggara')
            ->where('id_player', $player->id_player)
            ->value('id_penyelenggara');

        if (!$idPenyelenggara) {
            $idPenyelenggara = DB::table('penyelenggara')->insertGetId([
                'id_player' => $player->id_player,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Ambil kota dari provinsi yang berbeda-beda, supaya filter lokasi bisa dites.
        $kotaPerProvinsi = $kotas->groupBy('id_provinsi')->map->first()->values();

        // days = jadwal main (hari dari sekarang), tutup = tutup pendaftaran (hari dari sekarang)
        $data = [
            ['nama' => 'Seed Cup Online Gratis',     'tipe' => 'online',  'days' => 2,   'tutup' => 1,   'fee' => 0,     'hadiah' => 500000,   'slot' => 32],
            ['nama' => 'Seed Cup Offline Gratis',    'tipe' => 'offline', 'days' => 5,   'tutup' => 3,   'fee' => 0,     'hadiah' => 3000000,  'slot' => 16],
            ['nama' => 'Seed Series Online Berbayar','tipe' => 'online',  'days' => 12,  'tutup' => 10,  'fee' => 25000, 'hadiah' => 1500000,  'slot' => 64],
            ['nama' => 'Seed Championship Offline',  'tipe' => 'offline', 'days' => 20,  'tutup' => 17,  'fee' => 50000, 'hadiah' => 10000000, 'slot' => 32],
            ['nama' => 'Seed Open Online Berbayar',  'tipe' => 'online',  'days' => 28,  'tutup' => 25,  'fee' => 15000, 'hadiah' => 750000,   'slot' => 128],
            ['nama' => 'Seed League Offline Gratis', 'tipe' => 'offline', 'days' => 45,  'tutup' => 40,  'fee' => 0,     'hadiah' => 5000000,  'slot' => 24],
            ['nama' => 'Seed Masters Offline',       'tipe' => 'offline', 'days' => 70,  'tutup' => 60,  'fee' => 75000, 'hadiah' => 20000000, 'slot' => 48],
            ['nama' => 'Seed Grand Final Online',    'tipe' => 'online',  'days' => 100, 'tutup' => 90,  'fee' => 0,     'hadiah' => 2500000,  'slot' => 64],
            // Hari ini (status berlangsung), pendaftaran sudah ditutup.
            ['nama' => 'Seed Cup Hari Ini',          'tipe' => 'offline', 'days' => 0,   'tutup' => -3,  'fee' => 10000, 'hadiah' => 1000000,  'slot' => 16],
        ];

        DB::transaction(function () use ($data, $player, $games, $kotaPerProvinsi, $idPenyelenggara) {
            $offlineIndex = 0;

            foreach ($data as $i => $row) {
                // Lewati kalau sudah pernah di-seed.
                if (DB::table('pengajuan_turnamen')->where('nama_turnamen', $row['nama'])->exists()) {
                    continue;
                }

                $game = $games[$i % $games->count()];
                $isOffline = $row['tipe'] === 'offline' && $kotaPerProvinsi->isNotEmpty();

                $kota = $isOffline
                    ? $kotaPerProvinsi[$offlineIndex++ % $kotaPerProvinsi->count()]
                    : null;

                $jadwalMain = Carbon::now()->addDays($row['days'])->setTime(13, 0, 0);
                $jadwalTutup = Carbon::now()->addDays($row['tutup'])->setTime(23, 59, 0);

                $idPengajuan = DB::table('pengajuan_turnamen')->insertGetId([
                    'id_player' => $player->id_player,
                    'id_game' => $game->id_game,
                    'id_admin' => null,
                    'poster' => 'poster-turnamen/seed.jpg',
                    'nama_turnamen' => $row['nama'],
                    'nama_penanggung_jawab' => 'Penanggung Jawab Seed',
                    'nama_instansi' => null,
                    'nomor_instansi' => null,
                    'tipe_turnamen' => $isOffline ? 'offline' : 'online',
                    'id_kota' => $kota?->id_kota,
                    'deskripsi_lokasi' => $isOffline ? 'Lokasi contoh untuk data uji.' : null,
                    'slot' => $row['slot'],
                    'jadwal_pendaftaran_tutup' => $jadwalTutup,
                    'jadwal_main' => $jadwalMain,
                    'deskripsi_turnamen' => 'Deskripsi contoh untuk data uji turnamen.',
                    'total_hadiah' => $row['hadiah'],
                    'ktp' => 'ktp/seed.jpg',
                    'setuju_pertanggungjawaban' => 1,
                    'status' => 'Disetujui',
                    'alasan_admin' => null,
                    'revisi_diminta_pada' => null,
                    'rincian_pendanaan' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $berbayar = $row['fee'] > 0;

                DB::table('pendanaan')->insert([
                    'id_pengajuan' => $idPengajuan,
                    'jenis_biaya' => $berbayar ? 'berbayar' : 'gratis',
                    'biaya_pendaftaran' => $berbayar ? $row['fee'] : null,
                ]);

                if ($berbayar) {
                    DB::table('pembayaran')->insert([
                        'id_pengajuan' => $idPengajuan,
                        'metode_pembayaran' => 'transfer',
                        'qris' => null,
                        'no_rekening' => '1234567890',
                    ]);
                }

                DB::table('turnamen')->insert([
                    'id_pengajuan' => $idPengajuan,
                    'id_penyelenggara' => $idPenyelenggara,
                    'status' => $row['days'] === 0 ? 'berlangsung' : 'pendaftaran',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('rincian_pendanaan_pengajuan')->insert([
                [
                    'id_pengajuan' => $idPengajuan,
                    'peruntukanDana' => 'Hadiah pemenang',
                    'keterangan' => 'Juara 1 sampai 3',
                    'nominal' => $row['hadiah'],
                ],
                [
                    'id_pengajuan' => $idPengajuan,
                    'peruntukanDana' => 'Operasional',
                    'keterangan' => 'Server, konsumsi, dan perlengkapan',
                    'nominal' => 500000,
                ],
            ]);
            }
        });

        $this->command->info('Seeder turnamen selesai.');
    }
}