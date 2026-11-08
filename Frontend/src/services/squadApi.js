import { apiRequest, ApiError } from "./httpClient";

export const SQUAD_CAPACITY = 7; // R1.04
export const SEARCH_PAGE_SIZE = 8;
export const MY_PAGE_SIZE = 5;

// Nama field BE -> nama field yang dipakai form/komponen
const FIELD_MAP = {
  nama_squad: "name",
  deskripsi: "description",
  logo_squad: "logo",
};

// Objek Squad dari BE (ringkas atau detail) -> bentuk yang dipakai komponen
export function mapSquad(s) {
  return {
    id: s.kode_squad, // tampil sebagai #ID dan dipakai di link /squad/:id
    squadId: s.id_squad,
    name: s.nama_squad,
    description: s.deskripsi ?? "",
    logo: s.logo_url || null,
    icon: "shield", // fallback kalau logo kosong / gagal dimuat
    tone: "blue",
    members: s.jumlah_anggota,
    capacity: s.maks_anggota,
    full: s.is_full,
    role: s.peran === "anggota" ? "member" : (s.peran ?? null), // "leader" | "member" | null
    status: s.status_squad,
    createdAt: s.created_at,
  };
}

// 422 Laravel -> Error dengan .errors = { name, description, logo } (pesan pertama tiap field)
function toFormError(err) {
  if (err instanceof ApiError && err.status === 422) {
    const errors = {};
    Object.entries(err.fields ?? {}).forEach(([beField, msgs]) => {
      errors[FIELD_MAP[beField] ?? "form"] = Array.isArray(msgs)
        ? msgs[0]
        : String(msgs);
    });
    const e = new Error(Object.values(errors)[0] || err.message);
    e.errors = Object.keys(errors).length ? errors : { form: err.message };
    return e;
  }
  return err;
}

// GET /api/squad-saya (squad aktif milik player, terbaru di atas)
export async function getMySquads() {
  const res = await apiRequest("/squad-saya");
  return (res?.data ?? []).map(mapSquad);
}

// POST /api/squad (multipart). Nama, deskripsi, dan logo wajib.
export async function createSquad({ name, description, logoFile }) {
  const form = new FormData();
  form.append("nama_squad", name.trim());
  form.append("deskripsi", description.trim());
  if (logoFile) form.append("logo_squad", logoFile);
  try {
    const res = await apiRequest("/squad", { method: "POST", body: form });
    return mapSquad(res.data);
  } catch (err) {
    throw toFormError(err);
  }
}

// ===== Pencarian (PB-03) =====
// GET /api/squad?q= (q kosong = semua squad aktif, urut nama A-Z; squad arsip tidak tampil).
// q boleh nama squad atau kode squad, boleh diawali "#". Pagination diatur FE.
export async function searchSquads(query = "") {
  const q = String(query).trim();
  const path = q ? `/squad?q=${encodeURIComponent(q)}` : "/squad";
  const res = await apiRequest(path);
  return {
    items: (res?.data ?? []).map(mapSquad),
    message: res?.message || "", // "Hasil tidak ditemukan." saat kosong
  };
}

// GET /api/players?q=<username> (q wajib; maks. 20 hasil, urut A-Z; pemain yang login tidak ikut).
// message: "Hasil tidak ditemukan." / "Masukkan username untuk mencari Player."
export async function searchPlayers(query = "") {
  const q = String(query).trim();
  if (!q) return { items: [], message: "" };
  const res = await apiRequest(`/players?q=${encodeURIComponent(q)}`);
  return {
    items: (res?.data ?? []).map((p) => ({
      id: p.id_player,
      username: p.username,
      avatar: p.avatar_url,
    })),
    message: res?.message || "",
  };
}

// ===== Detail squad =====
const roleOf = (peran) => (peran === "leader" ? "leader" : "member");

// Objek detail BE -> bentuk yang dipakai halaman detail.
// viewerRole: "leader" | "member" | "guest" (bukan anggota).
function mapDetail(d) {
  return {
    ...mapSquad(d),
    viewerRole: d.is_leader ? "leader" : d.is_anggota ? "member" : "guest",
    locked: false, // flag roster terkunci belum ada di data; diisi dari error 422 (PB-06)
    pendingRequests: d.jumlah_permintaan_menunggu ?? 0, // angka untuk Leader (null bila bukan Leader)
    myRequest: d.permintaan_saya
      ? {
          id: d.permintaan_saya.id_permintaan,
          status: d.permintaan_saya.status_permintaan,
        }
      : null,
    myInvite: d.undangan_saya
      ? {
          id: d.undangan_saya.id_undangan,
          status: d.undangan_saya.status_undangan,
        }
      : null,
    members: (d.anggota ?? []).map((a) => ({
      id: a.id_anggota_squad,
      playerId: a.id_player,
      username: a.username,
      avatar: a.avatar_url || null,
      joinedAt: a.tanggal_bergabung,
      role: roleOf(a.peran),
      isMe: false, // diisi halaman dari akun yang login
    })),
    // Selalu [] sampai Sprint 3 (PB-18, PB-19, PB-20): tampilan memakai keadaan kosong.
    winrates: [],
    badges: { tier: "", verified: "0/0", items: [] },
  };
}

// GET /api/squad/:id (id = kode_squad atau id_squad). 404 -> null.
export async function getSquadDetail(id) {
  let res;
  try {
    res = await apiRequest(`/squad/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
  return mapDetail(res.data);
}

// POST /api/squad/:id + _method=PUT (hanya Leader). Kirim field yang berubah saja.
export async function updateSquad(id, { name, description, logoFile } = {}) {
  const form = new FormData();
  form.append("_method", "PUT");
  if (name !== undefined) form.append("nama_squad", name.trim());
  if (description !== undefined) form.append("deskripsi", description.trim());
  if (logoFile) form.append("logo_squad", logoFile);
  try {
    const res = await apiRequest(`/squad/${encodeURIComponent(id)}`, {
      method: "POST",
      body: form,
    });
    return mapSquad(res.data);
  } catch (err) {
    throw toFormError(err);
  }
}

// ===== Permintaan bergabung & undangan (PB-04) =====
// Format tanggal BE: "YYYY-MM-DD HH:mm:ss"

// POST /api/squad/:id/permintaan (player bukan anggota). 201.
export async function requestJoin(id) {
  const res = await apiRequest(`/squad/${encodeURIComponent(id)}/permintaan`, {
    method: "POST",
  });
  return { message: res.message, requestId: res.data?.id_permintaan };
}

// GET /api/squad/:id/permintaan (Leader). Urut dari yang paling lama mengajukan.
export async function getJoinRequests(id) {
  const res = await apiRequest(`/squad/${encodeURIComponent(id)}/permintaan`);
  return {
    items: (res?.data ?? []).map((r) => ({
      id: r.id_permintaan,
      playerId: r.id_player,
      username: r.username,
      avatar: r.avatar_url || null,
      createdAt: r.created_at,
    })),
    message: res?.message || "", // "Belum ada permintaan bergabung." saat kosong
  };
}

// POST /api/squad/:id/permintaan/:requestId/terima | /tolak (Leader)
export async function acceptJoinRequest(id, requestId) {
  const res = await apiRequest(
    `/squad/${encodeURIComponent(id)}/permintaan/${encodeURIComponent(requestId)}/terima`,
    { method: "POST" },
  );
  return { message: res.message };
}
export async function rejectJoinRequest(id, requestId) {
  const res = await apiRequest(
    `/squad/${encodeURIComponent(id)}/permintaan/${encodeURIComponent(requestId)}/tolak`,
    { method: "POST" },
  );
  return { message: res.message };
}

// POST /api/squad/:id/undangan (Leader). Body: id_player (diambil dari hasil searchPlayers).
export async function invitePlayer(id, playerId) {
  const form = new FormData();
  form.append("id_player", playerId);
  const res = await apiRequest(`/squad/${encodeURIComponent(id)}/undangan`, {
    method: "POST",
    body: form,
  });
  return { message: res.message };
}

// GET /api/squad/:id/undangan (Leader): id player yang undangannya masih menunggu.
export async function getSentInvitations(id) {
  const res = await apiRequest(`/squad/${encodeURIComponent(id)}/undangan`);
  return (res?.data ?? []).map((i) => i.id_player);
}

// ===== Keanggotaan (PB-02) =====
// 422 "Squad Sedang Mengikuti Turnamen, Roster Terkunci." (aktif setelah PB-06)
export function isRosterLocked(err) {
  return (
    err instanceof ApiError &&
    err.status === 422 &&
    /roster terkunci/i.test(err.message || "")
  );
}

// POST /api/squad/:id/keluar. Leader keluar -> leader baru otomatis; anggota terakhir -> squad arsip.
export async function leaveSquad(id) {
  const res = await apiRequest(`/squad/${encodeURIComponent(id)}/keluar`, {
    method: "POST",
  });
  return {
    message: res.message,
    status: res.data?.status_squad, // "aktif" | "arsip"
    newLeader: res.data?.leader_baru ?? null, // null | { id_player, username }
  };
}

// DELETE /api/squad/:id/anggota/:playerId (hanya Leader). Mengembalikan detail squad terbaru.
export async function kickMember(id, playerId) {
  const res = await apiRequest(
    `/squad/${encodeURIComponent(id)}/anggota/${encodeURIComponent(playerId)}`,
    { method: "DELETE" },
  );
  return { message: res.message, squad: mapDetail(res.data) };
}

// POST /api/squad/:id/leader (hanya Leader). Leader lama tetap menjadi anggota biasa.
// Boleh walau roster terkunci. Mengembalikan detail squad terbaru (is_leader pemanggil sudah false).
export async function transferLeader(id, playerId) {
  const form = new FormData();
  form.append("id_player", playerId);
  const res = await apiRequest(`/squad/${encodeURIComponent(id)}/leader`, {
    method: "POST",
    body: form,
  });
  return { message: res.message, squad: mapDetail(res.data) };
}

// ===== Inbox undangan (player) =====
// GET /api/undangan-saya -> bentuk yang dipakai InviteInboxModal.
// Jumlah undangan menunggu = items.length (sama dengan meta.jumlah_menunggu).
export async function getInvitations() {
  const res = await apiRequest("/undangan-saya");
  return (res?.data ?? []).map((i) => ({
    id: i.id_undangan,
    invitedBy: i.diundang_oleh,
    createdAt: i.created_at,
    squad: mapSquad(i.squad),
  }));
}

// POST /api/undangan/:id/terima | /tolak
// Error "Undangan dihapus" (squad penuh / tidak aktif) dan 404 -> err.removed = true (kartu dihapus dari Inbox).
export async function respondInvitation(id, accept) {
  const path = `/undangan/${encodeURIComponent(id)}/${accept ? "terima" : "tolak"}`;
  try {
    const res = await apiRequest(path, { method: "POST" });
    const d = res.data ?? {};
    return {
      message: res.message,
      squad: accept
        ? { id: d.kode_squad, squadId: d.id_squad, name: d.nama_squad }
        : null,
    };
  } catch (err) {
    if (
      err instanceof ApiError &&
      (err.status === 404 || /undangan dihapus/i.test(err.message || ""))
    ) {
      err.removed = true;
    }
    throw err;
  }
}
