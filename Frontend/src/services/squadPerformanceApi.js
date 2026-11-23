import { apiRequest } from "./httpClient";

// PB-21 Win Rate Squad dan PB-22 Badge & Riwayat Pencapaian Squad.
// Respons { success, message, data }. Hanya turnamen "selesai" dengan pendaftaran "diterima" yang dihitung.
// Win Rate = Juara 1 / total turnamen selesai x 100 (dihitung BE, FE hanya menampilkan).

const count = (v) => Number(v ?? 0);
const ratio = (v) => (v === null || v === undefined ? null : Number(v));
const squadPath = (id, rest) => `/squad/${encodeURIComponent(id)}/${rest}`;

export const formatPercent = (value) =>
  value === null || value === undefined ? "-" : `${Number(value).toFixed(1)}%`;

const mapGame = (g = {}) => ({
  id: Number(g.id_game),
  name: g.nama_game ?? "-",
  avatar: g.avatar_url ?? null,
});

// GET /squad/{id}/win-rate: kartu di Detail Squad (ringan).
export async function getSquadWinRate(id) {
  const d = (await apiRequest(squadPath(id, "win-rate")))?.data ?? {};
  return {
    totalTournaments: count(d.total_turnamen),
    totalFirst: count(d.total_juara_1),
    winRate: ratio(d.win_rate),
    hasData: d.ada_data === true,
  };
}

// GET /squad/{id}/badge: jumlah Juara 1, 2, 3 (ringan).
export async function getSquadBadge(id) {
  const d = (await apiRequest(squadPath(id, "badge")))?.data ?? {};
  return {
    first: count(d.juara_1),
    second: count(d.juara_2),
    third: count(d.juara_3),
  };
}

// GET /squad/{id}/win-rate/detail: halaman "Lihat Semua" (dipanggil saat halaman dibuka saja).
export async function getSquadWinRateDetail(id) {
  const d = (await apiRequest(squadPath(id, "win-rate/detail")))?.data ?? {};
  return {
    totalTournaments: count(d.total_turnamen),
    totalWins: count(d.total_kemenangan),
    winRate: ratio(d.win_rate),
    hasData: d.ada_data === true,
    games: (d.daftar_game ?? []).map((g) => ({
      ...mapGame(g),
      totalTournaments: count(g.total_turnamen),
      totalFirst: count(g.total_juara_1),
      winRate: ratio(g.win_rate),
    })),
  };
}

// GET /squad/{id}/pencapaian: riwayat turnamen selesai yang diikuti (terbaru di atas).
export async function getSquadAchievements(id) {
  const res = await apiRequest(squadPath(id, "pencapaian"));
  const list = Array.isArray(res?.data) ? res.data : [];
  return list.map((a) => ({
    id: Number(a.id_turnamen),
    name: a.nama_turnamen ?? "-",
    posterUrl: a.poster_url ?? null,
    playedAt: a.jadwal_main ?? null,
    game: mapGame(a.game),
    rank: a.peringkat_akhir ?? null, // 1 | 2 | 3 | null
    rankLabel: a.label_peringkat ?? "Peserta", // "Juara 1".."Juara 3" | "Peserta"
  }));
}
