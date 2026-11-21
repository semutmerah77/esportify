import { apiRequest } from "./httpClient";
import { mapCancellationRequest } from "./tournamentCancellationApi";

// PB-25 Verifikasi Pembatalan Turnamen (admin).
// Batas verifikasi 3 hari (meta.batas_hari_verifikasi); lewat batas = prioritas + HTTP 423 di endpoint admin lain.

const num = (v) =>
  v === null || v === undefined || v === "" ? null : Number(v);

// Alasan penolakan dari kontrak (daftar tetap).
export const REJECTION_REASONS = [
  {
    code: "penjelasan_tidak_jelas",
    label: "Penjelasan tidak cukup jelas/detail",
  },
  { code: "bukti_tidak_valid", label: "Bukti pendukung tidak valid" },
  {
    code: "alasan_tidak_sesuai",
    label: "Alasan tidak sesuai dengan kondisi sebenarnya",
  },
  {
    code: "estimasi_tidak_realistis",
    label: "Estimasi pengembalian dana tidak realistis",
  },
  { code: "lainnya", label: "Lainnya" },
];
export const REJECTION_OTHER_MAX = 500;

// <PengajuanAdmin> = <Pengajuan> + turnamen, diajukan_oleh, dst.
export function mapAdminCancellation(p) {
  const t = p.turnamen ?? {};
  const submission = p.pengajuan_turnamen ?? {};
  return {
    ...mapCancellationRequest(p),
    tournament: {
      id: num(t.id_turnamen),
      name: t.nama_turnamen ?? "-",
      organizer: t.nama_penyelenggara ?? p.diajukan_oleh?.username ?? "-",
      status: String(t.status ?? "").toLowerCase(),
      feeType: String(t.jenis_biaya ?? "").toLowerCase(),
      type: String(
        t.tipe_turnamen ?? submission.tipe_turnamen ?? "",
      ).toLowerCase(), // online | offline
      acceptedCount: num(t.jumlah_peserta_diterima),
    },
    // id pengajuan pembuatan turnamen (untuk tombol "Lihat Detail Pengajuan")
    submissionId: num(submission.id_pengajuan),
    // KTP penyelenggara: privat, dibuka dengan token hanya saat tombol "Lihat KTP" ditekan
    ktpUrl: p.ktp_url ?? null,
    submittedBy: p.diajukan_oleh?.username ?? "",
    verifiedBy: p.diverifikasi_oleh ?? "",
    deadline: p.batas_verifikasi ?? null,
    overdue: p.melewati_batas === true, // tandai merah/oranye di tabel
    canVerify: p.bisa_diverifikasi === true, // hanya ada di detail
    cannotVerifyReason: p.alasan_tidak_bisa_diverifikasi ?? "",
  };
}

// GET /admin/pembatalan-turnamen?status=menunggu|riwayat
export async function getAdminCancellations(status) {
  const res = await apiRequest(`/admin/pembatalan-turnamen?status=${status}`);
  const meta = res?.meta ?? {};
  return {
    items: (res?.data ?? []).map(mapAdminCancellation),
    waiting: Number(meta.jumlah_menunggu ?? 0), // badge sidebar / banner
    overdue: Number(meta.jumlah_melewati_batas ?? 0),
    deadlineDays: Number(meta.batas_hari_verifikasi ?? 3),
  };
}

// GET /admin/pembatalan-turnamen/{id}
export async function getAdminCancellationDetail(id) {
  const res = await apiRequest(`/admin/pembatalan-turnamen/${id}`);
  return mapAdminCancellation(res?.data ?? res);
}

// POST /admin/pembatalan-turnamen/{id}/setujui (tanpa body)
export async function approveCancellation(id) {
  const res = await apiRequest(`/admin/pembatalan-turnamen/${id}/setujui`, {
    method: "POST",
  });
  return {
    message: res?.message ?? "",
    request: mapAdminCancellation(res?.data ?? {}),
  };
}

// POST /admin/pembatalan-turnamen/{id}/tolak  body JSON { alasan, alasan_lainnya }
export async function rejectCancellation(id, { reason, otherText }) {
  const body = { alasan: reason };
  if (reason === "lainnya") body.alasan_lainnya = otherText.trim();
  const res = await apiRequest(`/admin/pembatalan-turnamen/${id}/tolak`, {
    method: "POST",
    body,
  });
  return {
    message: res?.message ?? "",
    request: mapAdminCancellation(res?.data ?? {}),
  };
}
