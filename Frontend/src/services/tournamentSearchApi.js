import { API_BASE_URL } from "../config/env";
import { apiRequest } from "./httpClient";
// CHANGED: filter jadwal dipindah ke utils
import { matchesSchedule, matchesRegistration } from "../utils/searchSchedule";

// Service halaman Cari Turnamen.
// Data sumber: GET /turnamen.
// Search, filter, dan pagination dilakukan di frontend.

let API_ORIGIN = "";

try {
  API_ORIGIN = API_BASE_URL ? new URL(API_BASE_URL).origin : "";
} catch {
  API_ORIGIN = "";
}

export const PER_PAGE = 8;

const TZ = "Asia/Jakarta";
const CACHE_MS = 60_000;

export const SUPPORTED_FILTERS = {
  kategori: true,
  biaya: true,
  lokasi: true,
};

/* ---------------- Opsi filter ---------------- */

export const TYPE_OPTIONS = [
  { value: "", label: "Semua" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
];

export const FEE_OPTIONS = [
  { value: "", label: "Semua biaya" },
  { value: "gratis", label: "Gratis" },
  { value: "berbayar", label: "Berbayar" },
];

// CHANGED: opsi jadwal sekarang dari utils (Hari ini, 7 hari, Pilih tanggal)
export { SCHEDULE_OPTIONS } from "../utils/searchSchedule";

/* ---------------- Tanggal & formatter ---------------- */

const parseDate = (value) => {
  if (!value) return null;

  let text = String(value)
    .trim()
    .replace(/(\.\d{3})\d+/, "$1");

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    text += "T00:00:00+07:00";
  } else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(text)) {
    text = `${text.replace(" ", "T")}+07:00`;
  }

  const date = new Date(text);

  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value) => {
  const date = parseDate(value);

  if (!date) return "Jadwal menyusul";

  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(date);
};

export const formatRupiah = (value) =>
  Number(value) > 0 ? `Rp${Number(value).toLocaleString("id-ID")}` : "Rp0";

export const formatFee = (value) =>
  Number(value) > 0 ? formatRupiah(value) : "Gratis";

/* ---------------- Helper data ---------------- */

const toMediaUrl = (value) => {
  if (!value) return null;

  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  return `${API_ORIGIN}/storage/${String(value).replace(
    /^\/?(storage\/)?/,
    "",
  )}`;
};

const normalizeType = (value) => {
  const type = String(value ?? "").toLowerCase();

  if (type.includes("offline")) return "Offline";
  if (type.includes("online")) return "Online";

  return "";
};

// Mendukung response berbentuk array langsung atau { data: [...] }.
const toList = (response) => {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.data)) {
    return response.data.data;
  }

  return [];
};

/* ---------------- Mapper kategori ---------------- */

// Menyamakan format kategori dari Laravel dengan format frontend.
const mapCategory = (category) => ({
  id: String(category?.id_kategori ?? category?.id ?? ""),
  name: String(category?.nama_kategori ?? category?.name ?? ""),
});

// Mengambil kategori dari relasi game.
// Mendukung key "kategoris", "kategori", atau "categories".
const getGameCategories = (game) => {
  if (!game) return [];

  const categories = game.kategoris ?? game.kategori ?? game.categories ?? [];

  if (!Array.isArray(categories)) return [];

  return categories
    .map(mapCategory)
    .filter((category) => category.id && category.name);
};

/* ---------------- Mapper turnamen ---------------- */

const feeOf = (funding) => {
  if (!funding) return null;

  if (String(funding.jenis_biaya ?? "").toLowerCase() === "gratis") {
    return 0;
  }

  const amount = Number(funding.biaya_pendaftaran);

  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const mapTournament = (data) => {
  const submission = data.pengajuan ?? {};

  const city = submission.kota ?? null;
  const province = city?.provinsi ?? null;

  const cityName = city?.nama_kota ?? "";
  const provinceName = province?.nama_provinsi ?? "";

  const prize =
    submission.total_hadiah != null ? Number(submission.total_hadiah) : null;

  const game = submission.game ?? {};

  return {
    id: data.id_turnamen ?? data.id ?? null,
    status: String(data.status ?? "").toLowerCase(),

    registrationOpen:
      data.pendaftaran_terbuka ?? submission.pendaftaran_terbuka ?? null,

    name: submission.nama_turnamen ?? "",
    organizer: submission.nama_penyelenggara ?? "",
    poster: toMediaUrl(submission.poster),

    game: game.nama_game ?? "",
    gameId: String(game.id_game ?? ""),

    // Data kategori berasal dari relasi games -> kategori_game -> kategori.
    categories: getGameCategories(game),

    type: normalizeType(submission.tipe_turnamen),

    date: submission.jadwal_main ?? null,
    registrationClose: submission.jadwal_pendaftaran_tutup ?? null,
    extended:
      (data.jadwal_diperpanjang ?? submission.jadwal_diperpanjang) === true,

    cityId: city ? String(city.id_kota ?? "") : "",

    cityName,

    provinceId: String(city?.id_provinsi ?? province?.id_provinsi ?? ""),

    provinceName,

    location: [cityName, provinceName].filter(Boolean).join(", "),

    slotTotal: Number(submission.slot ?? 0),
    slotFilled: null,

    prize: Number.isFinite(prize) ? prize : null,
    fee: feeOf(submission.pendanaan),
  };
};

/* ---------------- Ambil data + cache ---------------- */

let cache = null;

function loadAll() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.promise;
  }

  const promise = apiRequest("/turnamen").then((response) =>
    toList(response)
      .map(mapTournament)
      .filter(
        (tournament) =>
          tournament.status !== "selesai" && tournament.id != null,
      ),
  );

  cache = {
    at: Date.now(),
    promise,
  };

  // Jika request gagal, izinkan pemanggilan ulang.
  promise.catch(() => {
    if (cache?.promise === promise) {
      cache = null;
    }
  });

  return promise;
}

// Opsional: panggil setelah data turnamen berubah agar cache diperbarui.
export function clearTournamentCache() {
  cache = null;
}

/* ---------------- Filter frontend ---------------- */

const matches = (tournament, criteria = {}) => {
  const query = String(criteria.q ?? "")
    .trim()
    .toLowerCase();

  if (query) {
    const matchesName = tournament.name.toLowerCase().includes(query);

    const matchesGame = tournament.game.toLowerCase().includes(query);

    if (!matchesName && !matchesGame) {
      return false;
    }
  }

  // Filter berdasarkan ID kategori yang terhubung ke game.
  if (criteria.kategori) {
    const categoryExists = tournament.categories.some(
      (category) => category.id === String(criteria.kategori),
    );

    if (!categoryExists) return false;
  }

  if (
    criteria.tipe &&
    tournament.type.toLowerCase() !== String(criteria.tipe).toLowerCase()
  ) {
    return false;
  }

  if (criteria.biaya === "gratis" && tournament.fee !== 0) {
    return false;
  }

  if (criteria.biaya === "berbayar" && !(tournament.fee > 0)) {
    return false;
  }

  // CHANGED: provinsi dan kota hanya berlaku untuk tipe Offline
  if (String(criteria.tipe ?? "").toLowerCase() === "offline") {
    if (
      criteria.provinsi &&
      tournament.provinceId !== String(criteria.provinsi)
    ) {
      return false;
    }

    if (criteria.kota && tournament.cityId !== String(criteria.kota)) {
      return false;
    }
  }

  if (!matchesSchedule(tournament.date, criteria)) {
    return false;
  }

  // Batas pendaftaran (jadwal_pendaftaran_tutup)
  if (!matchesRegistration(tournament.registrationClose, criteria)) {
    return false;
  }

  return true;
};

// criteria: { q, kategori, tipe, biaya, jadwal, dari, sampai, provinsi, kota, page }
export async function searchTournaments(criteria = {}) {
  const all = (await loadAll()).filter((tournament) =>
    matches(tournament, criteria),
  );

  const requestedPage = Math.max(1, Number(criteria.page) || 1);

  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));

  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * PER_PAGE;

  return {
    items: all.slice(start, start + PER_PAGE),
    total: all.length,
    page,
    perPage: PER_PAGE,
    totalPages,
  };
}

/* ---------------- Opsi kategori game ---------------- */

// Prioritas:
// 1. Ambil semua kategori dari GET /kategori.
// 2. Jika gagal/kosong, gunakan kategori dari game pada GET /turnamen.
export async function getSearchCategories() {
  try {
    const response = await apiRequest("/kategori");

    const categories = toList(response)
      .map(mapCategory)
      .filter((category) => category.id && category.name);

    if (categories.length > 0) {
      return [
        ...new Map(
          categories.map((category) => [category.id, category]),
        ).values(),
      ].sort((a, b) => a.name.localeCompare(b.name, "id"));
    }
  } catch (error) {
    // CHANGED: teks warning disesuaikan dengan endpoint yang dipanggil
    console.warn(
      "Gagal mengambil /kategori; memakai kategori dari turnamen.",
      error,
    );
  }

  const unique = new Map();

  (await loadAll()).forEach((tournament) => {
    tournament.categories.forEach((category) => {
      unique.set(category.id, category);
    });
  });

  return [...unique.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "id"),
  );
}
/* ---------------- Untuk landing page ---------------- */

// Turnamen yang pendaftarannya sedang dibuka, hadiah terbesar di atas.
// Sort stabil: hadiah sama -> urutan dari backend tetap.
export async function getFeaturedTournaments(limit = 3) {
  const open = (await loadAll()).filter(
    (tournament) =>
      tournament.status === "pendaftaran" &&
      tournament.registrationOpen !== false,
  );

  return [...open]
    .sort((a, b) => (b.prize ?? -1) - (a.prize ?? -1))
    .slice(0, limit);
}

/* ---------------- Opsi lokasi ---------------- */

export async function getSearchProvinces() {
  const response = await apiRequest("/provinsi");

  return toList(response)
    .map((province) => ({
      id: String(province.id_provinsi ?? ""),
      name: province.nama_provinsi ?? "",
    }))
    .filter((province) => province.id && province.name);
}

export async function getSearchCities(provinceId) {
  if (!provinceId) return [];

  const response = await apiRequest(
    `/provinsi/${encodeURIComponent(provinceId)}/kota`,
  );

  return toList(response)
    .map((city) => ({
      id: String(city.id_kota ?? ""),
      name: city.nama_kota ?? "",
    }))
    .filter((city) => city.id && city.name);
}

/* ---------------- NEW: detail turnamen (wajib login) ---------------- */

// Belum dipakai halaman mana pun (menunggu desain Detail Turnamen).
// Bentuk response mengikuti kontrak: GET /turnamen/{id} -> data (objek).
// Melempar ApiError; status 401 harus ditangani pemanggil (hapus token, ke /login).
export async function getTournamentDetail(id) {
  const response = await apiRequest(`/turnamen/${encodeURIComponent(id)}`);
  const data = response?.data ?? response;

  const submission = data?.pengajuan ?? {};
  const payment = submission.pembayaran ?? null;
  const method = String(payment?.metode_pembayaran ?? "").toLowerCase();

  return {
    ...mapTournament(data),
    description: submission.deskripsi_turnamen ?? "",
    locationDetail: submission.deskripsi_lokasi ?? "",
    // Array nama sponsor, bisa kosong. Kontak sponsor tidak dikirim backend.
    sponsors: Array.isArray(submission.sponsor)
      ? submission.sponsor.filter(Boolean)
      : [],
    // null untuk turnamen gratis. qris / qris_transfer -> QRIS,
    // transfer / qris_transfer -> Transfer Bank (no_rekening).
    payment: payment
      ? {
          method,
          showQris: method.includes("qris"),
          showTransfer: method.includes("transfer"),
          qris: toMediaUrl(payment.qris),
          accountNumber: payment.no_rekening ?? "",
        }
      : null,
  };
}
