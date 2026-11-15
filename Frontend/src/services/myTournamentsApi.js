import { apiRequest } from "./httpClient";

// Turnamen yang roster-nya memuat player login (1 request).
// GET /turnamen-saya -> anggota squad yang TIDAK dipilih ke roster tidak menerima turnamen itu.
// Data sudah urut dari pendaftaran terbaru. rosterLocked = true selama pendaftaran menunggu/diterima.
export async function getMyTournaments() {
  const res = await apiRequest("/turnamen-saya");
  return (Array.isArray(res?.data) ? res.data : []).map((r) => ({
    id: Number(r.id_pendaftaran),
    status: String(r.status_pendaftaran ?? "").toLowerCase(), // menunggu | diterima | ditolak
    reason: r.alasan_penolakan ?? "",
    rosterLocked: Boolean(r.roster_terkunci_saya),
    registeredAt: r.tanggal_daftar ?? "",
    tournamentId: Number(r.turnamen?.id_turnamen),
    name: r.turnamen?.nama_turnamen ?? "-",
    matchDate: r.turnamen?.jadwal_main ?? "",
    squadName: r.squad?.nama_squad ?? "-",
    squadLogo: r.squad?.logo_url ?? "",
    game: r.turnamen?.nama_game ?? "",
    tournamentStatus: String(r.turnamen?.status ?? "")
      .trim()
      .toLowerCase(), // pendaftaran | berlangsung | selesai
    type: String(r.turnamen?.tipe_turnamen ?? "").toLowerCase(),
    slot: r.turnamen?.slot ?? null,
    filled: r.turnamen?.slot_terisi ?? null,
  }));
}
