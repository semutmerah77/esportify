import { apiRequest } from "./httpClient";

export const isAbort = (e) => e?.name === "AbortError";

export function mapNotification(n) {
  return {
    id: n.id, // UUID (string)
    kind: n.jenis,
    title: n.judul,
    message: n.pesan,
    sender: n.pengirim
      ? { role: n.pengirim.peran, name: n.pengirim.nama }
      : null,
    related: n.terkait
      ? { type: n.terkait.tipe, id: n.terkait.id, name: n.terkait.nama }
      : null,
    link: n.tautan || "",
    read: n.sudah_dibaca === true,
    readAt: n.dibaca_pada ?? null,
    createdAt: n.dibuat_pada,
    group: n.kelompok, // hari_ini | 7_hari_terakhir | 30_hari_terakhir
    // Label "Diterima"/"Ditolak" (permintaan bergabung & undangan). Belum ada di kontrak PB-30:
    // dipakai bila BE mengirim status_tanggapan ("diterima" | "ditolak").
    response: n.status_tanggapan ?? null,
  };
}

// GET /notifikasi/penanda -> true bila ada notifikasi belum dibaca (30 hari terakhir)
export async function getNotificationMarker({ signal } = {}) {
  const res = await apiRequest("/notifikasi/penanda", { signal });
  return res?.data?.ada_belum_dibaca === true;
}

// GET /notifikasi?page= (maks. 20 per halaman, terbaru dulu). Tidak menandai dibaca.
export async function getNotifications(page = 1, { signal } = {}) {
  const res = await apiRequest(`/notifikasi?page=${page}`, { signal });
  const d = res?.data ?? {};
  return {
    items: (d.notifikasi ?? []).map(mapNotification),
    page: d.halaman ?? page,
    hasMore: d.ada_halaman_berikutnya === true,
  };
}

// POST /notifikasi/{id}/buka -> tandai dibaca, kembalikan tautan tujuan
export async function openNotification(id) {
  const res = await apiRequest(`/notifikasi/${encodeURIComponent(id)}/buka`, {
    method: "POST",
  });
  const d = res?.data ?? {};
  return {
    link: d.tautan || "",
    item: d.notifikasi ? mapNotification(d.notifikasi) : null,
  };
}

// POST /notifikasi/tandai-semua-dibaca
export async function markAllNotificationsRead() {
  const res = await apiRequest("/notifikasi/tandai-semua-dibaca", {
    method: "POST",
  });
  const d = res?.data ?? {};
  return {
    count: d.jumlah_ditandai ?? 0,
    hasUnread: d.ada_belum_dibaca === true,
  };
}
