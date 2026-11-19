<?php

namespace App\Services;

use App\Models\PendaftaranTurnamen;
use App\Models\Pengumuman;
use App\Models\Player;
use App\Models\Turnamen;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Aturan pengumuman turnamen (PB-20).
 *
 * - Dibuat Penyelenggara saat turnamen berstatus pendaftaran atau berlangsung.
 * - Dilihat anggota aktif Squad yang pendaftarannya diterima
 *   (termasuk pengumuman yang dibuat sebelum Squad itu mendaftar).
 * - Edit hanya bisa dimulai sampai 30 menit setelah pengumuman dibuat.
 *   Timer dihitung dari created_at dan tidak pernah dimulai ulang.
 *   Edit yang sudah dimulai sebelum batas tetap boleh disimpan setelah batas,
 *   selama sesi edit masih ada (sesi berlaku 30 menit sejak tombol Edit diklik).
 * - Hapus boleh kapan saja.
 *
 * Sesi edit disimpan di cache (bukan tabel), jadi tidak mengubah PDM.
 */
class PengumumanService
{
    public const DURASI_EDIT_MENIT = 30;
    public const DURASI_SESI_EDIT_MENIT = 30;
    public const STATUS_BOLEH_BUAT = ['pendaftaran', 'berlangsung'];

    public function __construct(private PendaftaranTurnamenService $pendaftaran)
    {
    }

    // ==========================================
    // MEMBUAT
    // ==========================================

    public function alasanTidakBisaBuat(Turnamen $turnamen): ?string
    {
        if ($turnamen->status === 'selesai') {
            return 'Pengumuman tidak dapat dibuat karena turnamen sudah selesai.';
        }

        if ($turnamen->status === Turnamen::STATUS_DIBATALKAN) {
            return 'Pengumuman tidak dapat dibuat karena turnamen sudah dibatalkan.';
        }

        if (!in_array($turnamen->status, self::STATUS_BOLEH_BUAT, true)) {
            return 'Pengumuman hanya dapat dibuat saat turnamen berstatus Pendaftaran atau Berlangsung.';
        }

        return null;
    }

    public function buat(Turnamen $turnamen, string $judul, string $isi): Pengumuman
    {
        return Pengumuman::create([
            'id_turnamen' => $turnamen->id_turnamen,
            'id_penyelenggara' => $turnamen->id_penyelenggara,
            'judul' => $judul,
            'isi_pengumuman' => $isi,
        ]);
    }

    // ==========================================
    // MELIHAT
    // ==========================================

    /**
     * Penyelenggara, atau anggota aktif Squad yang pendaftarannya diterima.
     */
    public function bolehMelihat(Turnamen $turnamen, ?Player $player): bool
    {
        if (!$player) {
            return false;
        }

        if ($this->pendaftaran->isPenyelenggara($turnamen, $player)) {
            return true;
        }

        return PendaftaranTurnamen::where('id_turnamen', $turnamen->id_turnamen)
            ->where('status_pendaftaran', 'diterima')
            ->whereHas('squad.anggotaAktif', fn ($q) => $q->where('id_player', $player->id_player))
            ->exists();
    }

    public function daftar(Turnamen $turnamen)
    {
        return Pengumuman::where('id_turnamen', $turnamen->id_turnamen)
            ->orderByDesc('created_at')
            ->orderByDesc('id_pengumuman')
            ->get();
    }

    public function cari(Turnamen $turnamen, $idPengumuman): ?Pengumuman
    {
        return Pengumuman::where('id_turnamen', $turnamen->id_turnamen)
            ->where('id_pengumuman', $idPengumuman)
            ->first();
    }

    // ==========================================
    // EDIT (batas 30 menit + sesi edit)
    // ==========================================

    public function batasEdit(Pengumuman $pengumuman): Carbon
    {
        return Carbon::parse($pengumuman->created_at)->addMinutes(self::DURASI_EDIT_MENIT);
    }

    public function masihDalamBatasEdit(Pengumuman $pengumuman): bool
    {
        return now()->lt($this->batasEdit($pengumuman));
    }

    public function sisaDetikEdit(Pengumuman $pengumuman): int
    {
        return max(0, (int) now()->diffInSeconds($this->batasEdit($pengumuman), false));
    }

    /**
     * Membuka sesi edit. Sesi lama (misal dari tab lain) otomatis tidak berlaku.
     *
     * @return array{0: string, 1: Carbon} [token, waktu sesi berakhir]
     */
    public function mulaiEdit(Pengumuman $pengumuman): array
    {
        $token = Str::random(40);
        $berakhir = now()->addMinutes(self::DURASI_SESI_EDIT_MENIT);

        Cache::put($this->kunciSesi($pengumuman), [
            'token' => $token,
            'berakhir' => $berakhir->toIso8601String(),
        ], $berakhir);

        return [$token, $berakhir];
    }

    public function sesiEdit(Pengumuman $pengumuman): ?array
    {
        $sesi = Cache::get($this->kunciSesi($pengumuman));

        return is_array($sesi) ? $sesi : null;
    }

    public function sesiValid(Pengumuman $pengumuman, $token): bool
    {
        $sesi = $this->sesiEdit($pengumuman);

        return $sesi !== null
            && is_string($token)
            && $token !== ''
            && hash_equals($sesi['token'], $token);
    }

    public function akhiriSesi(Pengumuman $pengumuman): void
    {
        Cache::forget($this->kunciSesi($pengumuman));
    }

    public function ubah(Pengumuman $pengumuman, string $judul, string $isi): Pengumuman
    {
        $pengumuman->judul = $judul;
        $pengumuman->isi_pengumuman = $isi;

        // Selalu tandai sebagai diedit walaupun isinya sama
        $pengumuman->updated_at = now();
        $pengumuman->save();

        $this->akhiriSesi($pengumuman);

        return $pengumuman;
    }

    public function hapus(Pengumuman $pengumuman): void
    {
        $this->akhiriSesi($pengumuman);
        $pengumuman->delete();
    }

    // ==========================================
    // FORMAT RESPONSE
    // ==========================================

    public function format(Pengumuman $pengumuman, bool $untukPenyelenggara = false): array
    {
        $dibuat = Carbon::parse($pengumuman->created_at);
        $diperbarui = Carbon::parse($pengumuman->updated_at);

        $data = [
            'id_pengumuman' => $pengumuman->id_pengumuman,
            'id_turnamen' => $pengumuman->id_turnamen,
            'judul' => $pengumuman->judul,
            'isi_pengumuman' => $pengumuman->isi_pengumuman,
            'dibuat_pada' => $dibuat->toIso8601String(),
            'diperbarui_pada' => $diperbarui->toIso8601String(),
            'sudah_diedit' => $diperbarui->gt($dibuat),
        ];

        if ($untukPenyelenggara) {
            $sesi = $this->sesiEdit($pengumuman);

            $data['bisa_edit'] = $this->masihDalamBatasEdit($pengumuman);
            $data['batas_edit'] = $this->batasEdit($pengumuman)->toIso8601String();
            $data['sisa_detik_edit'] = $this->sisaDetikEdit($pengumuman);
            $data['sesi_edit_aktif'] = $sesi !== null;
            $data['bisa_hapus'] = true;
        }

        return $data;
    }

    private function kunciSesi(Pengumuman $pengumuman): string
    {
        return 'pengumuman:sesi-edit:' . $pengumuman->id_pengumuman;
    }
}
