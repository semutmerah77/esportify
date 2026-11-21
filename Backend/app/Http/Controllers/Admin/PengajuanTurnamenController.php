<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PengajuanTurnamen;
use App\Models\Penyelenggara;
use App\Models\Turnamen;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PengajuanTurnamenController extends Controller
{
    /**
     * Menampilkan daftar pengajuan turnamen.
     */
    public function index(Request $request)
{
    $query = PengajuanTurnamen::with([
        'player.user',
        'game',
    ]);

    if ($request->filled('status')) {
        $query->where('status', $request->status);
    }

    if ($request->filled('search')) {
        $search = $request->search;

        $query->where(function ($q) use ($search) {
            $q->where('nama_turnamen', 'like', "%{$search}%")
                ->orWhere('nama_penyelenggara', 'like', "%{$search}%");
        });
    }

    $pengajuan = $query
        ->orderByRaw("
            CASE
                WHEN status = 'Menunggu Verifikasi' THEN 1
                ELSE 2
            END ASC
        ")
        ->orderByRaw('COALESCE(diajukan_ulang_pada, created_at) DESC')
        ->paginate(15);

    return response()->json([
        'message' => 'Daftar pengajuan turnamen berhasil diambil.',
        'data' => $pengajuan,
    ]);
}

    /**
     * Menampilkan detail pengajuan.
     * Status Menunggu Verifikasi berubah menjadi Sedang ditinjau.
     */
    public function show(Request $request, $id)
    {
        $admin = $request->user()->admin;

        if (!$admin) {
            return response()->json([
                'message' => 'Profil admin tidak ditemukan.',
            ], 403);
        }

        $pengajuan = DB::transaction(function () use ($id, $admin) {
            $pengajuan = PengajuanTurnamen::where(
                'id_pengajuan',
                $id
            )->lockForUpdate()->firstOrFail();

            if ($pengajuan->status === 'Sedang diedit') {
                abort(
                    409,
                    'Pengajuan sedang diedit oleh player dan belum dapat ditinjau.'
                );
            }

            if ($pengajuan->status === 'Menunggu Verifikasi') {
                $pengajuan->update([
                    'status' => 'Sedang ditinjau',
                    'id_admin' => $admin->id_admin,
                ]);
            }

            return $pengajuan;
        });

        $pengajuan->load([
            'player.user',
            'game',
            'kota.provinsi', // BARU: supaya Provinsi dan Kota terbaca di detail admin
            'sumberPendanaan',
            'pendanaan',
            'pembayaran',
            'sponsor',
            'rincian',
            'hadiahLainnya',
        ]);

        // Jangan mengirimkan path KTP melalui response detail.
        $pengajuan->makeHidden(['ktp']);

        return response()->json([
            'message' => 'Detail pengajuan berhasil diambil.',
            'data' => $pengajuan,
        ]);
    }

    public function lihatKtp(Request $request, $id)
    {
        $admin = $request->user()->admin;

        if (!$admin) {
            return response()->json([
                'message' => 'Profil admin tidak ditemukan.'
            ], 403);
        }

        $pengajuan = PengajuanTurnamen::where(
            'id_pengajuan',
            $id
        )->firstOrFail();

        // Pastikan pengajuan sedang ditinjau oleh admin yang login.
        if (
            $pengajuan->status !== 'Sedang ditinjau' ||
            $pengajuan->id_admin !== $admin->id_admin
        ) {
            return response()->json([
                'message' => 'Kamu tidak memiliki akses untuk melihat KTP pengajuan ini.'
            ], 403);
        }

        $path = $pengajuan->ktp;

        if (!$path || !Storage::disk('local')->exists($path)) {
            return response()->json([
                'message' => 'File KTP tidak ditemukan.'
            ], 404);
        }

        return response()->file(
            Storage::disk('local')->path($path),
            [
                'Content-Type' => Storage::disk('local')->mimeType($path),
                'Cache-Control' => 'private, no-store',
                'X-Content-Type-Options' => 'nosniff',
            ]
        );
    }

    /**
     * Mengembalikan pengajuan ke antrean verifikasi
     * ketika Admin keluar dari halaman detail tanpa keputusan.
     */
    public function release(Request $request, $id)
    {
        $admin = $request->user()->admin;

        if (!$admin) {
            return response()->json([
                'message' => 'Profil admin tidak ditemukan.',
            ], 403);
        }

        $pengajuan = DB::transaction(function () use ($id, $admin) {
            $pengajuan = PengajuanTurnamen::where(
                'id_pengajuan',
                $id
            )->lockForUpdate()->firstOrFail();

            if (
                $pengajuan->status !== 'Sedang ditinjau' ||
                $pengajuan->id_admin !== $admin->id_admin
            ) {
                abort(
                    409,
                    'Pengajuan tidak sedang ditinjau oleh Admin ini.'
                );
            }

            $pengajuan->update([
                'status' => 'Menunggu Verifikasi',
                'id_admin' => null,
            ]);

            return $pengajuan;
        });

        return response()->json([
            'message' => 'Pengajuan berhasil dikembalikan ke antrean verifikasi.',
            'data' => $pengajuan->fresh(),
        ]);
    }

    /**
     * Menyetujui pengajuan dan membuat data penyelenggara
     * serta turnamen.
     */
    public function approve(Request $request, $id)
    {
        $admin = $request->user()->admin;

        if (!$admin) {
            return response()->json([
                'message' => 'Profil admin tidak ditemukan.',
            ], 403);
        }

        $pengajuan = DB::transaction(function () use ($id, $admin) {
            $pengajuan = PengajuanTurnamen::where(
                'id_pengajuan',
                $id
            )->lockForUpdate()->firstOrFail();

            if ($pengajuan->status !== 'Sedang ditinjau') {
                abort(
                    409,
                    'Pengajuan harus berstatus Sedang ditinjau untuk disetujui.'
                );
            }

            if ($pengajuan->turnamen()->exists()) {
                abort(
                    409,
                    'Turnamen untuk pengajuan ini sudah dibuat.'
                );
            }

            $penyelenggara = Penyelenggara::create([
                'id_player' => $pengajuan->id_player,
            ]);

            Turnamen::create([
                'id_pengajuan' => $pengajuan->id_pengajuan,
                'id_penyelenggara' => $penyelenggara->id_penyelenggara,
                'status' => 'pendaftaran',
            ]);

            $pengajuan->update([
                'status' => 'Disetujui',
                'id_admin' => $admin->id_admin,
                'alasan_admin' => null,
                'revisi_diminta_pada' => null,
            ]);

            return $pengajuan;
        });

        return response()->json([
            'message' => 'Pengajuan berhasil disetujui dan turnamen berhasil dibuat.',
            'data' => $pengajuan->fresh(),
        ]);
    }

    /**
     * Menolak pengajuan turnamen.
     */
    public function reject(Request $request, $id)
    {
        $validated = $request->validate([
            'alasan_admin' => ['required', 'string'],
        ]);

        $admin = $request->user()->admin;

        if (!$admin) {
            return response()->json([
                'message' => 'Profil admin tidak ditemukan.',
            ], 403);
        }

        $pengajuan = DB::transaction(function () use (
            $id,
            $admin,
            $validated
        ) {
            $pengajuan = PengajuanTurnamen::where(
                'id_pengajuan',
                $id
            )->lockForUpdate()->firstOrFail();

            if ($pengajuan->status !== 'Sedang ditinjau') {
                abort(
                    409,
                    'Hanya pengajuan berstatus Sedang ditinjau yang dapat ditolak.'
                );
            }

            $pengajuan->update([
                'status' => 'Ditolak',
                'id_admin' => $admin->id_admin,
                'alasan_admin' => $validated['alasan_admin'],
                'revisi_diminta_pada' => null,
            ]);

            return $pengajuan;
        });

        return response()->json([
            'message' => 'Pengajuan berhasil ditolak.',
            'data' => $pengajuan->fresh(),
        ]);
    }

    /**
     * Meminta player melakukan revisi pengajuan.
     */
    public function requestRevision(Request $request, $id)
    {
        $validated = $request->validate([
            'alasan_admin' => ['required', 'string'],
        ]);

        $admin = $request->user()->admin;

        if (!$admin) {
            return response()->json([
                'message' => 'Profil admin tidak ditemukan.',
            ], 403);
        }

        $pengajuan = DB::transaction(function () use (
            $id,
            $admin,
            $validated
        ) {
            $pengajuan = PengajuanTurnamen::where(
                'id_pengajuan',
                $id
            )->lockForUpdate()->firstOrFail();

            if ($pengajuan->status !== 'Sedang ditinjau') {
                abort(
                    409,
                    'Hanya pengajuan berstatus Sedang ditinjau yang dapat diminta revisi.'
                );
            }

            $pengajuan->update([
                'status' => 'Revisi',
                'id_admin' => $admin->id_admin,
                'alasan_admin' => $validated['alasan_admin'],
                'revisi_diminta_pada' => now(),
            ]);

            return $pengajuan;
        });

        return response()->json([
            'message' => 'Pengajuan berhasil dikembalikan untuk revisi.',
            'data' => $pengajuan->fresh(),
        ]);
    }
}
?>