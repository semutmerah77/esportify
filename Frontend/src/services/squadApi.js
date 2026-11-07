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
// Data tiruan: statistik & badge contoh. Saat backend siap, ganti dengan apiRequest(`/squads/${id}`).
const SAMPLE_NAMES = [
  "AlexShadow",
  "NightFury",
  "RavenX",
  "Kenzoo",
  "ArdanGG",
  "Zephyr",
  "Lynx",
];
const SAMPLE_WINRATES = [
  { game: "Mobile Legends: Bang Bang", wins: 4, total: 5 },
  { game: "PUBG Mobile", wins: 2, total: 3 },
  { game: "Valorant", wins: 8, total: 8 },
];
const SAMPLE_BADGES = {
  tier: "Elite Contender",
  verified: "6/6",
  items: [
    { type: "gold", count: 3, title: "Gold Trophy", label: "Juara 1" },
    { type: "silver", count: 2, title: "Silver Trophy", label: "Runner Up" },
    { type: "bronze", count: 1, title: "Bronze Trophy", label: "Peringkat 3" },
  ],
};

// role pengguna di squad ini: "leader" | "member" | "guest"
export async function getSquadDetail(id) {
  const squad = squads.find((s) => s.id === id);
  if (!squad) return null;

  const role = squad.role || "guest";
  const members = Array.from({ length: squad.members }, (_, i) => ({
    id: `${squad.id}-m${i}`,
    username:
      squad.fresh && i === 0 ? "Kamu" : SAMPLE_NAMES[i % SAMPLE_NAMES.length],
    role: i === 0 ? "leader" : "member",
    isMe:
      role === "leader"
        ? i === 0
        : role === "member" && i === Math.min(1, squad.members - 1),
  }));

  return {
    ...squad,
    full: isFull(squad),
    viewerRole: role,
    createdAt: squad.createdAt || "2024-02-10",
    locked: false, // roster terkunci (R2.01): dari backend
    pendingRequests: role === "leader" ? 2 : 0,
    members,
    winrates: squad.fresh ? [] : SAMPLE_WINRATES,
    badges: squad.fresh
      ? { tier: "", verified: "0/0", items: [] }
      : SAMPLE_BADGES,
  };
}

// POST permintaan bergabung Mock: selalu berhasil.
export async function requestJoin(id) {
  const squad = squads.find((s) => s.id === id);
  if (!squad) throw new Error("Squad tidak ditemukan.");
  if (isFull(squad)) throw new Error("Squad sudah penuh.");
  return true;
}

// POST keluar dari squad. Ditolak saat roster terkunci
export async function leaveSquad(id) {
  const index = squads.findIndex((s) => s.id === id);
  if (index < 0) throw new Error("Squad tidak ditemukan.");
  const squad = squads[index];
  squad.members -= 1;
  squad.role = null;
  if (squad.members <= 0) squads.splice(index, 1); // diarsipkan, tidak tampil
  return true;
}


// ===== Undangan squad (inbox) =====
// Data tiruan, menunggu kontrak PB-04. Undangan tidak punya masa kedaluwarsa (R1.09).
let invitations = [
  { id: 1, invitedBy: "Captain_Rex",
    squad: { id: "SQD-5128AX", name: "Apex Predators", icon: "crown", tone: "amber", logo: null, members: 4, capacity: SQUAD_CAPACITY } },
  { id: 2, invitedBy: "ShadowWalker",
    squad: { id: "SQD-3382BX", name: "Phantom Legion", icon: "paw-print", tone: "purple", logo: null, members: 5, capacity: SQUAD_CAPACITY } },
  { id: 3, invitedBy: "ValkyrieLeader",
    squad: { id: "SQD-8819CX", name: "Valkyrie Esports", icon: "shield", tone: "blue", logo: null, members: 6, capacity: SQUAD_CAPACITY } },
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
  return { ...invite.squad, members, full: members >= invite.squad.capacity, role: "member" };
}
