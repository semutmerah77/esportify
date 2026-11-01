import { apiRequest } from "./httpClient";
import { toMediaUrl } from "../utils/media";
import { newSponsor } from "../utils/sponsor";

// Semua fungsi di file ini SELALU memakai backend (tanpa mock).
// Respons player: { success, message, data }.
const listOf = (response) => {
  const inner = response?.data ?? response;
  return Array.isArray(inner) ? inner : [];
};

// ASSUMPTION: ID sumber pendanaan. Hanya Dana Pribadi = 2 yang terkonfirmasi.
const FUNDING_IDS = { sponsor: 1, dana_pribadi: 2, biaya_peserta: 3 };

// ----- Kelola Turnamen -----
// GET /api/turnamen-kelolaan. Daftar kosong = 200 dengan data: [] (bukan error).
export async function getManagedTournaments() {
  const response = await apiRequest("/turnamen-kelolaan");
  return listOf(response).map((t) => {
    const p = t.pengajuan ?? {};
    return {
      id: Number(t.id_turnamen),
      name: p.nama_turnamen ?? "-",
      game: p.game?.nama_game ?? "-",
      status: String(t.status ?? "")
        .trim()
        .toLowerCase(), // pendaftaran | berlangsung | selesai
      registrationCloses: p.jadwal_pendaftaran_tutup ?? "",
      matchDate: p.jadwal_main ?? "",
      type: String(p.tipe_turnamen ?? "").toLowerCase(),
      capacity: p.slot ?? null,
    };
  });
}

// ----- Status Pengajuan -----
// GET /api/pengajuan-turnamen (terbaru di atas, tanpa pagination)
export async function getSubmissions() {
  const response = await apiRequest("/pengajuan-turnamen");
  return listOf(response).map((s) => ({
    id: Number(s.id_pengajuan),
    name: s.nama_turnamen ?? "-",
    submittedAt: s.created_at ?? "",
    status: s.status ?? "",
  }));
}

// ----- Pilihan form Buat Turnamen -----
// GET /api/public/games (publik)
export async function getGameOptions() {
  const response = await apiRequest("/public/games");
  return listOf(response).map((g) => ({
    id: Number(g.id_game),
    name: g.nama_game,
  }));
}

// GET /api/provinsi dan /api/provinsi/{id}/kota (publik)
export async function getProvinces() {
  const response = await apiRequest("/provinsi");
  return listOf(response).map((p) => ({
    id: Number(p.id_provinsi),
    name: p.nama_provinsi,
  }));
}

export async function getCities(provinceId) {
  const response = await apiRequest(`/provinsi/${provinceId}/kota`);
  return listOf(response).map((c) => ({
    id: Number(c.id_kota),
    name: c.nama_kota,
  }));
}

const appendSponsors = (f, sponsors) =>
  sponsors.forEach((s, i) => {
    f.append(`sponsor[${i}][nama_sponsor]`, s.nama_sponsor.trim());
    f.append(`sponsor[${i}][kontak_sponsor]`, s.kontak_sponsor.trim());
  });

const sponsorSig = (list) =>
  JSON.stringify(
    list.map((s) => [s.nama_sponsor.trim(), s.kontak_sponsor.trim()]),
  );

// ----- Buat Turnamen -----
// POST /api/pengajuan-turnamen (multipart/form-data)
export async function submitTournament(v) {
  const f = new FormData();
  f.append("poster", v.poster);
  f.append("nama_turnamen", v.name.trim());
  f.append("nama_penyelenggara", v.organizer.trim());
  f.append("id_game", String(v.gameId));
  f.append("tipe_turnamen", v.type);

  // Offline: id_kota wajib. Online: tidak dikirim.
  if (v.type === "offline") {
    f.append("id_kota", String(Number(v.city)));
    if (v.address.trim()) f.append("deskripsi_lokasi", v.address.trim());
  }

  f.append("slot", String(Number(v.slot)));
  f.append("jadwal_pendaftaran_tutup", v.closeDate);
  f.append("jadwal_main", v.matchDate);
  f.append("deskripsi_turnamen", v.description.trim());
  f.append("total_hadiah", String(Number(v.prize)));
  f.append("rincian_pendanaan", v.fundingDetail.trim());

  v.funding.forEach((key) =>
    f.append("sumber_pendanaan[]", String(FUNDING_IDS[key])),
  );
  // Data sponsor hanya dikirim kalau Sponsor dipilih
  if (v.funding.includes("sponsor")) appendSponsors(f, v.sponsors);

  f.append("jenis_biaya", v.fee);
  if (v.fee === "berbayar") {
    f.append("biaya_pendaftaran", String(Number(v.feeAmount)));
    f.append("metode_pembayaran", v.paymentMethod);
    if (["qris", "qris_transfer"].includes(v.paymentMethod))
      f.append("qris", v.qris);
    if (["transfer", "qris_transfer"].includes(v.paymentMethod)) {
      f.append("no_rekening", v.account.trim());
    }
  }

  f.append("ktp", v.ktp);
  f.append("setuju_pertanggungjawaban", v.agree ? "1" : "0");

  return apiRequest("/pengajuan-turnamen", { method: "POST", body: f });
}

// ----- Detail dan edit pengajuan (player) -----
const SPLIT = ". Catatan: ";
// alasan_admin satu field: "Pilihan. Catatan: isi" -> dua bagian untuk tampilan
const parseReason = (text) => {
  const t = String(text ?? "");
  const i = t.indexOf(SPLIT);
  return i >= 0
    ? { reason: t.slice(0, i), note: t.slice(i + SPLIT.length) }
    : { reason: t, note: "" };
};

const fundingKey = (name) => {
  const n = String(name ?? "").toLowerCase();
  if (n.includes("sponsor")) return "sponsor";
  if (n.includes("pribadi")) return "dana_pribadi";
  if (n.includes("peserta") || n.includes("pendaftaran"))
    return "biaya_peserta";
  return null;
};
const day = (v) => String(v ?? "").slice(0, 10);
const money = (v) =>
  v === null || v === undefined || v === ""
    ? ""
    : String(Math.round(Number(v)));

// GET /api/pengajuan-turnamen/{id}. ASSUMPTION: nama field pembayaran/sponsor belum ada contohnya.
export async function getSubmissionDetail(id) {
  const response = await apiRequest(`/pengajuan-turnamen/${id}`);
  const d = response?.data ?? response;
  const pay = d.pembayaran ?? {};
  const fee = d.pendanaan ?? {};

  const fundingIds = { ...FUNDING_IDS };
  const funding = [];
  (d.sumber_pendanaan ?? []).forEach((s) => {
    const key = fundingKey(s.nama_sumber);
    if (!key) return;
    funding.push(key);
    if (s.id_sumber != null) fundingIds[key] = Number(s.id_sumber);
  });

  const { reason, note } = parseReason(d.alasan_admin);
  return {
    id: Number(d.id_pengajuan),
    status: d.status ?? "",
    createdAt: d.created_at ?? "",
    reason,
    note,
    posterUrl: d.poster_url ?? toMediaUrl(d.poster),
    name: d.nama_turnamen ?? "",
    organizer: d.nama_penyelenggara ?? "",
    gameId: d.game?.id_game ?? d.id_game ?? null,
    gameName: d.game?.nama_game ?? "-",
    type: String(d.tipe_turnamen ?? "").toLowerCase(),
    provinceId: d.kota?.provinsi?.id_provinsi ?? "",
    provinceName: d.kota?.provinsi?.nama_provinsi ?? "",
    cityId: d.kota?.id_kota ?? d.id_kota ?? "",
    cityName: d.kota?.nama_kota ?? "",
    address: d.deskripsi_lokasi ?? "",
    slot: d.slot ?? "",
    closeDate: day(d.jadwal_pendaftaran_tutup),
    matchDate: day(d.jadwal_main),
    description: d.deskripsi_turnamen ?? "",
    prize: d.total_hadiah ?? "",
    funding,
    fundingIds,
    sponsors: (d.sponsor ?? []).map((s) => ({
      nama_sponsor: s.nama_sponsor ?? "",
      kontak_sponsor: s.kontak_sponsor ?? "",
    })),
    fundingDetail: d.rincian_pendanaan ?? "",
    feeType: String(fee.jenis_biaya ?? "").toLowerCase(),
    fee: fee.biaya_pendaftaran ?? "",
    paymentMethod: String(pay.metode_pembayaran ?? "").toLowerCase(),
    qrisUrl: pay.qris_url ?? toMediaUrl(pay.qris),
    qrisName: pay.qris ? String(pay.qris).split("/").pop() : "",
    account: pay.no_rekening ?? "",
  };
}

// Bentuk detail -> nilai awal form (sama dengan emptyForm di TournamentForm)
export const detailToForm = (d) => ({
  poster: null,
  name: d.name,
  organizer: d.organizer,
  gameId: d.gameId ? Number(d.gameId) : null,
  type: d.type,
  province: d.provinceId ? String(d.provinceId) : "",
  city: d.cityId ? String(d.cityId) : "",
  address: d.address,
  slot: String(d.slot ?? ""),
  closeDate: d.closeDate,
  matchDate: d.matchDate,
  description: d.description,
  prize: money(d.prize),
  funding: d.funding,
  sponsors: d.sponsors.length
    ? d.sponsors.map((s) => newSponsor(s))
    : [newSponsor()],
  fundingDetail: d.fundingDetail,
  fee: d.feeType,
  feeAmount: money(d.fee),
  paymentMethod: d.paymentMethod,
  qris: null,
  account: d.account,
  ktp: null,
  agree: false,
});

// POST /api/pengajuan-turnamen/{id}/start-edit (tanpa body)
export async function startEdit(id) {
  const response = await apiRequest(`/pengajuan-turnamen/${id}/start-edit`, {
    method: "POST",
  });
  const d = response?.data ?? response;
  return {
    status: d.status,
    deadline: d.batas_waktu_edit ?? null,
    isRevision: Boolean(d.is_revisi),
    reason: d.alasan_admin ?? "",
  };
}

// Simpan: POST + _method=PUT (multipart). Hanya field yang berubah yang dikirim.
export async function updateSubmission(
  id,
  v,
  initial,
  fundingIds = FUNDING_IDS,
) {
  const f = new FormData();
  f.append("_method", "PUT");

  const diff = (k) => String(v[k] ?? "") !== String(initial[k] ?? "");
  const put = (field, key, fmt = (x) => x) =>
    diff(key) && f.append(field, fmt(v[key]));

  if (v.poster) f.append("poster", v.poster);
  put("nama_turnamen", "name", (s) => s.trim());
  put("nama_penyelenggara", "organizer", (s) => s.trim());
  put("id_game", "gameId", String);

  if (diff("type") || diff("city") || diff("address")) {
    f.append("tipe_turnamen", v.type);
    if (v.type === "offline") {
      f.append("id_kota", String(Number(v.city)));
      f.append("deskripsi_lokasi", v.address.trim());
    }
  }

  put("slot", "slot", (s) => String(Number(s)));
  put("jadwal_pendaftaran_tutup", "closeDate");
  put("jadwal_main", "matchDate");
  put("deskripsi_turnamen", "description", (s) => s.trim());
  put("total_hadiah", "prize", (s) => String(Number(s)));
  put("rincian_pendanaan", "fundingDetail", (s) => s.trim());

  const fundingChanged =
    [...v.funding].sort().join() !== [...initial.funding].sort().join() ||
    (v.funding.includes("sponsor") &&
      sponsorSig(v.sponsors) !== sponsorSig(initial.sponsors));

  if (fundingChanged) {
    v.funding.forEach((k) =>
      f.append("sumber_pendanaan[]", String(fundingIds[k])),
    );
    if (v.funding.includes("sponsor")) {
      appendSponsors(f, v.sponsors);
    } else {
      // PENTING: kirim kosong supaya backend hapus sponsor lama
      f.append("sponsor", "");
    }
  }

  const payChanged =
    diff("fee") ||
    diff("feeAmount") ||
    diff("paymentMethod") ||
    diff("account") ||
    v.qris;
  if (payChanged) {
    f.append("jenis_biaya", v.fee);
    if (v.fee === "berbayar") {
      f.append("biaya_pendaftaran", String(Number(v.feeAmount)));
      f.append("metode_pembayaran", v.paymentMethod);
      if (v.qris) f.append("qris", v.qris);
      if (["transfer", "qris_transfer"].includes(v.paymentMethod))
        f.append("no_rekening", v.account.trim());
    }
  }

  if (v.ktp) f.append("ktp", v.ktp);
  f.append("setuju_pertanggungjawaban", v.agree ? "1" : "0");

  return apiRequest(`/pengajuan-turnamen/${id}`, { method: "POST", body: f });
}

// GET /api/turnamen/{id} (wajib login). Id = id_turnamen, bukan id_pengajuan.
// ASSUMPTION: relasi pendanaan/pembayaran/sponsor ada di dalam pengajuan.
export async function getTournamentDetail(id) {
  const response = await apiRequest(`/turnamen/${id}`);
  const t = response?.data ?? response;
  const p = t.pengajuan ?? {};
  const fee = p.pendanaan ?? {};
  const pay = p.pembayaran ?? {};

  return {
    id: Number(t.id_turnamen),
    status: String(t.status ?? "")
      .trim()
      .toLowerCase(),
    name: p.nama_turnamen ?? "-",
    game: p.game?.nama_game ?? "-",
    organizer:
      p.nama_penyelenggara ?? t.penyelenggara?.nama_penyelenggara ?? "-",
    posterUrl: p.poster_url ?? toMediaUrl(p.poster),
    type: String(p.tipe_turnamen ?? "").toLowerCase(),
    city: p.kota?.nama_kota ?? "",
    province: p.kota?.provinsi?.nama_provinsi ?? "",
    address: p.deskripsi_lokasi ?? "",
    slot: p.slot ?? null,
    closeDate: p.jadwal_pendaftaran_tutup ?? "",
    matchDate: p.jadwal_main ?? "",
    description: p.deskripsi_turnamen ?? "",
    prize: p.total_hadiah ?? null,
    feeType: String(fee.jenis_biaya ?? "").toLowerCase(),
    fee: fee.biaya_pendaftaran ?? null,
    sponsors: (p.sponsor ?? [])
      .map((s) => (typeof s === "string" ? s : s?.nama_sponsor))
      .filter(Boolean),
    paymentMethod: String(pay.metode_pembayaran ?? "").toLowerCase(),
  };
}
