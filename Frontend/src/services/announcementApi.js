import { apiRequest } from "./httpClient";

// PB-20 Pengumuman turnamen.
// Respons: { success, message, data, meta }. Waktu ISO 8601 (+07:00).
// Penyelenggara: /turnamen-kelolaan/{id}/pengumuman... | Peserta: /turnamen/{id}/pengumuman

const WIB = "Asia/Jakarta";
const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v));

// ---------- format tanggal / jam (WIB) ----------

// "19.12"
export function announcementTime(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: WIB,
    })
    .replace(":", ".");
}

// Kunci hari (WIB) untuk mengelompokkan: "2026-11-11"
export function announcementDayKey(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: WIB });
}

// "11 Nov 2026" atau "Hari ini"
export function announcementDayLabel(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  if (announcementDayKey(iso) === announcementDayKey(new Date().toISOString()))
    return "Hari ini";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: WIB,
  });
}

// ---------- mapper ----------
// receivedAt: waktu respons diterima. Batas edit dihitung dari sisa_detik_edit (bukan jam perangkat
// vs batas_edit), sehingga tidak terpengaruh jam perangkat yang meleset.
function mapAnnouncement(a, receivedAt = Date.now()) {
  const secondsLeft = num(a.sisa_detik_edit);
  const canEdit = a.bisa_edit === true && secondsLeft > 0;
  return {
    id: Number(a.id_pengumuman),
    title: a.judul ?? "",
    body: a.isi_pengumuman ?? "",
    createdAt: a.dibuat_pada ?? "",
    updatedAt: a.diperbarui_pada ?? "",
    edited: a.sudah_diedit === true,
    // Nama penulis tidak ada di kontrak; dibaca kalau BE mengirimnya
    authorName:
      a.penulis?.username ??
      a.penulis?.nama ??
      a.dibuat_oleh?.username ??
      a.dibuat_oleh?.nama ??
      a.nama_penyelenggara ??
      "",
    // khusus penyelenggara
    canEdit,
    editDeadline: a.batas_edit ?? "", // ISO, untuk label "Dapat diedit hingga HH.MM"
    editUntil: canEdit ? receivedAt + secondsLeft * 1000 : 0, // epoch ms (jam perangkat)
    canDelete: a.bisa_hapus !== false,
  };
}

const mapList = (data) => {
  const now = Date.now();
  return (Array.isArray(data) ? data : []).map((a) => mapAnnouncement(a, now));
};

// ---------- PENYELENGGARA ----------

// GET /turnamen-kelolaan/{id}/pengumuman
export async function getOrganizerAnnouncements(id) {
  const res = await apiRequest(`/turnamen-kelolaan/${id}/pengumuman`);
  const meta = res?.meta ?? {};
  return {
    items: mapList(res?.data),
    canCreate: meta.bisa_buat === true,
    cannotCreateReason: meta.alasan_tidak_bisa_buat ?? "",
  };
}

// POST /turnamen-kelolaan/{id}/pengumuman  (judul maks 150, isi maks 5000)
export async function createAnnouncement(id, { title, body }) {
  const form = new FormData();
  form.append("judul", title.trim());
  form.append("isi_pengumuman", body.trim());
  const res = await apiRequest(`/turnamen-kelolaan/${id}/pengumuman`, {
    method: "POST",
    body: form,
  });
  return {
    message:
      res?.message ??
      "Pengumuman berhasil dibuat dan dikirim ke peserta turnamen.",
    announcement: mapAnnouncement(res?.data ?? {}),
  };
}

// Edit langkah (a): POST .../{idPengumuman}/mulai-edit -> token_edit (sekali pakai)
// 422 "Batas waktu edit pengumuman sudah habis." -> tombol Edit disembunyikan
export async function startAnnouncementEdit(id, announcementId) {
  const res = await apiRequest(
    `/turnamen-kelolaan/${id}/pengumuman/${announcementId}/mulai-edit`,
    {
      method: "POST",
    },
  );
  const d = res?.data ?? {};
  return {
    token: d.token_edit ?? "",
    expiresAt: d.sesi_edit_berakhir ?? "",
    announcement: mapAnnouncement(d.pengumuman ?? {}),
  };
}

// Edit langkah (b): PUT .../{idPengumuman} (dikirim POST + _method=PUT) dengan token_edit
export async function saveAnnouncement(
  id,
  announcementId,
  { title, body, token },
) {
  const form = new FormData();
  form.append("_method", "PUT");
  form.append("judul", title.trim());
  form.append("isi_pengumuman", body.trim());
  form.append("token_edit", token);
  const res = await apiRequest(
    `/turnamen-kelolaan/${id}/pengumuman/${announcementId}`,
    {
      method: "POST",
      body: form,
    },
  );
  return {
    message: res?.message ?? "Pengumuman berhasil diperbarui.",
    announcement: mapAnnouncement(res?.data ?? {}),
  };
}

// Edit langkah (c): POST .../{idPengumuman}/batal-edit  body { token_edit }
export async function cancelAnnouncementEdit(id, announcementId, token) {
  const form = new FormData();
  form.append("token_edit", token);
  const res = await apiRequest(
    `/turnamen-kelolaan/${id}/pengumuman/${announcementId}/batal-edit`,
    {
      method: "POST",
      body: form,
    },
  );
  return mapAnnouncement(res?.data ?? {});
}

// DELETE /turnamen-kelolaan/{id}/pengumuman/{idPengumuman}  (404 = sudah terhapus)
export async function deleteAnnouncement(id, announcementId) {
  const res = await apiRequest(
    `/turnamen-kelolaan/${id}/pengumuman/${announcementId}`,
    {
      method: "DELETE",
    },
  );
  return { message: res?.message ?? "Pengumuman berhasil dihapus." };
}

// ---------- PESERTA ----------

// GET /turnamen/{id}/pengumuman  (403 kalau bukan anggota squad yang diterima)
export async function getPlayerAnnouncements(id) {
  const res = await apiRequest(`/turnamen/${id}/pengumuman`);
  return mapList(res?.data);
}
