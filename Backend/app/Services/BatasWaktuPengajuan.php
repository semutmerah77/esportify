<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\PengajuanTurnamen;
use Illuminate\Support\Carbon;

class BatasWaktuPengajuan
{
    public function menitEdit(): int
    {
        return (int) config('pengajuan.batas_edit_menit', 5);
    }

    public function menitRevisi(): int
    {
        return (int) config('pengajuan.batas_revisi_menit', 43200);
    }

    /**
     * Pengajuan sedang dalam masa revisi
     * (menunggu dikerjakan atau sedang dikerjakan Player).
     */
    public function dalamRevisi(PengajuanTurnamen $pengajuan): bool
    {
        return !empty($pengajuan->revisi_diminta_pada)
            && in_array($pengajuan->status, ['Revisi', 'Sedang diedit'], true);
    }

    /**
     * Edit dihitung dari pengajuan terakhir dikirim:
     * diajukan_ulang_pada jika ada, jika belum pakai created_at.
     */
    public function batasEdit(PengajuanTurnamen $pengajuan): Carbon
    {
        $acuan = $pengajuan->diajukan_ulang_pada ?? $pengajuan->created_at;

        return Carbon::parse($acuan)->addMinutes($this->menitEdit());
    }

    public function batasRevisi(PengajuanTurnamen $pengajuan): ?Carbon
    {
        if (empty($pengajuan->revisi_diminta_pada)) {
            return null;
        }

        return Carbon::parse($pengajuan->revisi_diminta_pada)
            ->addMinutes($this->menitRevisi());
    }

    public function alasanTolakOtomatis(): string
    {
        $menit = $this->menitRevisi();

        $durasi = $menit >= 1440
            ? intdiv($menit, 1440) . ' hari'
            : $menit . ' menit';

        return "Pengajuan ditolak otomatis karena revisi tidak dikirim dalam batas waktu {$durasi}.";
    }

    /**
     * Cek satu pengajuan dan betulkan statusnya jika batas waktu sudah lewat.
     * - Revisi lewat batas     -> Ditolak
     * - Edit biasa lewat batas -> Menunggu Verifikasi
     */
    public function perbarui(PengajuanTurnamen $pengajuan): PengajuanTurnamen
    {
        $sekarang = now();

        if (
            $this->dalamRevisi($pengajuan)
            && $sekarang->greaterThan($this->batasRevisi($pengajuan))
        ) {
            $pengajuan->status = 'Ditolak';
            $pengajuan->alasan_admin = $this->alasanTolakOtomatis();
            $pengajuan->save();

            // PB-31 (R10.14): notifikasi penolakan otomatis
            Notification::buatNotifikasiPengajuanDitolak($pengajuan);

            return $pengajuan;
        }

        if (
            $pengajuan->status === 'Sedang diedit'
            && empty($pengajuan->revisi_diminta_pada)
            && $sekarang->greaterThan($this->batasEdit($pengajuan))
        ) {
            $pengajuan->status = 'Menunggu Verifikasi';
            $pengajuan->save();
        }

        return $pengajuan;
    }

    /**
     * Cek semua pengajuan sekaligus.
     * Dipanggil di awal halaman daftar dan detail (Admin dan Player),
     * dan oleh scheduler notifikasi:cek-otomatis setiap menit (PB-31, R10.16).
     *
     * @return int jumlah pengajuan yang ditolak otomatis
     */
    public function perbaruiSemua(): int
    {
        $batasRevisiLewat = now()->subMinutes($this->menitRevisi());
        $batasEditLewat = now()->subMinutes($this->menitEdit());

        // Per pengajuan, supaya setiap Player pengaju mendapat notifikasi (PB-31)
        $lewatBatas = PengajuanTurnamen::whereNotNull('revisi_diminta_pada')
            ->whereIn('status', ['Revisi', 'Sedang diedit'])
            ->where('revisi_diminta_pada', '<=', $batasRevisiLewat)
            ->get();

        foreach ($lewatBatas as $pengajuan) {
            $pengajuan->update([
                'status' => 'Ditolak',
                'alasan_admin' => $this->alasanTolakOtomatis(),
            ]);
            Notification::buatNotifikasiPengajuanDitolak($pengajuan);
        }

        PengajuanTurnamen::where('status', 'Sedang diedit')
            ->whereNull('revisi_diminta_pada')
            ->whereRaw(
                'COALESCE(diajukan_ulang_pada, created_at) <= ?',
                [$batasEditLewat]
            )
            ->update(['status' => 'Menunggu Verifikasi']);

        return $lewatBatas->count();
    }

    /**
     * Info untuk frontend: tombol mana yang muncul dan kapan batasnya.
     * batas_waktu_edit berisi batas yang sedang berlaku (edit atau revisi),
     * sama seperti response startEdit sebelumnya.
     */
    public function info(PengajuanTurnamen $pengajuan): array
    {
        $sekarang = now();
        $isRevisi = $this->dalamRevisi($pengajuan);

        $batas = $isRevisi
            ? $this->batasRevisi($pengajuan)
            : $this->batasEdit($pengajuan);

        $bisaEdit = !$isRevisi
            && in_array($pengajuan->status, ['Menunggu Verifikasi', 'Sedang diedit'], true)
            && $sekarang->lessThanOrEqualTo($batas);

        $bisaRevisi = $isRevisi
            && $sekarang->lessThanOrEqualTo($batas);

        return [
            'bisa_edit' => $bisaEdit,
            'bisa_revisi' => $bisaRevisi,
            'is_revisi' => $isRevisi,
            'batas_waktu_edit' => ($bisaEdit || $bisaRevisi)
                ? $batas->toDateTimeString()
                : null,
        ];
    }
}