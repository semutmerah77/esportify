import { apiRequest } from "./httpClient";

// PB-13 Kelola Bracket (penyelenggara).
// Semua endpoint: /turnamen-kelolaan/{id}/bracket... Respons { success, message, data }.
// Bracket dibentuk OTOMATIS oleh backend saat GET pertama (tidak ada tombol "Bentuk Bracket").
const num = (v) =>
  v === null || v === undefined || v === "" ? null : Number(v);

function mapSquad(s) {
  if (!s) return null;
  return {
    regId: num(s.id_pendaftaran),
    seed: num(s.nomor_seed),
    id: num(s.id_squad),
    code: s.kode_squad ?? "",
    name: s.nama_squad ?? "-",
    logo: s.logo_url ?? "",
    hidden: s.tersembunyi === true, // squad lain saat bracket masih draft
  };
}

function mapMatch(m) {
  return {
    id: Number(m.id_pertandingan),
    number: Number(m.nomor_pertandingan),
    status: String(m.status_pertandingan ?? "").toLowerCase(), // menunggu | berlangsung | selesai
    isBye: m.is_bye === true,
    a: mapSquad(m.squad_a),
    b: mapSquad(m.squad_b),
    scoreA: num(m.skor_a),
    scoreB: num(m.skor_b),
    winnerRegId: num(m.id_pendaftaran_pemenang),
    nextId: num(m.id_pertandingan_selanjutnya),
    nextSlot: String(m.posisi_pemenang_selanjutnya ?? "").toUpperCase(), // A | B
    loserNextId: num(m.id_pertandingan_kalah_selanjutnya),
    loserNextSlot: String(m.posisi_kalah_selanjutnya ?? "").toUpperCase(),
    mine: m.melibatkan_squad_saya === true,
    canScore: m.bisa_update_skor === true, // pensil skor aktif (PB-18/19)
  };
}

function mapRound(r) {
  return {
    id: Number(r.id_babak),
    order: Number(r.urutan_babak),
    name: r.nama_babak ?? "",
    startTime: r.waktu_mulai ?? null, // "HH:MM" (WIB) atau null; tanggal ikut jadwal_main turnamen
    isThirdPlace: r.is_perebutan_juara_3 === true,
    matches: (r.pertandingan ?? []).map(mapMatch),
  };
}

function mapBracketData(d) {
  const t = d?.turnamen ?? {};
  const b = d?.bracket ?? null;
  return {
    tournament: {
      id: Number(t.id_turnamen),
      name: t.nama_turnamen ?? "",
      status: String(t.status ?? "").toLowerCase(), // pendaftaran | berlangsung | selesai
      closeDate: t.jadwal_pendaftaran_tutup ?? "",
      matchDate: t.jadwal_main ?? "",
      accepted: Number(t.jumlah_diterima ?? 0),
      // ---- indikator persiapan (dari BE) ----
      registrationClosed: t.pendaftaran_ditutup === true,
      waiting: Number(t.jumlah_menunggu ?? 0),
      delayed: t.persiapan_tertunda === true,
      delayReason: t.alasan_tertunda ?? "",
      autoPublishAt: t.batas_publikasi_otomatis ?? null,
      autoSeconds: num(t.sisa_detik_publikasi_otomatis), // hitung mundur dari waktu server
      canPublish: t.bisa_dipublikasikan === true,
      cannotPublishReason: t.alasan_tidak_bisa_dipublikasikan ?? "",
      pendingReports: Number(t.jumlah_laporan_menunggu ?? 0), // badge Inbox Verifikasi
    },
    reason: d?.alasan_belum_dibentuk ?? "", // alasan bracket belum terbentuk
    canShuffle: d?.bisa_diacak === true,
    bracket: b
      ? {
          id: Number(b.id_bracket),
          status: String(b.status_bracket ?? "").toLowerCase(), // draft | dipublikasikan
          description: b.deskripsi_bracket ?? "",
          publishedAt: b.tanggal_publikasi ?? null,
          playerCount: Number(b.jumlah_peserta ?? 0),
          slotCount: Number(b.jumlah_slot ?? 0),
          rounds: (b.babak ?? []).map(mapRound),
        }
      : null,
  };
}

const wrap = (res) => ({
  message: res?.message ?? "",
  ...mapBracketData(res?.data ?? res),
});

// GET /turnamen-kelolaan/{id}/bracket
export async function getBracket(id) {
  return wrap(await apiRequest(`/turnamen-kelolaan/${id}/bracket`));
}

// POST /turnamen-kelolaan/{id}/bracket/acak
export async function shuffleBracket(id) {
  return wrap(
    await apiRequest(`/turnamen-kelolaan/${id}/bracket/acak`, {
      method: "POST",
    }),
  );
}

// POST /turnamen-kelolaan/{id}/bracket/publikasi
// Respons data TIDAK dijamin berisi bracket -> panggil getBracket lagi setelahnya.
export async function publishBracket(id) {
  const res = await apiRequest(`/turnamen-kelolaan/${id}/bracket/publikasi`, {
    method: "POST",
  });
  return { message: res?.message ?? "Bracket berhasil dipublikasikan." };
}

// PUT /turnamen-kelolaan/{id}/bracket/babak/{id_babak}
// name maks 30 (wajib); time "HH:MM" 24 jam WIB (opsional, kosong = hapus jam).
// Tanggal pertandingan tetap dari jadwal_main turnamen.
export async function updateRound(id, roundId, { name, time }) {
  const form = new FormData();
  form.append("_method", "PUT");
  form.append("nama_babak", name);
  form.append("waktu_mulai", time || ""); // string kosong dibaca Laravel sebagai null
  const res = await apiRequest(
    `/turnamen-kelolaan/${id}/bracket/babak/${roundId}`,
    {
      method: "POST",
      body: form,
    },
  );
  return wrap(res);
}

// PUT /turnamen-kelolaan/{id}/bracket/deskripsi
// deskripsi_bracket opsional, maks 2000; kosong = hapus deskripsi.
export async function updateDescription(id, text) {
  const form = new FormData();
  form.append("_method", "PUT");
  form.append("deskripsi_bracket", text);
  const res = await apiRequest(`/turnamen-kelolaan/${id}/bracket/deskripsi`, {
    method: "POST",
    body: form,
  });
  return wrap(res);
}

// ----- Tab Bracket Player (PB-14) -----
// GET /turnamen/{id}/bracket (semua Player yang login)
// dipublikasikan false -> bracket null, tampilkan "keterangan". bisa_update_skor selalu false untuk Player.
export async function getPlayerBracket(id) {
  const res = await apiRequest(`/turnamen/${id}/bracket`);
  const d = res?.data ?? res;
  const me = d?.squad_saya ?? null;
  return {
    ...mapBracketData(d),
    published: d?.dipublikasikan === true,
    note: d?.keterangan ?? "",
    masked: d?.disamarkan === true, // true = draft dilihat peserta
    mySquad: me
      ? {
          regId: num(me.id_pendaftaran),
          id: num(me.id_squad),
          name: me.nama_squad ?? "",
        }
      : null,
  };
}

// PUT /turnamen-kelolaan/{id}/pertandingan/{id_pertandingan}/skor  (PB-18 input & PB-19 revisi)
// skor_a, skor_b: angka 0-999, tidak boleh seri. Respons: data bracket terbaru (pemenang sudah maju).
export async function updateScore(id, matchId, { scoreA, scoreB }) {
  const form = new FormData();
  form.append("_method", "PUT");
  form.append("skor_a", String(scoreA));
  form.append("skor_b", String(scoreB));
  const res = await apiRequest(
    `/turnamen-kelolaan/${id}/pertandingan/${matchId}/skor`,
    {
      method: "POST",
      body: form,
    },
  );
  return wrap(res);
}
