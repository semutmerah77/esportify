import { API_BASE_URL } from "../config/env";
import { ApiError, apiRequest } from "./httpClient";

// PB-25 Pembatalan Turnamen (sisi penyelenggara).
// Respons { success, message, data, meta }. 422 validasi: { message, errors }.
// Semua tanggal dari BE: "YYYY-MM-DD" atau ISO 8601; ditampilkan dalam WIB.

export const EXPLANATION_MAX = 2000;
export const EVIDENCE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB per berkas
export const EVIDENCE_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"];
export const CANCELLATION_REASON_OTHER = "lainnya";

const TZ = "Asia/Jakarta";
const num = (v) =>
  v === null || v === undefined || v === "" ? null : Number(v);

// ----- Tanggal -----
const parseDate = (value) => {
  if (!value) return null;
  let text = String(value)
    .trim()
    .replace(/(\.\d{3})\d+/, "$1");
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += "T00:00:00+07:00";
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(text))
    text = `${text.replace(" ", "T")}+07:00`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatWith = (value, month) => {
  const date = parseDate(value);
  if (!date) return "";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month,
    year: "numeric",
    timeZone: TZ,
  });
};

export const formatShortDate = (value) => formatWith(value, "short"); // 18 Nov 2026
export const formatLongDate = (value) => formatWith(value, "long"); // 20 Desember 2026

// ----- Pemetaan objek BE -----
export function mapEvidence(b) {
  return {
    id: Number(b.id_bukti_pembatalan),
    name: b.nama_file ?? "berkas",
    kind: String(b.jenis ?? "").toLowerCase(), // gambar | pdf
    url: b.url ?? "",
  };
}

// <Pengajuan> dari kontrak PB-25
export function mapCancellationRequest(p) {
  if (!p) return null;
  return {
    id: Number(p.id_pengajuan_pembatalan),
    tournamentId: num(p.id_turnamen),
    status: String(p.status_pengajuan ?? "").toLowerCase(), // menunggu | disetujui | ditolak
    reasonCode: p.alasan_pembatalan ?? "",
    reasonLabel: p.label_alasan_pembatalan ?? p.alasan_pembatalan ?? "",
    explanation: p.penjelasan_pembatalan ?? "",
    refundPlanDate: p.rencana_pengembalian_dana ?? null,
    adminNote: p.catatan_admin ?? "",
    submittedAt: p.tanggal_pengajuan ?? null,
    decidedAt: p.tanggal_verifikasi ?? null,
    evidence: (p.bukti ?? []).map(mapEvidence),
  };
}

// ----- Endpoint penyelenggara -----
// GET /turnamen-kelolaan/{id}/pembatalan (dipanggil saat halaman dibuka dan setelah submit)
export async function getTournamentCancellation(id) {
  const res = await apiRequest(`/turnamen-kelolaan/${id}/pembatalan`);
  const d = res?.data ?? {};
  const meta = res?.meta ?? {};
  const t = d.turnamen ?? {};
  return {
    tournament: {
      id: num(t.id_turnamen),
      name: t.nama_turnamen ?? "",
      status: String(t.status ?? "").toLowerCase(),
      feeType: String(t.jenis_biaya ?? "").toLowerCase(), // gratis | berbayar
    },
    canSubmit: d.bisa_ajukan === true,
    cannotSubmitReason: d.alasan_tidak_bisa_ajukan ?? "",
    pending: mapCancellationRequest(d.pengajuan_menunggu),
    history: (d.riwayat ?? []).map(mapCancellationRequest), // terbaru di atas
    reasons: (meta.pilihan_alasan_pembatalan ?? []).map((r) => ({
      code: r.kode,
      label: r.label,
      evidenceRequired: r.wajib_bukti === true,
    })),
    refundRequired: meta.wajib_rencana_pengembalian_dana === true,
    refundEarliest: meta.rencana_pengembalian_dana_paling_cepat ?? "",
  };
}

// POST /turnamen-kelolaan/{id}/pembatalan (multipart). Sukses 201.
export async function submitTournamentCancellation(
  id,
  { reason, explanation, refundDate, files },
) {
  const form = new FormData();
  form.append("alasan_pembatalan", reason);
  form.append("penjelasan_pembatalan", explanation.trim());
  if (refundDate) form.append("rencana_pengembalian_dana", refundDate);
  form.append("konfirmasi", "1");
  files.forEach((file) => form.append("bukti[]", file));
  const res = await apiRequest(`/turnamen-kelolaan/${id}/pembatalan`, {
    method: "POST",
    body: form,
  });
  return {
    message: res?.message ?? "",
    request: mapCancellationRequest(res?.data),
  };
}

// 422 validasi -> { alasan_pembatalan, penjelasan_pembatalan, rencana_pengembalian_dana, konfirmasi, bukti }
// (pesan pertama tiap field). Null kalau bukan 422 validasi (pesan aturan bisnis ada di err.message).
export function cancellationFieldErrors(err) {
  if (!(err instanceof ApiError) || err.status !== 422) return null;
  const out = {};
  Object.entries(err.fields ?? {}).forEach(([key, msgs]) => {
    const name = key.split(".")[0]; // bukti.0 -> bukti
    if (!out[name]) out[name] = Array.isArray(msgs) ? msgs[0] : String(msgs);
  });
  return Object.keys(out).length ? out : null;
}

// ----- Berkas bukti (privat, butuh token) -----
// Jangan pakai url langsung di <img>/<a>. Ambil sebagai blob, lalu buka di tab baru.
// Dipanggil hanya saat user menekan "Lihat" (tidak dimuat otomatis di daftar).
function absoluteUrl(url) {
  if (/^https?:/i.test(url)) return url;
  const base = String(API_BASE_URL || "").replace(/\/+$/, "");
  // url BE diawali "/api/...": hindari "/api/api/..." kalau base sudah berakhiran /api
  const path =
    base.endsWith("/api") && url.startsWith("/api/") ? url.slice(4) : url;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

const readToken = () => {
  try {
    return sessionStorage.getItem("esportify_token") || "";
  } catch {
    return "";
  }
};

// Ambil berkas privat (butuh token) sebagai object URL untuk pratinjau di popup.
// Pemanggil wajib memanggil URL.revokeObjectURL saat popup ditutup.
export async function fetchProtectedFileUrl(url) {
  const res = await fetch(absoluteUrl(url), {
    headers: { Accept: "*/*", Authorization: `Bearer ${readToken()}` },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Berkas tidak ditemukan."
        : "Berkas tidak dapat dibuka.",
    );
  }
  const blob = await res.blob();
  return {
    url: URL.createObjectURL(blob),
    isPdf: blob.type === "application/pdf",
  };
}

export async function openProtectedFile(url) {
  const win = window.open("", "_blank"); // dibuka dulu agar tidak diblokir pop-up blocker
  try {
    const res = await fetch(absoluteUrl(url), {
      headers: { Accept: "*/*", Authorization: `Bearer ${readToken()}` },
    });
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? "Berkas tidak ditemukan."
          : "Berkas tidak dapat dibuka.",
      );
    }
    const objectUrl = URL.createObjectURL(await res.blob());
    if (win) win.location.href = objectUrl;
    else window.open(objectUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
  } catch (err) {
    win?.close();
    throw err;
  }
}
