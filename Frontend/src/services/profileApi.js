import { API_BASE_URL, SKIP_AUTH } from "../config/env";
import { apiRequest } from "./httpClient";

const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const API_ORIGIN = API_BASE_URL ? new URL(API_BASE_URL).origin : "";

// Data contoh hanya untuk mode development tanpa login (VITE_SKIP_AUTH)
const skipProfile = {
  id: 0,
  username: "James",
  email: "james123@gmail.com",
  avatar: null,
  bio: "Hallo Bruh!!",
  gender: "Laki-laki",
  trophies: { gold: 3, silver: 1, bronze: 0 },
};

// ASSUMPTION: avatar bisa URL lengkap atau path. Path relatif digabung dengan
// alamat server. Kalau backend memakai /storage, ubah di sini saja.
// PERUBAHAN: awalan "public/" dan "storage/" di path dibuang dulu, supaya tidak
// jadi /storage/storage/... atau /storage/public/... (path dari DB kadang
// tersimpan dengan awalan itu).
const toAvatarUrl = (value) => {
  if (!value) return null;

  if (/^(https?:|data:|blob:)/.test(value)) {
    return value;
  }

  const path = String(value)
    .replace(/^\/+/, "")
    .replace(/^(public|storage)\//, "");

  return `${API_ORIGIN}/storage/${path}`;
};

// ASSUMPTION: nama field belum dikonfirmasi. Data player bisa ada di objek "player".
// PERUBAHAN: ikut membaca avatar_url kalau backend memakai nama itu.

// piala individu: { gold, silver, bronze } (PB-23)
const mapTrophies = (p) => ({
  gold: Number(p?.gold ?? 0),
  silver: Number(p?.silver ?? 0),
  bronze: Number(p?.bronze ?? 0),
});
const mapProfile = (d) => {
  const player = d.player ?? {};
  return {
    id: d.id_user ?? d.id,
    username: d.username,
    email: d.email,
    avatar: toAvatarUrl(
      player.avatar_url ?? player.avatar ?? d.avatar_url ?? d.avatar,
    ),
    bio: player.bio ?? d.bio ?? "",
    gender: player.jenis_kelamin ?? d.jenis_kelamin ?? "",
    trophies: mapTrophies(d.piala),
  };
};

// GET /api/profile (profil player)
export async function getProfile() {
  if (SKIP_AUTH) {
    await wait();
    return { ...skipProfile };
  }
  const response = await apiRequest("/profile");
  return mapProfile(response?.data ?? response);
}

// GET /api/players/{id}/profil (PB-23). Hanya 1 request: squad & piala sudah termasuk.
// Cache sederhana per id_player supaya buka ulang profil yang sama tidak request lagi.
// Error 404 dilempar apa adanya (err.status === 404): tampilan "Player tidak ditemukan", tanpa retry.
const playerCache = new Map();

export async function getPlayerProfile(id) {
  const key = String(id);
  if (playerCache.has(key)) return playerCache.get(key);

  if (SKIP_AUTH) {
    await wait();
    return {
      id: Number(id),
      username: "Rizky Pratama",
      avatar: null,
      bio: "Bang, ayo mabar!",
      gender: "laki-laki",
      squads: [],
      trophies: { gold: 3, silver: 1, bronze: 2 },
      isSelf: false,
    };
  }

  const response = await apiRequest(`/players/${key}/profil`);
  const d = response?.data ?? response;
  const data = {
    id: d.id_player,
    username: d.username ?? "-",
    avatar: toAvatarUrl(d.avatar_url),
    bio: d.bio ?? "",
    gender: String(d.jenis_kelamin ?? "").toLowerCase(),
    squads: (d.squad ?? []).map((s) => ({
      id: s.id_squad,
      code: s.kode_squad ?? "",
      name: s.nama_squad ?? "-",
      logo: s.logo_url ?? "",
    })),
    trophies: mapTrophies(d.piala),
    isSelf: d.profil_sendiri === true,
  };
  playerCache.set(key, data);
  return data;
}

// PUT /api/profile
async function putProfile(payload) {
  if (SKIP_AUTH) {
    await wait();
    return null;
  }
  return apiRequest("/profile", { method: "PUT", body: payload });
}

export const updateUsername = (username) => putProfile({ username });

// ASSUMPTION: body dan nilai jenis kelamin belum dikonfirmasi backend
export const updateBio = (bio) => putProfile({ bio });
export const updateGender = (gender) => putProfile({ jenis_kelamin: gender });

export const changePassword = ({
  currentPassword,
  password,
  confirmPassword,
}) =>
  putProfile({
    current_password: currentPassword,
    password,
    password_confirmation: confirmPassword,
  });

// Upload foto: POST multipart + _method=PUT (Laravel tidak membaca file dari PUT asli).
// Mengembalikan URL sementara di mode skip, selain itu null (ambil ulang lewat getProfile).
export async function uploadAvatar(file) {
  if (SKIP_AUTH) {
    await wait();
    return URL.createObjectURL(file);
  }
  const form = new FormData();
  form.append("_method", "PUT");
  form.append("avatar", file);
  await apiRequest("/profile", { method: "POST", body: form });
  return null;
}

// GET /api/admin/profile
// Respons: { data: { id_admin, id_user, username, email } }
export async function getAdminProfile() {
  if (SKIP_AUTH) {
    await wait();
    return {
      id: 1,
      username: "admin_esportify",
      email: "admin@esportify.com",
      avatar: null,
    };
  }
  const response = await apiRequest("/admin/profile");
  const d = response?.data ?? response;
  return {
    id: d.id_admin,
    userId: d.id_user,
    username: d.username,
    email: d.email,
    // ASSUMPTION: avatar_url belum ada di kontrak admin
    avatar: d.avatar_url ?? toAvatarUrl(d.avatar),
  };
}

// ASSUMPTION: sama seperti player (POST multipart + _method=PUT)
export async function uploadAdminAvatar(file) {
  if (SKIP_AUTH) {
    await wait();
    return URL.createObjectURL(file);
  }
  const form = new FormData();
  form.append("_method", "PUT");
  form.append("avatar", file);
  await apiRequest("/admin/profile", { method: "POST", body: form });
  return null; // ambil ulang lewat getAdminProfile
}

// PUT /api/admin/profile
// ASSUMPTION: body belum dikonfirmasi (kontrak terpotong). Ubah di sini saja.
async function putAdminProfile(payload) {
  if (SKIP_AUTH) {
    await wait();
    return null;
  }
  return apiRequest("/admin/profile", { method: "PUT", body: payload });
}

export const updateAdminUsername = (username) => putAdminProfile({ username });

export const changeAdminPassword = ({
  currentPassword,
  password,
  confirmPassword,
}) =>
  putAdminProfile({
    current_password: currentPassword,
    password,
    password_confirmation: confirmPassword,
  });
