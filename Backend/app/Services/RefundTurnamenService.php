<?php

namespace App\Services;

use App\Models\PendaftaranTurnamen;
use App\Models\PengajuanPembatalanTurnamen;
use App\Models\RefundTurnamen;
use App\Models\Turnamen;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Aturan pengembalian dana / refund (PB-26, keputusan SA):
 *
 * - Data refund dibuat otomatis saat Admin menyetujui pembatalan turnamen
 *   BERBAYAR, satu per pendaftaran yang DITERIMA (status awal menunggu_data).
 * - Hanya pendaftar (player yang mendaftarkan squad) yang mengisi data refund;
 *   anggota squad lain hanya melihat status.
 * - Data yang sudah dikirim tidak bisa diubah/dikirim ulang -> menunggu_transfer.
 * - Penyelenggara mengunggah bukti transfer (tidak bisa diubah) -> selesai.
 * - Nominal = biaya pendaftaran penuh. Tidak ada batas waktu & tidak ada
 *   konfirmasi penerimaan dari peserta.
 */
class RefundTurnamenService
{
    public const METODE = [
        'transfer_bank' => 'Transfer Bank',
        'qris' => 'QRIS',
    ];

    public const LABEL_STATUS = [
        RefundTurnamen::STATUS_MENUNGGU_DATA => 'Menunggu data refund dari peserta',
        RefundTurnamen::STATUS_MENUNGGU_TRANSFER => 'Menunggu transfer dari penyelenggara',
        RefundTurnamen::STATUS_SELESAI => 'Refund selesai',
    ];

    /** Urutan tampilan untuk penyelenggara: yang perlu ditransfer di atas. */
    private const URUTAN_STATUS = [
        RefundTurnamen::STATUS_MENUNGGU_TRANSFER => 0,
        RefundTurnamen::STATUS_MENUNGGU_DATA => 1,
        RefundTurnamen::STATUS_SELESAI => 2,
    ];

    public function __construct(private PembatalanTurnamenService $pembatalan)
    {
    }

    /** Fitur refund hanya untuk turnamen berbayar yang sudah dibatalkan. */
    public function alasanTidakTersedia(Turnamen $turnamen): ?string
    {
        if ($turnamen->status !== Turnamen::STATUS_DIBATALKAN) {
            return 'Refund hanya tersedia untuk turnamen yang dibatalkan.';
        }

        if (!$this->pembatalan->berbayar($turnamen)) {
            return 'Turnamen ini gratis sehingga tidak ada pengembalian dana.';
        }

        return null;
    }

    /**
     * Dipanggil saat pembatalan disetujui (di dalam transaksi).
     * Aman dipanggil berulang: pendaftaran yang sudah punya data refund dilewati.
     */
    public function buatUntukTurnamen(Turnamen $turnamen): int
    {
        if (!$this->pembatalan->berbayar($turnamen)) {
            return 0;
        }

        $sudahAda = RefundTurnamen::whereIn(
            'id_pendaftaran',
            PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)->select('id_pendaftaran')
        )->pluck('id_pendaftaran');

        $baru = PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->where('status_pendaftaran', 'diterima')
            ->whereNotIn('id_pendaftaran', $sudahAda)
            ->pluck('id_pendaftaran')
            ->map(fn ($id) => [
                'id_pendaftaran' => $id,
                'status_refund' => RefundTurnamen::STATUS_MENUNGGU_DATA,
            ]);

        if ($baru->isNotEmpty()) {
            RefundTurnamen::insert($baru->all());
        }

        return $baru->count();
    }

    public function nominal(Turnamen $turnamen): ?float
    {
        $biaya = DB::table('pendanaan')->where('id_pengajuan', $turnamen->id_pengajuan)->value('biaya_pendaftaran');

        return $biaya === null ? null : (float) $biaya;
    }

    public function rencanaPengembalianDana(Turnamen $turnamen): ?string
    {
        return PengajuanPembatalanTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->where('status_pengajuan', PengajuanPembatalanTurnamen::STATUS_DISETUJUI)
            ->latest('tanggal_verifikasi')
            ->first()
            ?->rencana_pengembalian_dana
            ?->toDateString();
    }

    /** @return Collection<int, RefundTurnamen> */
    public function daftarUntukPenyelenggara(Turnamen $turnamen): Collection
    {
        return RefundTurnamen::whereHas('pendaftaran', fn ($q) => $q->where('id_turnamen', $turnamen->id_turnamen))
            ->with(['pendaftaran.squad', 'pendaftaran.pendaftar.user'])
            ->get()
            ->sortBy(fn (RefundTurnamen $r) => [self::URUTAN_STATUS[$r->status_refund] ?? 9, $r->tanggal_pengajuan?->timestamp ?? PHP_INT_MAX, $r->id_refund])
            ->values();
    }

    public function ringkasan(Collection $refund, ?float $nominal): array
    {
        $hitung = fn (string $status) => $refund->where('status_refund', $status)->count();

        return [
            'jumlah_peserta' => $refund->count(),
            'menunggu_data' => $hitung(RefundTurnamen::STATUS_MENUNGGU_DATA),
            'menunggu_transfer' => $hitung(RefundTurnamen::STATUS_MENUNGGU_TRANSFER),
            'selesai' => $hitung(RefundTurnamen::STATUS_SELESAI),
            'nominal_per_peserta' => $nominal,
            'total_nominal' => $nominal === null ? null : $nominal * $refund->count(),
        ];
    }

    public function isiData(RefundTurnamen $refund, array $data, ?string $pathQris): void
    {
        $qris = $data['metode_refund'] === 'qris';

        $refund->update([
            'metode_refund' => $data['metode_refund'],
            'nomor_rekening' => $qris ? null : trim($data['nomor_rekening']),
            'file_qris' => $qris ? $pathQris : null,
            'atas_nama' => trim($data['atas_nama']),
            'status_refund' => RefundTurnamen::STATUS_MENUNGGU_TRANSFER,
            'tanggal_pengajuan' => now(),
        ]);
    }

    public function unggahBuktiTransfer(RefundTurnamen $refund, string $path): void
    {
        $refund->update([
            'bukti_transfer' => $path,
            'status_refund' => RefundTurnamen::STATUS_SELESAI,
            'tanggal_refund' => now(),
        ]);
    }

    // ==========================================
    // FORMAT RESPONSE
    // ==========================================

    /**
     * @param  string  $prefixFile  URL dasar file, tanpa "/{jenis}" di akhir.
     * @param  bool  $dataLengkap  true untuk penyelenggara & pendaftar (rekening/QRIS terlihat).
     */
    public function format(RefundTurnamen $r, ?float $nominal, string $prefixFile, bool $dataLengkap): array
    {
        $r->loadMissing(['pendaftaran.squad', 'pendaftaran.pendaftar.user']);
        $pendaftaran = $r->pendaftaran;

        return [
            'id_refund' => $r->id_refund,
            'id_pendaftaran' => $r->id_pendaftaran,
            'squad' => [
                'id_squad' => $pendaftaran?->squad?->id_squad,
                'nama_squad' => $pendaftaran?->squad?->nama_squad,
                'logo_url' => $this->urlPublik($pendaftaran?->squad?->logo_squad),
            ],
            'pendaftar' => [
                'id_player' => $pendaftaran?->id_player,
                'username' => $pendaftaran?->pendaftar?->user?->username,
            ],
            'nominal' => $nominal,
            'status_refund' => $r->status_refund,
            'label_status_refund' => self::LABEL_STATUS[$r->status_refund] ?? $r->status_refund,
            'metode_refund' => $r->metode_refund,
            'label_metode_refund' => $r->metode_refund ? (self::METODE[$r->metode_refund] ?? $r->metode_refund) : null,
            'atas_nama' => $dataLengkap ? $r->atas_nama : null,
            'nomor_rekening' => $dataLengkap ? $r->nomor_rekening : null,
            'file_qris_url' => $dataLengkap && $r->file_qris ? "{$prefixFile}/qris" : null,
            'bukti_transfer_url' => $r->bukti_transfer ? "{$prefixFile}/bukti-transfer" : null,
            'jenis_bukti_transfer' => $r->bukti_transfer
                ? (strtolower(pathinfo($r->bukti_transfer, PATHINFO_EXTENSION)) === 'pdf' ? 'pdf' : 'gambar')
                : null,
            'tanggal_pengajuan' => $r->tanggal_pengajuan?->toIso8601String(),
            'tanggal_refund' => $r->tanggal_refund?->toIso8601String(),
        ];
    }

    /** Sama seperti logo_url / avatar_url di endpoint squad & player. */
    private function urlPublik(?string $path): ?string
    {
        return $path ? asset('storage/' . $path) : null;
    }

    public function infoTurnamen(Turnamen $turnamen): array
    {
        $turnamen->loadMissing(['pengajuan', 'penyelenggara.player']);

        return [
            'id_turnamen' => $turnamen->id_turnamen,
            'nama_turnamen' => $turnamen->pengajuan?->nama_turnamen,
            'nama_penyelenggara' => $turnamen->pengajuan?->nama_penyelenggara,
            'avatar_penyelenggara_url' => $this->urlPublik($turnamen->penyelenggara?->player?->avatar),
            // PB-23: untuk membuka profil penyelenggara (GET /players/{id}/profil)
            'id_player_penyelenggara' => $turnamen->penyelenggara?->id_player,
        ];
    }
}
