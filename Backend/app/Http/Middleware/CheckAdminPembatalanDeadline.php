<?php

namespace App\Http\Middleware;

use App\Services\PembatalanTurnamenService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * PB-25 (AD Verifikasi Pembatalan): jika ada pengajuan pembatalan yang belum
 * diproses lebih dari 3 hari, halaman Admin lainnya dikunci (forced action),
 * sama seperti mekanisme pengajuan turnamen.
 */
class CheckAdminPembatalanDeadline
{
    public function __construct(private PembatalanTurnamenService $pembatalan)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $terlambat = $this->pembatalan->pengajuanTerlambat();

        if ($terlambat->isNotEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Ada pengajuan pembatalan turnamen yang belum diproses lebih dari '
                    . PembatalanTurnamenService::BATAS_HARI_VERIFIKASI
                    . ' hari dan wajib diputuskan terlebih dahulu.',
                'data' => [
                    'jenis' => 'pembatalan_turnamen',
                    'jumlah_pengajuan_terlambat' => $terlambat->count(),
                    'pengajuan' => $terlambat->map(fn ($p) => [
                        'id_pengajuan_pembatalan' => $p->id_pengajuan_pembatalan,
                        'nama_turnamen' => $p->turnamen?->pengajuan?->nama_turnamen,
                        'tanggal_pengajuan' => $p->tanggal_pengajuan?->toIso8601String(),
                    ])->values(),
                ],
            ], 423);
        }

        return $next($request);
    }
}
