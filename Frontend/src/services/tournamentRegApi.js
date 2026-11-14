import { apiRequest, ApiError } from "./httpClient";

export const rupiah = (n) => "Rp." + Number(n || 0).toLocaleString("id-ID");

export const STATUS = {
  menunggu: { label: "Menunggu", full: "Menunggu Verifikasi", tone: "wait" },
  diterima: { label: "Diterima", full: "Diterima", tone: "ok" },
  ditolak: { label: "Ditolak", full: "Ditolak", tone: "bad" },
};

// Dari data GET /turnamen/:id -> keadaan tombol "Daftar" di Detail Turnamen
// { state: "daftar" | "status" | "ditutup" | "penuh", reg, note }
export function getRegistrationState(d) {
  const p = d?.pengajuan ?? {};
  // Penyelenggara tidak boleh mendaftar di turnamennya sendiri
  if (d?.is_penyelenggara === true) {
    return {
      state: "penyelenggara",
      reg: null,
      note: "Anda adalah penyelenggara turnamen ini",
    };
  }
  const reg = d?.pendaftaran_saya ?? null;
  const open = (d?.pendaftaran_terbuka ?? p.pendaftaran_terbuka) !== false;
  const full = p.slot_penuh === true;
  if (reg && reg.status_pendaftaran !== "ditolak") {
    return {
      state: "status",
      reg,
      note:
        reg.didaftarkan_oleh_saya === false
          ? `Didaftarkan oleh ${reg.pendaftar?.username}`
          : "",
    };
  }
  const rejected = reg?.status_pendaftaran === "ditolak" ? reg : null;
  if (!open)
    return {
      state: "ditutup",
      reg: rejected,
      note: "Pendaftaran sudah ditutup",
    };
  if (full)
    return { state: "penuh", reg: rejected, note: "Slot turnamen sudah penuh" };
  return { state: "daftar", reg: rejected, note: "" };
}

// Status tombol Daftar untuk halaman Detail Turnamen (terpisah dari mapper detail)
export async function getRegistrationInfo(id) {
  const res = await apiRequest(`/turnamen/${encodeURIComponent(id)}`);
  return {
    ...getRegistrationState(res.data),
    filled: Number(res.data?.pengajuan?.slot_terisi ?? 0), // menunggu + diterima
  };
}

// GET /api/turnamen/:id
export async function getTournamentForRegister(id) {
  const res = await apiRequest(`/turnamen/${encodeURIComponent(id)}`);
  const d = res.data ?? {};
  const p = d.pengajuan ?? {};
  const paid = p.pendanaan?.jenis_biaya === "berbayar";
  return {
    id: d.id_turnamen ?? id,
    // Sesuaikan nama field ini dengan mapper Detail Turnamen milikmu bila berbeda
    name: d.nama_turnamen ?? p.nama_turnamen ?? "",
    game: d.game?.nama_game ?? d.nama_game ?? p.nama_game ?? "",
    paid,
    fee: Number(p.pendanaan?.biaya_pendaftaran ?? 0),
    minRoster: p.min_roster ?? null,
    maxRoster: p.maks_roster ?? null,
    payment: p.pembayaran
      ? {
          method: p.pembayaran.metode_pembayaran,
          qris: p.pembayaran.qris || null,
          account: p.pembayaran.no_rekening || null,
        }
      : null,
    ...getRegistrationState(d),
  };
}

// GET /api/turnamen/:id/squad-saya  (halaman 1/2 - pilih squad, tanpa daftar anggota)
export async function getSquadChoices(id) {
  const res = await apiRequest(
    `/turnamen/${encodeURIComponent(id)}/squad-saya`,
  );
  return {
    items: (res?.data ?? []).map((s) => ({
      id: s.id_squad,
      code: s.kode_squad,
      name: s.nama_squad,
      logo: s.logo_url || null,
      isLeader: s.is_leader,
      count: s.jumlah_anggota,
      selectable: s.jumlah_bisa_dipilih ?? null,
      minRoster: s.min_roster ?? null,
      maxRoster: s.maks_roster ?? null,
      registrationId: s.id_pendaftaran,
      canRegister: s.bisa_daftar,
      reason: s.alasan || "",
    })),
    minRoster: res?.meta?.min_roster ?? null,
    maxRoster: res?.meta?.maks_roster ?? null,
    paid: res?.meta?.jenis_biaya === "berbayar",
    message: res?.message || "",
    organizer: res?.meta?.is_penyelenggara === true,
  };
}

// GET /api/turnamen/:id/squad-saya/:idSquad  (halaman 2/2 - pilih roster)
export async function getSquadRoster(id, squadId) {
  const res = await apiRequest(
    `/turnamen/${encodeURIComponent(id)}/squad-saya/${encodeURIComponent(squadId)}`,
  );
  const d = res?.data ?? {};
  return {
    minRoster: d.min_roster ?? null,
    maxRoster: d.maks_roster ?? null,
    selectable: d.jumlah_bisa_dipilih ?? null,
    canRegister: d.bisa_daftar !== false,
    reason: d.alasan || "",
    members: (d.anggota ?? []).map((a) => ({
      id: a.id_player,
      username: a.username,
      avatar: a.avatar_url || null,
      role: a.peran,
      isMe: a.is_pendaftar === true,
      canPick: a.bisa_dipilih === true,
      reason: /^penyelenggara/i.test(a.alasan || "")
        ? `${a.username} adalah penyelenggara turnamen ini`
        : a.alasan || "",
    })),
  };
}

export function mapRegistration(d) {
  return {
    id: d.id_pendaftaran,
    status: d.status_pendaftaran,
    rosterLocked: d.status_roster === "terkunci",
    registeredAt: d.tanggal_daftar,
    verifiedAt: d.tanggal_verifikasi,
    reason: d.alasan_penolakan || "",
    tournament: {
      id: d.turnamen?.id_turnamen,
      name: d.turnamen?.nama_turnamen,
      date: d.turnamen?.jadwal_main,
      paid: d.turnamen?.jenis_biaya === "berbayar",
      fee: Number(d.turnamen?.biaya_pendaftaran ?? 0),
    },
    squad: {
      id: d.squad?.id_squad,
      code: d.squad?.kode_squad,
      name: d.squad?.nama_squad,
      logo: d.squad?.logo_url || null,
    },
    registrant: { id: d.pendaftar?.id_player, username: d.pendaftar?.username },
    byMe: d.didaftarkan_oleh_saya,
    members: (d.anggota ?? []).map((a) => ({
      id: a.id_player,
      username: a.username,
      avatar: a.avatar_url || null,
      role: a.peran,
    })),
    hasProof: Boolean(d.ada_bukti_pembayaran),
    proofUrl: d.bukti_pembayaran_url || null,
    gameNickname: d.nickname_game || "", // pendaftaran lama bisa kosong
    gameUid: d.uid_game || "",
  };
}

// POST /api/turnamen/:id/daftar (multipart). 422 -> err.message sudah bahasa Indonesia.
export async function submitRegistration(
  tournamentId,
  { squadId, roster = [], nickname, uid, file, agree },
) {
  const form = new FormData();
  form.append("id_squad", squadId);
  roster.forEach((playerId) => form.append("roster[]", playerId));
  form.append("nickname_game", nickname);
  form.append("uid_game", uid);
  if (file) form.append("bukti_pembayaran", file);
  if (agree) form.append("setuju_ketentuan", "1");
  const res = await apiRequest(
    `/turnamen/${encodeURIComponent(tournamentId)}/daftar`,
    {
      method: "POST",
      body: form,
    },
  );
  return { message: res.message, registration: mapRegistration(res.data) };
}

// GET /api/pendaftaran-turnamen/:id
export async function getRegistration(id) {
  try {
    const res = await apiRequest(
      `/pendaftaran-turnamen/${encodeURIComponent(id)}`,
    );
    return mapRegistration(res.data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

// GET /api/squad/:id/pendaftaran-turnamen (anggota aktif; selain itu 403)
export async function getSquadRegistrations(squadId) {
  const res = await apiRequest(
    `/squad/${encodeURIComponent(squadId)}/pendaftaran-turnamen`,
  );
  return (res?.data ?? []).map((r) => ({
    id: r.id_pendaftaran,
    status: r.status_pendaftaran,
    rosterLocked: r.status_roster === "terkunci",
    registeredAt: r.tanggal_daftar,
    reason: r.alasan_penolakan || "",
    tournament: {
      id: r.turnamen?.id_turnamen,
      name: r.turnamen?.nama_turnamen,
      date: r.turnamen?.jadwal_main,
    },
    registrant: r.pendaftar?.username,
  }));
}

const getToken = () => sessionStorage.getItem("esportify_token");

export async function getProofBlob(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/json, */*",
    },
  });
  if (!res.ok) {
    let msg = `Bukti pembayaran tidak dapat dimuat (kode ${res.status}).`;
    try {
      msg = (await res.json()).message || msg;
    } catch {
      /* bukan JSON */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}

// Path file dari BE (mis. "qris/abc.png") -> URL lengkap di /storage.
// hint = URL file lain dari BE (mis. logo squad) untuk menurunkan alamat server.
export function storageUrl(path, hint = "") {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const clean = String(path)
    .replace(/^\/+/, "")
    .replace(/^storage\//, "");
  const m = String(hint).match(/^(.*\/storage\/)/);
  const base = m
    ? m[1]
    : `${(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "")}/storage/`;
  return base + clean;
}
