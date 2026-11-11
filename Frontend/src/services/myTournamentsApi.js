import { apiRequest } from "./httpClient";
import { getMySquads } from "./squadApi";
import { getSquadRegistrations } from "./tournamentRegApi";

// Gabungan pendaftaran dari semua squad milik player + info turnamennya.
// Riwayat pendaftaran hanya membawa id/nama/jadwal turnamen, jadi game, status turnamen,
// tipe, dan slot diambil dari GET /turnamen/:id. Kalau detail gagal dimuat, kartu tetap tampil.
export async function getMyTournaments() {
  const squads = await getMySquads();

  const perSquad = await Promise.all(
    squads.map((s) =>
      getSquadRegistrations(s.squadId)
        .then((list) => list.map((r) => ({ ...r, squad: s })))
        .catch(() => []),
    ),
  );

  const regs = perSquad.flat().map((r) => ({
    id: r.id,
    status: r.status, // menunggu | diterima | ditolak
    reason: r.reason,
    rosterLocked: r.rosterLocked,
    registeredAt: r.registeredAt,
    tournamentId: r.tournament.id,
    name: r.tournament.name ?? "-",
    matchDate: r.tournament.date,
    squadName: r.squad.name,
  }));

  const ids = [...new Set(regs.map((r) => r.tournamentId))];
  const details = new Map(
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await apiRequest(`/turnamen/${encodeURIComponent(id)}`);
          const d = res?.data ?? {};
          const p = d.pengajuan ?? {};
          return [
            id,
            {
              game: d.game?.nama_game ?? d.nama_game ?? p.game?.nama_game ?? p.nama_game ?? "",
              tournamentStatus: String(d.status ?? d.status_turnamen ?? p.status ?? "").trim().toLowerCase(),
              type: String(p.tipe_turnamen ?? d.tipe_turnamen ?? "").trim().toLowerCase(),
              slot: p.slot ?? p.jumlah_slot ?? d.slot ?? null,
              filled: p.slot_terisi ?? null,
            },
          ];
        } catch {
          return [id, null];
        }
      }),
    ),
  );

  return regs
    .map((r) => ({
      game: "",
      tournamentStatus: "",
      type: "",
      slot: null,
      filled: null,
      ...(details.get(r.tournamentId) ?? {}),
      ...r,
    }))
    .sort((a, b) => String(b.registeredAt).localeCompare(String(a.registeredAt)));
}