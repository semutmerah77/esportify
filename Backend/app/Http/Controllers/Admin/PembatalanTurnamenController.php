<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BuktiPembatalanTurnamen;
use App\Models\PengajuanPembatalanTurnamen;
use App\Models\Turnamen;
use App\Services\PembatalanTurnamenService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Sisi Admin: verifikasi pengajuan pembatalan turnamen (PB-25, US60).
 * Tetap bisa diakses walaupun ada pengajuan yang melewati batas 3 hari.
 */
class PembatalanTurnamenController extends Controller
{
    private const PREFIX_BUKTI = '/api/admin/pembatalan-turnamen';

    public function __construct(private PembatalanTurnamenService $pembatalan)
    {
    }

    /**
     * GET /admin/pembatalan-turnamen?status=menunggu|riwayat
     */
    public function index(Request $request)
    {
        $tab = $request->query('status') === 'riwayat' ? 'riwayat' : 'menunggu';

        $query = PengajuanPembatalanTurnamen::query();
        $tab === 'menunggu'
            ? $query->menunggu()->orderBy('tanggal_pengajuan')
            : $query->where('status_pengajuan', '!=', PengajuanPembatalanTurnamen::STATUS_MENUNGGU)->orderByDesc('tanggal_verifikasi');

        $data = $query->get()
            ->map(fn ($p) => $this->pembatalan->format($p, self::PREFIX_BUKTI, true))
            ->values();

        $terlambat = $this->pembatalan->pengajuanTerlambat();

        return response()->json([
            'success' => true,
            'message' => $data->isEmpty() ? 'Belum ada pengajuan pembatalan.' : 'Daftar pengajuan pembatalan berhasil diambil.',
            'data' => $data,
            'meta' => [
                'jumlah_menunggu' => PengajuanPembatalanTurnamen::menunggu()->count(),
                'jumlah_melewati_batas' => $terlambat->count(),
                'batas_hari_verifikasi' => PembatalanTurnamenService::BATAS_HARI_VERIFIKASI,
                'pilihan_alasan_penolakan' => collect(PembatalanTurnamenService::ALASAN_PENOLAKAN)
                    ->map(fn ($label, $kode) => ['kode' => $kode, 'label' => $label])->values(),
            ],
        ]);
    }

    /**
     * GET /admin/pembatalan-turnamen/{id}
     */
    public function show($id)
    {
        $pengajuan = PengajuanPembatalanTurnamen::find($id);
        if (!$pengajuan) {
            return $this->tidakDitemukan();
        }

        $alasan = $this->pembatalan->alasanTidakBisaDiverifikasi($pengajuan);

        return response()->json([
            'success' => true,
            'message' => 'Detail pengajuan pembatalan berhasil diambil.',
            'data' => $this->pembatalan->format($pengajuan, self::PREFIX_BUKTI, true) + [
                'bisa_diverifikasi' => $alasan === null,
                'alasan_tidak_bisa_diverifikasi' => $alasan,
            ],
        ]);
    }

    /**
     * POST /admin/pembatalan-turnamen/{id}/setujui
     */
    public function setujui(Request $request, $id)
    {
        $admin = $request->user()->admin;
        if (!$admin) {
            return response()->json(['success' => false, 'message' => 'Profil admin tidak ditemukan.'], 404);
        }

        $hasil = DB::transaction(function () use ($id, $admin) {
            $pengajuan = PengajuanPembatalanTurnamen::lockForUpdate()->find($id);
            if (!$pengajuan) {
                return null;
            }
            Turnamen::whereKey($pengajuan->id_turnamen)->lockForUpdate()->first();

            if ($alasan = $this->pembatalan->alasanTidakBisaDiverifikasi($pengajuan)) {
                return $alasan;
            }

            $this->pembatalan->setujui($pengajuan, $admin);

            return $pengajuan;
        });

        if ($hasil === null) {
            return $this->tidakDitemukan();
        }
        if (is_string($hasil)) {
            return $this->gagal($hasil);
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan pembatalan disetujui. Turnamen dibatalkan.',
            'data' => $this->pembatalan->format($hasil->fresh(), self::PREFIX_BUKTI, true),
        ]);
    }

    /**
     * POST /admin/pembatalan-turnamen/{id}/tolak
     * Body: alasan (kode), alasan_lainnya (wajib jika "lainnya")
     */
    public function tolak(Request $request, $id)
    {
        $admin = $request->user()->admin;
        if (!$admin) {
            return response()->json(['success' => false, 'message' => 'Profil admin tidak ditemukan.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'alasan' => ['required', Rule::in(array_keys(PembatalanTurnamenService::ALASAN_PENOLAKAN))],
            'alasan_lainnya' => ['required_if:alasan,lainnya', 'nullable', 'string', 'max:1000'],
        ], [
            'alasan.required' => 'Pilih alasan penolakan.',
            'alasan.in' => 'Alasan penolakan tidak valid.',
            'alasan_lainnya.required_if' => 'Tuliskan alasan penolakan.',
            'alasan_lainnya.max' => 'Alasan penolakan maksimal 1000 karakter.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $catatan = $request->input('alasan') === 'lainnya'
            ? trim((string) $request->input('alasan_lainnya'))
            : PembatalanTurnamenService::ALASAN_PENOLAKAN[$request->input('alasan')];

        $hasil = DB::transaction(function () use ($id, $admin, $catatan) {
            $pengajuan = PengajuanPembatalanTurnamen::lockForUpdate()->find($id);
            if (!$pengajuan) {
                return null;
            }

            if ($alasan = $this->pembatalan->alasanTidakBisaDiverifikasi($pengajuan)) {
                return $alasan;
            }

            $this->pembatalan->tolak($pengajuan, $admin, $catatan);

            return $pengajuan;
        });

        if ($hasil === null) {
            return $this->tidakDitemukan();
        }
        if (is_string($hasil)) {
            return $this->gagal($hasil);
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan pembatalan ditolak.',
            'data' => $this->pembatalan->format($hasil->fresh(), self::PREFIX_BUKTI, true),
        ]);
    }

    /**
     * GET /admin/pembatalan-turnamen/{id}/bukti/{idBukti}
     */
    public function lihatBukti($id, $idBukti)
    {
        $bukti = BuktiPembatalanTurnamen::where('id_bukti_pembatalan', $idBukti)
            ->where('id_pengajuan_pembatalan', $id)
            ->first();

        if (!$bukti || !Storage::disk('local')->exists($bukti->file_bukti_pendukung)) {
            return response()->json(['success' => false, 'message' => 'Bukti tidak ditemukan.'], 404);
        }

        return Storage::disk('local')->response($bukti->file_bukti_pendukung, null, [
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function tidakDitemukan()
    {
        return response()->json(['success' => false, 'message' => 'Pengajuan pembatalan tidak ditemukan.'], 404);
    }

    private function gagal(string $pesan)
    {
        return response()->json(['success' => false, 'message' => $pesan], 422);
    }
}
