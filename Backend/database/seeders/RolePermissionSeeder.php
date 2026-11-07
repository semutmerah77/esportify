<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        // Permission untuk Admin
        $adminPermissions = [
            // Dashboard
            'lihat_dashboard',

            // Manajemen User
            'lihat_data_user',
            'tambah_data_user',
            'ubah_data_user',
            'hapus_data_user',

            // Manajemen Role dan Permission
            'kelola_role',
            'kelola_permission',
            'atur_role_user',
            'atur_permission_role',
            'atur_permission_user',

            // Game
            'lihat_data_game',
            'tambah_data_game',
            'ubah_data_game',
            'hapus_data_game',

            // Kategori
            'lihat_data_kategori',
            'tambah_data_kategori',
            'ubah_data_kategori',
            'hapus_data_kategori',

            // Moderasi Pengajuan Turnamen
            'lihat_semua_pengajuan_turnamen',
            'setujui_pengajuan_turnamen',
            'tolak_pengajuan_turnamen',
            'berikan_revisi_pengajuan_turnamen',
        ];

        // Permission untuk Player
        $playerPermissions = [
            // Game
            'lihat_data_game',

            // Profil
            'lihat_profil',
            'ubah_profil',
            'ubah_password',

            // Turnamen
            'lihat_turnamen',
            'lihat_detail_turnamen',
            'ajukan_turnamen',
            'lihat_pengajuan_turnamen',
            'ubah_pengajuan_turnamen',
            'ajukan_ulang_turnamen',
            'ubah_turnamen',

            // Squad
            'lihat_squad',
            'buat_squad',
            'ubah_squad',
            'keluar_squad',
            'keluarkan_anggota_squad',
            'cari_player',
            'ajukan_permintaan_squad',
            'kelola_permintaan_squad',
            'undang_player_squad',
            'tanggapi_undangan_squad',
        ];

        $admin = Role::findByName('admin', 'web');
        $player = Role::findByName('player', 'web');

        // Sinkronisasi Permission Admin
        $admin->syncPermissions($adminPermissions);

        // Sinkronisasi Permission Player
        $player->syncPermissions($playerPermissions);

        // Role Owner sengaja tidak disentuh.

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
?>