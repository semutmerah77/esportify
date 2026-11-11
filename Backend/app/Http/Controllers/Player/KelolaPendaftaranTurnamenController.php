<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\PendaftaranTurnamen;
use App\Models\Turnamen;
use App\Services\PendaftaranTurnamenService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

/**
 * Sisi Penyelenggara: verifikasi pendaftaran (PB-10)
 * dan menyelesaikan turnamen untuk membuka roster (PB-09).
 */
class KelolaPendaftaranTurnamenController extends Controller
{
    public function __construct(
        private PendaftaranTurnamenService $service
    ) {
    }

    /**
     * GET /turnamen-kelolaan/{id}/pendaftaran?status=menunggu&q=garuda
     * Tab "Pendaftaran" (US30).
     */
    public function index(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $status = $request->query('status');
        $cari = trim((string) $request->query('q', ''));

        $query = PendaftaranTurnamen::with(['squad', 'pendaftar.user'])
            ->withCount('anggota')
            ->where('id_turnamen', $turnamen->id_turnamen);

        if (in_array($status, ['menunggu', 'diterima', 'ditolak'], true)) {
            $query->where('status_pendaftaran', $status);
        }

        if ($cari !== '') {
            $query->whereHas('squad', function ($q) use ($cari) {
                $q->where('nama_squad', 'like', "%{$cari}%")
                    ->orWhere('kode_squad', 'like', '%' . strtoupper(ltrim($cari, '#')) . '%');
            });
        }

        // Yang perlu diverifikasi tampil paling atas.
        $data = $query
            ->orderByRaw("CASE WHEN status_pendaftaran = 'menunggu' THEN 0 ELSE 1 END")
            ->orderBy('tanggal_daftar')
            ->get()
            ->map(fn (PendaftaranTurnamen $p) => $this->formatRingkas($p))
            ->values();

        $jumlah = PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->selectRaw('status_pendaftaran, COUNT(*) as total')
            ->groupBy('status_pendaftaran')
            ->pluck('total', 'status_pendaftaran');

        return response()->json([
            'success' => true,
            'message' => $data->isEmpty()
                ? 'Belum ada pendaftaran.'
                : 'Daftar pendaftaran berhasil diambil.',
            'data' => $data,
            'meta' => [
                'jenis_biaya' => $turnamen->pengajuan->pendanaan?->jenis_biaya ?? 'gratis',
                'status_turnamen' => $turnamen->status,
                'slot' => (int) $turnamen->pengajuan->slot,
                'slot_terisi' => $turnamen->slotTerisi(),
                'jumlah' => [
                    'menunggu' => (int) ($jumlah['menunggu'] ?? 0),
                    'diterima' => (int) ($jumlah['diterima'] ?? 0),
                    'ditolak' => (int) ($jumlah['ditolak'] ?? 0),
                ],
            ],
        ]);
    }

    /**
     * GET /turnamen-kelolaan/{id}/pendaftaran/{idPendaftaran}
     * Detail sebelum verifikasi (US31).
     */
    public function show(Request $request, $id, $idPendaftaran)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $pendaftaran = $this->findPendaftaran($turnamen, $idPendaftaran);
        if (!$pendaftaran) {
            return $this->pendaftaranNotFound();
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail pendaftaran berhasil diambil.',
            'data' => $this->formatDetail($turnamen, $pendaftaran),
        ]);
    }

    /**
     * GET /turnamen-kelolaan/{id}/pendaftaran/{idPendaftaran}/bukti-pembayaran
     */
    public function lihatBukti(Request $request, $id, $idPendaftaran)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $pendaftaran = $this->findPendaftaran($turnamen, $idPendaftaran);
        if (!$pendaftaran) {
            return $this->pendaftaranNotFound();
        }

        $path = $pendaftaran->bukti_pembayaran;

        if (!$path || !Storage::disk('local')->exists($path)) {
            return response()->json([
                'success' => false,
                'message' => 'Bukti pembayaran tidak ditemukan.',
            ], 404);
        }

        $response = response()->file(
            Storage::disk('local')->path($path),
            [
                'Content-Type' => Storage::disk('local')->mimeType($path),
                'X-Content-Type-Options' => 'nosniff',
            ]
        );

        $response->headers->set('Cache-Control', 'private, no-store');

        return $response;
    }

    /**
     * POST /turnamen-kelolaan/{id}/pendaftaran/{idPendaftaran}/terima (US32)
     */
    public function terima(Request $request, $id, $idPendaftaran)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $hasil = DB::transaction(function () use ($turnamen, $idPendaftaran) {
            $pendaftaran = $this->findPendaftaran($turnamen, $idPendaftaran, true);
            if (!$pendaftaran) {
                return ['notFound' => true];
            }

            if ($alasan = $this->service->alasanTidakBisaDiverifikasi($turnamen, $pendaftaran)) {
                return ['error' => $alasan];
            }

            return ['pendaftaran' => $this->service->terima($pendaftaran)];
        });

        if (isset($hasil['notFound'])) {
            return $this->pendaftaranNotFound();
        }

        if (isset($hasil['error'])) {
            return $this->gagal($hasil['error']);
        }

        $pendaftaran = $hasil['pendaftaran'];

        return response()->json([
            'success' => true,
            'message' => "Pendaftaran Squad {$pendaftaran->squad?->nama_squad} diterima.",
            'data' => $this->formatDetail($turnamen, $pendaftaran->fresh()),
        ]);
    }

    /**
     * POST /turnamen-kelolaan/{id}/pendaftaran/{idPendaftaran}/tolak (US33)
     * Body: alasan_penolakan (wajib)
     */
    public function tolak(Request $request, $id, $idPendaftaran)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $validator = Validator::make($request->all(), [
            'alasan_penolakan' => ['required', 'string', 'max:255'],
        ], [
            'alasan_penolakan.required' => 'Alasan penolakan wajib diisi.',
            'alasan_penolakan.max' => 'Alasan penolakan maksimal 255 karakter.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $alasan = trim($request->input('alasan_penolakan'));

        $hasil = DB::transaction(function () use ($turnamen, $idPendaftaran, $alasan) {
            $pendaftaran = $this->findPendaftaran($turnamen, $idPendaftaran, true);
            if (!$pendaftaran) {
                return ['notFound' => true];
            }

            if ($pesan = $this->service->alasanTidakBisaDiverifikasi($turnamen, $pendaftaran)) {
                return ['error' => $pesan];
            }

            return ['pendaftaran' => $this->service->tolak($pendaftaran, $alasan)];
        });

        if (isset($hasil['notFound'])) {
            return $this->pendaftaranNotFound();
        }

        if (isset($hasil['error'])) {
            return $this->gagal($hasil['error']);
        }

        $pendaftaran = $hasil['pendaftaran'];

        return response()->json([
            'success' => true,
            'message' => "Pendaftaran Squad {$pendaftaran->squad?->nama_squad} ditolak. Slot dikembalikan dan roster Squad dibuka kembali.",
            'data' => $this->formatDetail($turnamen, $pendaftaran->fresh()),
        ]);
    }

    /**
     * GET /turnamen-kelolaan/{id}/peserta
     * Tab "Peserta": Squad yang diterima (gratis maupun berbayar).
     */
    public function peserta(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $data = PendaftaranTurnamen::with(['squad', 'pendaftar.user'])
            ->withCount('anggota')
            ->where('id_turnamen', $turnamen->id_turnamen)
            ->where('status_pendaftaran', 'diterima')
            ->orderBy('tanggal_verifikasi')
            ->get()
            ->map(fn (PendaftaranTurnamen $p) => $this->formatRingkas($p))
            ->values();

        return response()->json([
            'success' => true,
            'message' => $data->isEmpty()
                ? 'Belum ada peserta.'
                : 'Daftar peserta berhasil diambil.',
            'data' => $data,
            'meta' => [
                'jumlah_peserta' => $data->count(),
                'slot' => (int) $turnamen->pengajuan->slot,
            ],
        ]);
    }

    /**
     * POST /turnamen-kelolaan/{id}/selesaikan (PB-09, US29)
     * Menyelesaikan turnamen dan membuka kembali seluruh roster Squad.
     */
    public function selesaikan(Request $request, $id)
    {
        [$turnamen, $error] = $this->turnamenKelolaan($request, $id);
        if ($error) {
            return $error;
        }

        $hasil = DB::transaction(function () use ($turnamen) {
            $terkunci = Turnamen::whereKey($turnamen->id_turnamen)->lockForUpdate()->first();
            $terkunci->setRelation('pengajuan', $turnamen->pengajuan);

            if ($alasan = $this->service->alasanTidakBisaDiselesaikan($terkunci)) {
                return ['error' => $alasan];
            }

            return ['ringkasan' => $this->service->selesaikanTurnamen($terkunci)];
        });

        if (isset($hasil['error'])) {
            return $this->gagal($hasil['error']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Turnamen berhasil diselesaikan. Roster seluruh Squad peserta dibuka kembali.',
            'data' => [
                'id_turnamen' => $turnamen->id_turnamen,
                'status' => 'selesai',
                'roster_dibuka' => $hasil['ringkasan']['roster_dibuka'],
                'pendaftaran_otomatis_ditolak' => $hasil['ringkasan']['otomatis_ditolak'],
            ],
        ]);
    }

    // ==========================================
    // HELPER
    // ==========================================

    /**
     * Turnamen + cek bahwa Player login adalah penyelenggaranya.
     *
     * @return array{0: ?Turnamen, 1: ?\Illuminate\Http\JsonResponse}
     */
    private function turnamenKelolaan(Request $request, $id): array
    {
        $player = $request->user()->player;
        if (!$player) {
            return [null, response()->json([
                'success' => false,
                'message' => 'Profil Player tidak ditemukan.',
            ], 404)];
        }

        $turnamen = Turnamen::with(['pengajuan.pendanaan', 'penyelenggara'])->find($id);
        if (!$turnamen || !$turnamen->pengajuan) {
            return [null, response()->json([
                'success' => false,
                'message' => 'Turnamen tidak ditemukan.',
            ], 404)];
        }

        if (!$this->service->isPenyelenggara($turnamen, $player)) {
            return [null, response()->json([
                'success' => false,
                'message' => 'Anda bukan penyelenggara turnamen ini.',
            ], 403)];
        }

        return [$turnamen, null];
    }

    private function findPendaftaran(Turnamen $turnamen, $idPendaftaran, bool $lock = false): ?PendaftaranTurnamen
    {
        $query = PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->whereKey($idPendaftaran);

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    private function formatRingkas(PendaftaranTurnamen $p): array
    {
        return [
            'id_pendaftaran' => $p->id_pendaftaran,
            'status_pendaftaran' => $p->status_pendaftaran,
            'tanggal_daftar' => $p->tanggal_daftar,
            'tanggal_verifikasi' => $p->tanggal_verifikasi,
            'alasan_penolakan' => $p->alasan_penolakan,
            'ada_bukti_pembayaran' => (bool) $p->bukti_pembayaran,
            'jumlah_anggota' => (int) ($p->anggota_count ?? $p->anggota()->count()),
            'squad' => [
                'id_squad' => $p->id_squad,
                'kode_squad' => $p->squad?->kode_squad,
                'nama_squad' => $p->squad?->nama_squad,
                'logo_url' => $this->fileUrl($p->squad?->logo_squad),
            ],
            // Perwakilan = Player yang mendaftarkan Squad.
            'perwakilan' => [
                'id_player' => $p->id_player,
                'username' => $p->pendaftar?->user?->username,
                'avatar_url' => $this->fileUrl($p->pendaftar?->avatar),
            ],
        ];
    }

    private function formatDetail(Turnamen $turnamen, PendaftaranTurnamen $p): array
    {
        $p->loadMissing(['squad.leader', 'pendaftar.user', 'anggota.player.user']);

        $leaderId = $p->squad?->leader?->id_player;
        $pengajuan = $turnamen->pengajuan;

        return array_merge($this->formatRingkas($p), [
            'status_roster' => $p->status_roster,
            'bisa_diverifikasi' => $this->service->alasanTidakBisaDiverifikasi($turnamen, $p) === null,

            'turnamen' => [
                'id_turnamen' => $turnamen->id_turnamen,
                'nama_turnamen' => $pengajuan->nama_turnamen,
                'jenis_biaya' => $pengajuan->pendanaan?->jenis_biaya ?? 'gratis',
                'biaya_pendaftaran' => $pengajuan->pendanaan?->biaya_pendaftaran,
            ],

            'anggota' => $p->anggota->map(fn ($a) => [
                'id_player' => $a->id_player,
                'username' => $a->player?->user?->username,
                'avatar_url' => $this->fileUrl($a->player?->avatar),
                'peran' => (int) $a->id_player === (int) $leaderId ? 'leader' : 'anggota',
            ])->values(),

            'bukti_pembayaran_url' => $p->bukti_pembayaran
                ? url("/api/turnamen-kelolaan/{$turnamen->id_turnamen}/pendaftaran/{$p->id_pendaftaran}/bukti-pembayaran")
                : null,
        ]);
    }

    private function gagal(string $pesan)
    {
        return response()->json([
            'success' => false,
            'message' => $pesan,
        ], 422);
    }

    private function fileUrl(?string $path): ?string
    {
        return $path ? asset('storage/' . $path) : null;
    }

    private function pendaftaranNotFound()
    {
        return response()->json([
            'success' => false,
            'message' => 'Pendaftaran tidak ditemukan.',
        ], 404);
    }
}
?>