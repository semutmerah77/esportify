import { apiRequest, ApiError } from "./httpClient";
import { mockSquads } from "./mock/squadMock";

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

// ----- Masih data tiruan -----
const squads = mockSquads.map((s) => ({ ...s, capacity: SQUAD_CAPACITY }));
const isFull = (s) => s.members >= s.capacity;
const normalize = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/^#/, "");

// Pencarian: menunggu endpoint PB-03 (usulan GET /squad?q=). Squad arsip tidak tampil (R1.17).
export async function searchSquads(query = "") {
  const q = normalize(query);
  return squads
    .filter(
      (s) =>
        !q ||
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q),
    )
    .map((s) => ({ ...s, full: isFull(s) }));
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
    pendingRequests: 0, // permintaan bergabung: menunggu PB-04
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

// Belum ada endpoint (permintaan bergabung: PB-04).
// Sengaja melempar error supaya tidak terlihat berhasil padahal tidak tersimpan.
export async function requestJoin() {
  throw new Error("Fitur gabung squad belum tersedia di backend.");
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

// ===== Undangan squad (inbox) =====
// Data tiruan, menunggu kontrak PB-04. Undangan tidak punya masa kedaluwarsa (R1.09).
let invitations = [
  {
    id: 1,
    invitedBy: "Captain_Rex",
    squad: {
      id: "SQD-5128AX",
      name: "Apex Predators",
      icon: "crown",
      tone: "amber",
      logo: null,
      members: 4,
      capacity: SQUAD_CAPACITY,
    },
  },
  {
    id: 2,
    invitedBy: "ShadowWalker",
    squad: {
      id: "SQD-3382BX",
      name: "Phantom Legion",
      icon: "paw-print",
      tone: "purple",
      logo: null,
      members: 5,
      capacity: SQUAD_CAPACITY,
    },
  },
  {
    id: 3,
    invitedBy: "ValkyrieLeader",
    squad: {
      id: "SQD-8819CX",
      name: "Valkyrie Esports",
      icon: "shield",
      tone: "blue",
      logo: null,
      members: 6,
      capacity: SQUAD_CAPACITY,
    },
  },
];

// GET undangan yang diterima player
export async function getInvitations() {
  return invitations.map((i) => ({ ...i, squad: { ...i.squad } }));
}

// Terima / tolak undangan. Terima -> mengembalikan squad untuk ditambahkan ke Squad Saya.
// Squad penuh saat diterima: undangan dihapus dan error.removed = true (R1.10).
export async function respondInvitation(id, accept) {
  const invite = invitations.find((i) => i.id === id);
  if (!invite) throw new Error("Undangan tidak ditemukan.");

  invitations = invitations.filter((i) => i.id !== id);
  if (!accept) return null;

  if (invite.squad.members >= invite.squad.capacity) {
    const err = new Error("Squad sudah penuh. Undangan dihapus.");
    err.removed = true;
    throw err;
  }
  const members = invite.squad.members + 1;
  return {
    ...invite.squad,
    members,
    full: members >= invite.squad.capacity,
    role: "member",
  };
}
