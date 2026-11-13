<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// ==========================================
// AUTH CONTROLLERS
// ==========================================
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\LoginController;

// ==========================================
// PLAYER CONTROLLERS
// ==========================================
use App\Http\Controllers\Player\ProfileController;
use App\Http\Controllers\Player\PengajuanTurnamenController;
use App\Http\Controllers\Player\SquadController;
use App\Http\Controllers\Player\PlayerSearchController;
use App\Http\Controllers\Player\PermintaanBergabungController;
use App\Http\Controllers\Player\UndanganSquadController;
use App\Http\Controllers\Api\Player\GameController as PlayerGameController;

// ==========================================
// ADMIN CONTROLLERS
// ==========================================
use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\AdminProfileController;
use App\Http\Controllers\Admin\UserManagementController;
use App\Http\Controllers\Admin\RoleManagementController;
use App\Http\Controllers\Admin\PermissionManagementController;
use App\Http\Controllers\Admin\RolePermissionController;
use App\Http\Controllers\Admin\UserRoleController;
use App\Http\Controllers\Admin\UserPermissionController;
use App\Http\Controllers\Admin\PengajuanTurnamenController as AdminPengajuanTurnamenController;

// ==========================================
// ADMIN API CONTROLLERS
// ==========================================
use App\Http\Controllers\Api\Admin\GameController;
use App\Http\Controllers\Api\Admin\KategoriController;

// ==========================================
// PUBLIC API CONTROLLERS
// ==========================================
use App\Http\Controllers\Api\LokasiController;
use App\Http\Controllers\Api\TurnamenController;
use App\Http\Controllers\Player\PendaftaranTurnamenController;
use App\Http\Controllers\Player\KelolaPendaftaranTurnamenController;
use App\Http\Controllers\Api\Player\KategoriController as PlayerKategoriController;

// ==========================================
// AUTHENTICATION
// ==========================================

Route::post('/register', [RegisterController::class, 'register']);

Route::post('/login', [LoginController::class, 'login']);

Route::post('/logout', [LoginController::class, 'logout'])
    ->middleware('auth:sanctum');


// ==========================================
// DATA LOKASI PUBLIK
// ==========================================

Route::get('/provinsi', [
    LokasiController::class,
    'provinsi'
]);

Route::get('/provinsi/{id_provinsi}/kota', [
    LokasiController::class,
    'kota'
]);


// ==========================================
// PUBLIKASI TURNAMEN DAN GAME
// ==========================================

// Daftar turnamen untuk Guest
Route::get('/turnamen', [
    TurnamenController::class,
    'index'
]);

// Daftar game untuk Guest dan seluruh pengunjung
Route::get('/public/games', [
    PlayerGameController::class,
    'index'
]);
// Daftar kategori untuk Guest dan seluruh pengunjung
Route::get('/kategori', [
    PlayerKategoriController::class,
    'index'
]);



// ==========================================
// AUTHENTICATED USER & PLAYER
// ==========================================

Route::middleware('auth:sanctum')->group(function () {

    // ==========================================
    // AUTHENTICATED USER
    // Bisa diakses Admin dan Player
    // ==========================================

    // Detail turnamen untuk pengguna yang sudah login
    Route::get('/turnamen/{id}', [
        TurnamenController::class,
        'show'
    ]);

    // Informasi akun pengguna yang sedang login
    Route::get('/user', function (Request $request) {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'id_user' => $user->id_user,
                'username' => $user->username,
                'email' => $user->email,
                'roles' => $user->getRoleNames(),
            ],
        ]);
    });


    // ==========================================
    // PLAYER ROUTES
    // Hanya bisa diakses oleh Role Player
    // ==========================================

    Route::middleware('role:player')->group(function () {

        // ==========================================
        // TURNAMEN KELOLAAN PLAYER
        // ==========================================

        Route::get('/turnamen-kelolaan', [
            TurnamenController::class,
            'kelolaan'
        ]);


        // ==========================================
        // PLAYER PROFILE
        // ==========================================

        Route::get('/profile', [
            ProfileController::class,
            'show'
        ]);

        Route::put('/profile', [
            ProfileController::class,
            'update'
        ]);


        // ==========================================
        // GAME PLAYER
        // ==========================================

        Route::middleware('permission:lihat_data_game')->group(function () {

            Route::get('/games', [
                PlayerGameController::class,
                'index'
            ]);

            Route::get('/games/{id}', [
                PlayerGameController::class,
                'show'
            ]);

        });


        // ==========================================
        // PENGAJUAN TURNAMEN PLAYER
        // ==========================================

        // Melihat pengajuan milik sendiri
        Route::middleware('permission:lihat_pengajuan_turnamen')->group(function () {

            Route::get('/pengajuan-turnamen', [
                PengajuanTurnamenController::class,
                'index'
            ]);

            Route::get('/pengajuan-turnamen/{id}', [
                PengajuanTurnamenController::class,
                'show'
            ]);
            Route::get('/pengajuan-turnamen/{id}/ktp', [
                PengajuanTurnamenController::class,
                'lihatKtp'
            ]);

        });


        // Mengajukan turnamen baru
        Route::middleware('permission:ajukan_turnamen')->group(function () {

            Route::post('/pengajuan-turnamen', [
                PengajuanTurnamenController::class,
                'store'
            ]);

        });
        
        // ==========================================
        // MODUL 3: SQUAD (PB-01)
        // ==========================================

        Route::middleware('permission:lihat_squad')->group(function () {
            // Mencari Squad (PB-03) — ?q=<nama atau kode>
            Route::get('/squad', [
                SquadController::class,
                'index'
            ]);

            // Daftar Squad yang diikuti Player login
            Route::get('/squad-saya', [
                SquadController::class,
                'mySquads'
            ]);

            // Detail Squad
            Route::get('/squad/{id}', [
                SquadController::class,
                'show'
            ]);

        });

        // Membuat Squad (multipart: nama_squad, logo_squad, deskripsi)
        Route::post('/squad', [
            SquadController::class,
            'store'
        ])->middleware('permission:buat_squad');

        // Mengubah informasi Squad (khusus Leader, dicek di controller)
        // FE: POST multipart + _method=PUT
        Route::put('/squad/{id}', [
            SquadController::class,
            'update'
        ])->middleware('permission:ubah_squad');

        
        // ==========================================
        // MODUL 3: KEANGGOTAAN SQUAD (PB-02)
        // ==========================================

        // Keluar dari Squad (anggota aktif, termasuk Leader)
        Route::post('/squad/{id}/keluar', [
            SquadController::class,
            'keluar'
        ])->middleware('permission:keluar_squad');

        // Mengeluarkan anggota (khusus Leader, dicek di controller)
        Route::delete('/squad/{id}/anggota/{idPlayer}', [
            SquadController::class,
            'keluarkanAnggota'
        ])->whereNumber('idPlayer')->middleware('permission:keluarkan_anggota_squad');

        
        // Mengalihkan kepemimpinan Squad (PB-05, khusus Leader, dicek di controller)
        Route::post('/squad/{id}/leader', [
            SquadController::class,
            'jadikanLeader'
        ])->middleware('permission:alihkan_leader_squad');

        
        // ==========================================
        // MODUL 3: PENCARIAN PLAYER (PB-03)
        // ==========================================

        // Mencari Player berdasarkan username — ?q=<username>
        Route::get('/players', [
            PlayerSearchController::class,
            'index'
        ])->middleware('permission:cari_player');


        // ==========================================
        // MODUL 3: PERMINTAAN BERGABUNG (PB-04)
        // ==========================================

        // Player mengajukan permintaan bergabung
        Route::post('/squad/{id}/permintaan', [
            PermintaanBergabungController::class,
            'ajukan'
        ])->middleware('permission:ajukan_permintaan_squad');

        // Leader melihat, menerima, dan menolak permintaan
        Route::middleware('permission:kelola_permintaan_squad')->group(function () {

            Route::get('/squad/{id}/permintaan', [
                PermintaanBergabungController::class,
                'index'
            ]);

            Route::post('/squad/{id}/permintaan/{idPermintaan}/terima', [
                PermintaanBergabungController::class,
                'terima'
            ])->whereNumber('idPermintaan');

            Route::post('/squad/{id}/permintaan/{idPermintaan}/tolak', [
                PermintaanBergabungController::class,
                'tolak'
            ])->whereNumber('idPermintaan');

        });


        // ==========================================
        // MODUL 3: UNDANGAN SQUAD (PB-04)
        // ==========================================

        // Leader mengundang Player dan melihat undangan terkirim
        Route::middleware('permission:undang_player_squad')->group(function () {

            Route::post('/squad/{id}/undangan', [
                UndanganSquadController::class,
                'kirim'
            ]);

            Route::get('/squad/{id}/undangan', [
                UndanganSquadController::class,
                'terkirim'
            ]);

        });

        // Player melihat inbox dan menanggapi undangan
        Route::middleware('permission:tanggapi_undangan_squad')->group(function () {

            Route::get('/undangan-saya', [
                UndanganSquadController::class,
                'saya'
            ]);

            Route::post('/undangan/{idUndangan}/terima', [
                UndanganSquadController::class,
                'terima'
            ])->whereNumber('idUndangan');


            Route::post('/undangan/{idUndangan}/tolak', [
                UndanganSquadController::class,
                'tolak'
            ])->whereNumber('idUndangan');

        });

        // ==========================================
        // MODUL 3: PENDAFTARAN TURNAMEN (PB-06, PB-07, PB-08)
        // ==========================================

        // Memilih Squad dan mendaftarkan Squad ke turnamen
        Route::middleware('permission:daftar_turnamen')->group(function () {

            Route::get('/turnamen/{id}/squad-saya', [
                PendaftaranTurnamenController::class,
                'squadSaya'
            ])->whereNumber('id');

            
            // Halaman 2/2: anggota Squad untuk pilih roster
            Route::get('/turnamen/{id}/squad-saya/{idSquad}', [
                PendaftaranTurnamenController::class,
                'anggotaRoster'
            ])->whereNumber('id');

            Route::post('/turnamen/{id}/daftar', [
                PendaftaranTurnamenController::class,
                'daftar'
            ])->whereNumber('id');

        });

        // Melihat detail, status, dan bukti pembayaran pendaftaran
        Route::middleware('permission:lihat_pendaftaran_turnamen')->group(function () {

            Route::get('/pendaftaran-turnamen/{id}', [
                PendaftaranTurnamenController::class,
                'show'
            ])->whereNumber('id');

            Route::get('/pendaftaran-turnamen/{id}/bukti-pembayaran', [
                PendaftaranTurnamenController::class,
                'lihatBukti'
            ])->whereNumber('id');

            Route::get('/squad/{id}/pendaftaran-turnamen', [
                PendaftaranTurnamenController::class,
                'indexSquad'
            ]);

        });

        // ==========================================
        // MODUL 3: VERIFIKASI PENDAFTARAN (PB-10)
        // & SELESAIKAN TURNAMEN / BUKA ROSTER (PB-09)
        // Hanya penyelenggara turnamen tersebut (dicek di controller)
        // ==========================================

        Route::middleware('permission:kelola_pendaftaran_turnamen')->group(function () {

            Route::get('/turnamen-kelolaan/{id}/pendaftaran', [
                KelolaPendaftaranTurnamenController::class,
                'index'
            ])->whereNumber('id');

            Route::get('/turnamen-kelolaan/{id}/pendaftaran/{idPendaftaran}', [
                KelolaPendaftaranTurnamenController::class,
                'show'
            ])->whereNumber(['id', 'idPendaftaran']);

            Route::get('/turnamen-kelolaan/{id}/pendaftaran/{idPendaftaran}/bukti-pembayaran', [
                KelolaPendaftaranTurnamenController::class,
                'lihatBukti'
            ])->whereNumber(['id', 'idPendaftaran']);

            Route::post('/turnamen-kelolaan/{id}/pendaftaran/{idPendaftaran}/terima', [
                KelolaPendaftaranTurnamenController::class,
                'terima'
            ])->whereNumber(['id', 'idPendaftaran']);

            Route::post('/turnamen-kelolaan/{id}/pendaftaran/{idPendaftaran}/tolak', [
                KelolaPendaftaranTurnamenController::class,
                'tolak'
            ])->whereNumber(['id', 'idPendaftaran']);

            Route::get('/turnamen-kelolaan/{id}/peserta', [
                KelolaPendaftaranTurnamenController::class,
                'peserta'
            ])->whereNumber('id');

        });

        // NONAKTIF SEMENTARA: status "selesai" ditetapkan saat bracket
        // menemukan pemenang (Sprint 3), bukan lewat tombol.
        // Kode KelolaPendaftaranTurnamenController@selesaikan dan
        // PendaftaranTurnamenService::selesaikanTurnamen() tetap disimpan.
        
        // Route::post('/turnamen-kelolaan/{id}/selesaikan', [
        //     KelolaPendaftaranTurnamenController::class,
        //     'selesaikan'
        // ])->whereNumber('id')->middleware('permission:selesaikan_turnamen');


        // Mengubah pengajuan ketika mendapatkan kesempatan revisi
        Route::middleware('permission:ubah_pengajuan_turnamen')->group(function () {

            Route::post('/pengajuan-turnamen/{id}/start-edit', [
                PengajuanTurnamenController::class,
                'startEdit'
            ]);

            Route::put('/pengajuan-turnamen/{id}', [
                PengajuanTurnamenController::class,
                'update'
            ]);

        });

    });

});


// ==========================================
// ADMIN PANEL
// ==========================================

Route::middleware(['auth:sanctum', 'role:admin'])
    ->prefix('admin')
    ->group(function () {

       
    // ==========================================
    // KELOLA PENGAJUAN TURNAMEN
    // TETAP BISA DIAKSES MESKIPUN TENGGAT HABIS
    // ==========================================

    // Melihat seluruh pengajuan
    Route::get('/pengajuan-turnamen', [
        AdminPengajuanTurnamenController::class,
        'index'
    ])->middleware('permission:lihat_semua_pengajuan_turnamen');

    // Melihat detail pengajuan
    Route::get('/pengajuan-turnamen/{id}', [
        AdminPengajuanTurnamenController::class,
        'show'
    ])->middleware('permission:lihat_semua_pengajuan_turnamen');

    // Melihat file KTP pengajuan
    Route::get('/pengajuan-turnamen/{id}/ktp', [
        AdminPengajuanTurnamenController::class,
        'lihatKtp'
    ])->middleware('permission:lihat_semua_pengajuan_turnamen');

    // Menyetujui pengajuan
    Route::post('/pengajuan-turnamen/{id}/approve', [
        AdminPengajuanTurnamenController::class,
        'approve'
    ])->middleware('permission:setujui_pengajuan_turnamen');

    // Menolak pengajuan
    Route::post('/pengajuan-turnamen/{id}/reject', [
        AdminPengajuanTurnamenController::class,
        'reject'
    ])->middleware('permission:tolak_pengajuan_turnamen');

    // Memberikan revisi
    Route::post('/pengajuan-turnamen/{id}/revision', [
        AdminPengajuanTurnamenController::class,
        'requestRevision'
    ])->middleware('permission:berikan_revisi_pengajuan_turnamen');

    // Mengembalikan pengajuan ke antrean verifikasi
    Route::post('/pengajuan-turnamen/{id}/release', [
        AdminPengajuanTurnamenController::class,
        'release'
    ])->middleware('permission:lihat_semua_pengajuan_turnamen');



        // ==========================================
        // ADMIN PANEL LAINNYA
        // AKAN TERKUNCI JIKA ADA PENGAJUAN TERLAMBAT
        // ==========================================

        Route::middleware('admin.pengajuan.deadline')->group(function () {

            // ==========================================
            // ADMIN PROFILE
            // ==========================================

            Route::get('/profile', [
                AdminProfileController::class,
                'show'
            ]);

            Route::put('/profile', [
                AdminProfileController::class,
                'update'
            ]);


            // ==========================================
            // DASHBOARD
            // ==========================================

            Route::get('/dashboard', [
                AdminController::class,
                'dashboard'
            ])->middleware('permission:lihat_dashboard');


            // ==========================================
            // KELOLA USER
            // ==========================================

            Route::get('/users', [
                UserManagementController::class,
                'index'
            ])->middleware('permission:lihat_data_user');

            Route::post('/users', [
                UserManagementController::class,
                'store'
            ])->middleware('permission:tambah_data_user');

            Route::get('/users/permissions', [
                UserPermissionController::class,
                'indexAll'
            ])->middleware('permission:atur_permission_user');

            Route::get('/users/{id}', [
                UserManagementController::class,
                'show'
            ])->middleware('permission:lihat_data_user');

            Route::patch('/users/{id}', [
                UserManagementController::class,
                'update'
            ])->middleware('permission:ubah_data_user');

            Route::delete('/users/{id}', [
                UserManagementController::class,
                'destroy'
            ])->middleware('permission:hapus_data_user');


            // ==========================================
            // KELOLA ROLE
            // ==========================================

            Route::get('/roles', [
                RoleManagementController::class,
                'index'
            ])->middleware('permission:kelola_role');

            Route::get('/roles/{id}', [
                RoleManagementController::class,
                'show'
            ])->middleware('permission:kelola_role');

            Route::post('/roles', [
                RoleManagementController::class,
                'store'
            ])->middleware('permission:kelola_role');

            Route::patch('/roles/{id}', [
                RoleManagementController::class,
                'update'
            ])->middleware('permission:kelola_role');

            Route::delete('/roles/{id}', [
                RoleManagementController::class,
                'destroy'
            ])->middleware('permission:kelola_role');


            // ==========================================
            // KELOLA PERMISSION
            // ==========================================

            Route::get('/permissions', [
                PermissionManagementController::class,
                'index'
            ])->middleware('permission:kelola_permission');

            Route::get('/permissions/{id}', [
                PermissionManagementController::class,
                'show'
            ])->middleware('permission:kelola_permission');

            Route::post('/permissions', [
                PermissionManagementController::class,
                'store'
            ])->middleware('permission:kelola_permission');

            Route::patch('/permissions/{id}', [
                PermissionManagementController::class,
                'update'
            ])->middleware('permission:kelola_permission');

            Route::delete('/permissions/{id}', [
                PermissionManagementController::class,
                'destroy'
            ])->middleware('permission:kelola_permission');


            // ==========================================
            // PENGATURAN ROLE & PERMISSION
            // ==========================================

            Route::get('/roles/{id}/permissions', [
                RolePermissionController::class,
                'index'
            ])->middleware('permission:atur_permission_role');

            Route::post('/roles/{id}/permissions', [
                RolePermissionController::class,
                'store'
            ])->middleware('permission:atur_permission_role');


            // ==========================================
            // PENGATURAN USER & ROLE
            // ==========================================

            Route::get('/users/{id}/roles', [
                UserRoleController::class,
                'index'
            ])->middleware('permission:atur_role_user');

            Route::post('/users/{id}/roles', [
                UserRoleController::class,
                'store'
            ])->middleware('permission:atur_role_user');


            // ==========================================
            // PENGATURAN USER & PERMISSION
            // ==========================================

            Route::get('/users/{id}/permissions', [
                UserPermissionController::class,
                'index'
            ])->middleware('permission:atur_permission_user');

            Route::post('/users/{id}/permissions', [
                UserPermissionController::class,
                'update'
            ])->middleware('permission:atur_permission_user');


            // ==========================================
            // KELOLA GAME ADMIN
            // ==========================================

            Route::get('/games', [
                GameController::class,
                'index'
            ])->middleware('permission:lihat_data_game');

            Route::get('/games/{id}', [
                GameController::class,
                'show'
            ])->middleware('permission:lihat_data_game');

            Route::post('/games', [
                GameController::class,
                'store'
            ])->middleware('permission:tambah_data_game');

            Route::patch('/games/{id}', [
                GameController::class,
                'update'
            ])->middleware('permission:ubah_data_game');

            Route::delete('/games/{id}', [
                GameController::class,
                'destroy'
            ])->middleware('permission:hapus_data_game');


            // ==========================================
            // KELOLA KATEGORI
            // ==========================================

            Route::get('/categories', [
                KategoriController::class,
                'index'
            ])->middleware('permission:lihat_data_kategori');

            Route::get('/categories/{id}', [
                KategoriController::class,
                'show'
            ])->middleware('permission:lihat_data_kategori');

            Route::post('/categories', [
                KategoriController::class,
                'store'
            ])->middleware('permission:tambah_data_kategori');

            Route::patch('/categories/{id}', [
                KategoriController::class,
                'update'
            ])->middleware('permission:ubah_data_kategori');

            Route::delete('/categories/{id}', [
                KategoriController::class,
                'destroy'
            ])->middleware('permission:hapus_data_kategori');

        });

    });
?>