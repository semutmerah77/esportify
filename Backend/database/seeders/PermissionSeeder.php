<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            // Dashboard
            'lihat_dashboard',

            // Modul 1: Manajemen User
            'lihat_data_user',
            'tambah_data_user',
            'ubah_data_user',
            'hapus_data_user',

            // Modul 1: Manajemen Role dan Permission
            'kelola_role',
            'kelola_permission',
            'atur_role_user',
            'atur_permission_role',
            'atur_permission_user',

            // Modul 1: Profil Player
            'lihat_profil',
            'ubah_profil',
            'ubah_password',

            // Modul 2: Game
            'lihat_data_game',
            'tambah_data_game',
            'ubah_data_game',
            'hapus_data_game',

            // Modul 2: Kategori
            'lihat_data_kategori',
            'tambah_data_kategori',
            'ubah_data_kategori',
            'hapus_data_kategori',

            // Modul 2: Player dan Publikasi Turnamen
            'lihat_turnamen',
            'lihat_detail_turnamen',
            'ajukan_turnamen',
            'lihat_pengajuan_turnamen',
            'ubah_pengajuan_turnamen',
            'ajukan_ulang_turnamen',
            'ubah_turnamen',

            // Modul 2: Moderasi Pengajuan oleh Admin
            'lihat_semua_pengajuan_turnamen',
            'setujui_pengajuan_turnamen',
            'tolak_pengajuan_turnamen',
            'berikan_revisi_pengajuan_turnamen',

            // Modul 3: Squad
            'lihat_squad',
            'buat_squad',
            'ubah_squad',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
?>