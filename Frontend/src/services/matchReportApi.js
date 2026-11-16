import { apiRequest } from "./httpClient";

// PB-15/17 (pemain: lapor hasil, kirim ulang, sanggahan) dan PB-16 (penyelenggara: inbox verifikasi).
// Respons: { success, message, data, meta }.
// skor_a / skor_b SELALU mengikuti posisi slot di bracket (A = atas, B = bawah).

const WIB = "Asia/Jakarta";
const num = (v) =>
  v === null || v === undefined || v === "" ? null : Number(v);
const str = (v) => (v === null || v === undefined ? "" : String(v));

// ---------- format tanggal / jam (WIB) ----------
export function formatReportTime(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  const t = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: WIB,
  });
  return `${t.replace(":", ".")} WIB`;
}

export function formatReportDateTime(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: WIB,
  });
  return `${day}, ${formatReportTime(iso)}`;
}

// ---------- mapper ----------
function mapSquadRef(s) {
  if (!s) return null;
  return {
    regId: num(s.id_pendaftaran),
    id: num(s.id_squad),
    name: s.nama_squad ?? "-",
    logo: s.logo_url ?? "",
    seed: num(s.nomor_seed),
  };
}

function evidenceType(name, mime) {
  const ext = (str(name).split(".").pop() || "").toLowerCase();
  if (ext === "png" || /png/.test(str(mime))) return "PNG";
  return "JPG";
}

function mapEvidence(b, index) {
  const name = b.nama_file ?? b.nama_asli ?? b.nama ?? b.filename ?? "";
  return {
    id: num(b.id_bukti),
    url: b.url ?? "",
    name: name || `Bukti ${index + 1}`,
    type: evidenceType(name || b.url, b.mime_type ?? b.tipe_file),
  };
}

function mapReport(r) {
  if (!r) return null;
  return {
    id: num(r.id_laporan),
    status: str(r.status_laporan).toLowerCase(), // menunggu | disetujui | ditolak
    scoreA: num(r.skor_a),
    scoreB: num(r.skor_b),
    note: r.catatan ?? "",
    rejectReason: r.alasan_penolakan ?? "",
    sentBy: r.dikirim_oleh?.username ?? r.dikirim_oleh?.nama ?? "",
    sentAt:
      r.tanggal_dikirim ??
      r.dikirim_pada ??
      r.tanggal_laporan ??
      r.created_at ??
      "",
    decidedAt: r.tanggal_keputusan ?? "",
    squad: mapSquadRef(r.squad ?? r.squad_pelapor),
    side: str(r.posisi_squad ?? r.posisi).toUpperCase(), // A | B (kalau BE mengirim)
    evidences: (r.bukti ?? []).map(mapEvidence),
  };
}

function mapInboxMatch(m) {
  return {
    id: num(m?.id_pertandingan),
    number: num(m?.nomor_pertandingan),
    roundName:
      typeof m?.babak === "object"
        ? (m.babak?.nama_babak ?? "")
        : (m?.babak ?? ""),
    a: mapSquadRef(m?.squad_a),
    b: mapSquadRef(m?.squad_b),
    scoreA: num(m?.skor_a),
    scoreB: num(m?.skor_b),
    winnerRegId: num(m?.id_pendaftaran_pemenang),
  };
}

// Sisi (A/B) squad pelapor pada pertandingan; dipakai untuk menampilkan skor dari sudut pandang pelapor
export function reporterSide(report, match) {
  if (report.side === "A" || report.side === "B") return report.side;
  const s = report.squad;
  if (
    s &&
    match?.a &&
    (s.regId === match.a.regId || (s.id && s.id === match.a.id))
  )
    return "A";
  if (
    s &&
    match?.b &&
    (s.regId === match.b.regId || (s.id && s.id === match.b.id))
  )
    return "B";
  return "A";
}

// ---------- PLAYER ----------

// GET /turnamen/{id}/pertandingan/{idPertandingan}/laporan-saya
export async function getMyReportStatus(tournamentId, matchId) {
  const res = await apiRequest(
    `/turnamen/${tournamentId}/pertandingan/${matchId}/laporan-saya`,
  );
  const d = res?.data ?? {};
  return {
    kind: str(d.jenis_pengiriman) || "laporan", // laporan | kirim_ulang | sanggahan
    canSend: d.bisa_kirim === true,
    cannotSendReason: d.alasan_tidak_bisa_kirim ?? "",
    position: str(d.squad_saya?.posisi).toUpperCase(),
    report: mapReport(d.laporan), // hanya status menunggu / ditolak
  };
}

// POST /turnamen/{id}/pertandingan/{idPertandingan}/laporan  (multipart)
// files: File[] bukti baru; keepEvidenceIds: id_bukti lama yang dipertahankan (kirim ulang)
export async function submitReport(
  tournamentId,
  matchId,
  { scoreA, scoreB, note, files = [], keepEvidenceIds = [] },
) {
  const form = new FormData();
  form.append("skor_a", String(scoreA));
  form.append("skor_b", String(scoreB));
  if (note && note.trim()) form.append("catatan", note.trim());
  files.forEach((f) => form.append("bukti[]", f));
  keepEvidenceIds.forEach((evidenceId) =>
    form.append("bukti_lama[]", String(evidenceId)),
  );
  const res = await apiRequest(
    `/turnamen/${tournamentId}/pertandingan/${matchId}/laporan`,
    {
      method: "POST",
      body: form,
    },
  );
  return {
    message: res?.message ?? "Laporan berhasil dikirim.",
    kind: str(res?.data?.jenis_pengiriman) || "laporan",
  };
}

// GET /laporan-pertandingan/{idLaporan}/bukti/{idBukti} -> FILE gambar (perlu Bearer token).
// Tidak bisa dipakai langsung di <img src>: ambil sebagai blob lalu buat object URL.
export async function fetchEvidenceObjectUrl(url) {
  let token = "";
  try {
    token = sessionStorage.getItem("esportify_token") || "";
  } catch {
    token = "";
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "image/*" },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404 ? "Bukti tidak ditemukan." : "Bukti gagal dimuat.",
    );
  }
  return URL.createObjectURL(await res.blob());
}

// ---------- PENYELENGGARA ----------

function mapRejectOptions(raw) {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.entries(raw).map(([kode, label]) => ({ kode, label }))
      : [];
  return list.map((o) => ({
    code: str(o.kode ?? o.code ?? o.value),
    label: str(o.label ?? o.nama),
  }));
}

// GET /turnamen-kelolaan/{id}/laporan?tab=menunggu|riwayat
export async function getReportInbox(id, tab = "menunggu") {
  const res = await apiRequest(`/turnamen-kelolaan/${id}/laporan?tab=${tab}`);
  return {
    groups: (Array.isArray(res?.data) ? res.data : []).map((g) => ({
      match: mapInboxMatch(g.pertandingan),
      reports: (g.laporan ?? []).map(mapReport),
    })),
    pendingCount: Number(res?.meta?.jumlah_menunggu ?? 0),
    rejectOptions: mapRejectOptions(res?.meta?.pilihan_alasan_penolakan),
  };
}

// GET /turnamen-kelolaan/{id}/laporan/{idLaporan}
export async function getReportDetail(id, reportId) {
  const res = await apiRequest(`/turnamen-kelolaan/${id}/laporan/${reportId}`);
  const d = res?.data ?? {};
  const report = mapReport(d.laporan ?? d);
  return {
    report,
    canApprove: (d.bisa_disetujui ?? d.laporan?.bisa_disetujui) === true,
    cannotApproveReason:
      d.alasan_tidak_bisa_disetujui ??
      d.alasan_tidak_bisa ??
      d.laporan?.alasan_tidak_bisa_disetujui ??
      "",
  };
}

// POST /turnamen-kelolaan/{id}/laporan/{idLaporan}/setujui
export async function approveReport(id, reportId) {
  const res = await apiRequest(
    `/turnamen-kelolaan/${id}/laporan/${reportId}/setujui`,
    {
      method: "POST",
    },
  );
  return {
    message: res?.message ?? "Laporan disetujui. Skor diterapkan pada bracket.",
  };
}

// POST /turnamen-kelolaan/{id}/laporan/{idLaporan}/tolak
// reason: kode alasan; otherReason wajib kalau reason = "lainnya"
export async function rejectReport(id, reportId, { reason, otherReason }) {
  const form = new FormData();
  form.append("alasan", reason);
  if (reason === "lainnya")
    form.append("alasan_lainnya", (otherReason || "").trim());
  const res = await apiRequest(
    `/turnamen-kelolaan/${id}/laporan/${reportId}/tolak`,
    {
      method: "POST",
      body: form,
    },
  );
  return { message: res?.message ?? "Laporan ditolak. Bracket tidak berubah." };
}
