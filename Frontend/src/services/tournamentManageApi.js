import { apiRequest } from "./httpClient";

// Semua endpoint /turnamen-kelolaan/{id}/... hanya untuk penyelenggara turnamen tsb.
// Respons: { success, message, data, meta }. Error 403/404/422: { success:false, message }.
const rowsOf = (res) => (Array.isArray(res?.data) ? res.data : []);
const num = (v) =>
  v === null || v === undefined || v === "" ? null : Number(v);

// ----- Bentuk data -----
export function mapRow(r) {
  return {
    id: Number(r.id_pendaftaran),
    status: String(r.status_pendaftaran ?? "").toLowerCase(), // menunggu | diterima | ditolak
    registeredAt: r.tanggal_daftar ?? "",
    verifiedAt: r.tanggal_verifikasi ?? "",
    reason: r.alasan_penolakan ?? "",
    hasProof: Boolean(r.ada_bukti_pembayaran),
    memberCount: Number(r.jumlah_anggota ?? 0),
    squad: {
      id: num(r.squad?.id_squad),
      code: r.squad?.kode_squad ?? "",
      name: r.squad?.nama_squad ?? "-",
      logo: r.squad?.logo_url ?? "",
    },
    rep: {
      id: num(r.perwakilan?.id_player),
      username: r.perwakilan?.username ?? "-",
      avatar: r.perwakilan?.avatar_url ?? "",
    },
  };
}

function mapDetail(d) {
  return {
    ...mapRow(d),
    rosterStatus: String(d.status_roster ?? "").toLowerCase(), // terkunci | terbuka
    canVerify: d.bisa_diverifikasi === true,
    feeType: String(d.turnamen?.jenis_biaya ?? "").toLowerCase(),
    members: (d.anggota ?? []).map((m) => ({
      id: num(m.id_player),
      username: m.username ?? "-",
      avatar: m.avatar_url ?? "",
      role: String(m.peran ?? "").toLowerCase(), // leader | anggota
    })),
    proofUrl: d.bukti_pembayaran_url ?? null,
    // Akun in-game perwakilan (pendaftaran lama bisa kosong)
    gameNickname: d.nickname_game ?? "",
    gameUid: d.uid_game ?? "",
  };
}

// ----- Header halaman Kelola (GET /turnamen/{id}) -----
// jenis_biaya menentukan tab: berbayar -> ada tab Verifikasi Pendaftar.
export async function getManageHeader(id) {
  const res = await apiRequest(`/turnamen/${id}`);
  const t = res?.data ?? res;
  const p = t.pengajuan ?? {};
  return {
    id: Number(t.id_turnamen ?? id),
    name: p.nama_turnamen ?? "-",
    game: p.game?.nama_game ?? "-",
    status: String(t.status ?? "")
      .trim()
      .toLowerCase(), // pendaftaran | berlangsung | selesai
    closeDate: p.jadwal_pendaftaran_tutup ?? "",
    matchDate: p.jadwal_main ?? "",
    type: String(p.tipe_turnamen ?? "").toLowerCase(),
    city: p.kota?.nama_kota ?? "",
    province: p.kota?.provinsi?.nama_provinsi ?? "",
    slot: p.slot ?? null,
    filled: num(p.slot_terisi),
    feeType: String(p.pendanaan?.jenis_biaya ?? "").toLowerCase(),
  };
}

// ----- Tab Pendaftaran -----
// GET /turnamen-kelolaan/{id}/pendaftaran?status=&q=
export async function getRegistrations(id, { status = "", q = "" } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q.trim()) params.set("q", q.trim());
  const qs = params.toString();
  const res = await apiRequest(
    `/turnamen-kelolaan/${id}/pendaftaran${qs ? `?${qs}` : ""}`,
  );
  const meta = res?.meta ?? {};
  return {
    items: rowsOf(res).map(mapRow),
    message: res?.message ?? "",
    meta: {
      slot: num(meta.slot),
      filled: num(meta.slot_terisi),
      waiting: Number(meta.jumlah?.menunggu ?? 0),
      accepted: Number(meta.jumlah?.diterima ?? 0),
      rejected: Number(meta.jumlah?.ditolak ?? 0),
    },
  };
}

// GET /turnamen-kelolaan/{id}/pendaftaran/{id_pendaftaran}
export async function getRegistrationReview(id, regId) {
  const res = await apiRequest(`/turnamen-kelolaan/${id}/pendaftaran/${regId}`);
  return mapDetail(res?.data ?? res);
}

// Bukti pembayaran: file (gambar/pdf) + butuh token -> blob -> object URL.
export async function getProofFile(url) {
  const token = sessionStorage.getItem("esportify_token");
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, */*",
    },
  });
  if (!res.ok) {
    let message = "Bukti pembayaran tidak dapat dimuat.";
    try {
      message = (await res.json())?.message || message;
    } catch {
      /* bukan JSON */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type, size: blob.size };
}

// POST .../terima  -> data = detail terbaru
export async function acceptRegistration(id, regId) {
  const res = await apiRequest(
    `/turnamen-kelolaan/${id}/pendaftaran/${regId}/terima`,
    {
      method: "POST",
    },
  );
  return {
    message: res?.message ?? "Pendaftaran diterima.",
    item: mapDetail(res?.data ?? {}),
  };
}

// POST .../tolak  body: alasan_penolakan (wajib, maks 255)
export async function rejectRegistration(id, regId, reason) {
  const form = new FormData();
  form.append("alasan_penolakan", reason);
  const res = await apiRequest(
    `/turnamen-kelolaan/${id}/pendaftaran/${regId}/tolak`,
    {
      method: "POST",
      body: form,
    },
  );
  return {
    message: res?.message ?? "Pendaftaran ditolak.",
    item: mapDetail(res?.data ?? {}),
  };
}

// ----- Tab Peserta -----
// GET /turnamen-kelolaan/{id}/peserta
export async function getParticipants(id) {
  const res = await apiRequest(`/turnamen-kelolaan/${id}/peserta`);
  return {
    items: rowsOf(res).map(mapRow),
    message: res?.message ?? "",
    meta: {
      count: Number(res?.meta?.jumlah_peserta ?? 0),
      slot: num(res?.meta?.slot),
    },
  };
}

// Detail tiap peserta (anggota + akun in-game perwakilan).
// List peserta belum membawa nickname/UID, jadi diambil dari detail pendaftaran (8 request sekaligus).
// Kalau BE sudah menambahkan nickname_game/uid_game ke list peserta, fungsi ini bisa dihapus.
export async function getParticipantAccounts(id, items) {
  const map = {};
  for (let i = 0; i < items.length; i += 8) {
    await Promise.all(
      items.slice(i, i + 8).map(async (it) => {
        try {
          map[it.id] = await getRegistrationReview(id, it.id);
        } catch {
          map[it.id] = null;
        }
      }),
    );
  }
  return map;
}

// ----- Selesaikan turnamen (PB-09) -----
// POST /turnamen-kelolaan/{id}/selesaikan
export async function finishTournament(id) {
  const res = await apiRequest(`/turnamen-kelolaan/${id}/selesaikan`, {
    method: "POST",
  });
  const d = res?.data ?? {};
  return {
    message: res?.message ?? "Turnamen berhasil diselesaikan.",
    status: String(d.status ?? "selesai").toLowerCase(),
  };
}

// ----- Kartu Kelola Turnamen: jumlah peserta & yang perlu diverifikasi -----
// Satu request per turnamen (meta dari tab Pendaftaran). Gagal -> null (kartu menampilkan "-").
export async function getRegistrationMeta(id) {
  try {
    const res = await apiRequest(
      `/turnamen-kelolaan/${id}/pendaftaran?status=menunggu`,
    );
    const m = res?.meta ?? {};
    return {
      filled: num(m.slot_terisi),
      waiting: Number(m.jumlah?.menunggu ?? 0),
    };
  } catch {
    return null;
  }
}

// ----- Roster Lock (sisi squad) -----
// Squad terkunci kalau punya pendaftaran menunggu/diterima di turnamen yang belum selesai.
// GET /squad/{id}/pendaftaran-turnamen. ASSUMPTION: nama field status mengikuti kontrak PB-10.
export async function isSquadRosterLocked(squadId) {
  const res = await apiRequest(`/squad/${squadId}/pendaftaran-turnamen`);
  return rowsOf(res).some((r) => {
    const st = String(r.status_pendaftaran ?? r.status ?? "").toLowerCase();
    const ts = String(
      r.turnamen?.status ?? r.status_turnamen ?? "",
    ).toLowerCase();
    return (st === "menunggu" || st === "diterima") && ts !== "selesai";
  });
}
