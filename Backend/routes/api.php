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