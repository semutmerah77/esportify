import { apiRequest } from "./httpClient";
import { homeCache } from "./homeCache";

const TTL_MS = 45 * 1000; // 30-60 detik sesuai kontrak

const mapSquadMini = (s) => ({
  id: s.id_squad,
  name: s.nama_squad,
  logo: s.logo_url || null,
});

function mapHome(d) {
  const joined = d.turnamen_diikuti ?? {};
  const community = d.komunitas_diikuti ?? {};
  const squads = d.squad_saya ?? {};
  const latest = d.turnamen_terbaru ?? {};

  return {
    joined: {
      total: joined.total ?? 0,
      items: (joined.data ?? []).map((t) => ({
        registrationId: t.id_pendaftaran,
        registrationStatus: t.status_pendaftaran, // menunggu | diterima | ditolak
        id: t.id_turnamen,
        name: t.nama_turnamen,
        poster: t.poster_url || null,
        game: t.nama_game,
        playAt: t.jadwal_main,
        status: t.status_turnamen, // pendaftaran | berlangsung | selesai | dibatalkan
        type: t.tipe_turnamen, // online | offline
        squad: t.squad ? mapSquadMini(t.squad) : null,
      })),
    },
    community: {
      total: community.total ?? 0,
      items: community.data ?? [], // selalu kosong sampai Fase 3
    },
    squads: {
      total: squads.total ?? 0,
      items: (squads.data ?? []).map((s) => ({
        ...mapSquadMini(s),
        code: s.kode_squad,
        members: s.jumlah_anggota ?? null, // anggota aktif
      })),
    },
    latest: {
      total: latest.total ?? 0,
      items: (latest.data ?? []).map((t) => ({
        id: t.id_turnamen,
        name: t.nama_turnamen,
        poster: t.poster_url || null,
        game: t.nama_game,
        type: t.tipe_turnamen, // online | offline
        slot: t.slot,
        prize: t.total_hadiah,
        fee: Number(t.biaya_pendaftaran ?? 0), // 0 = gratis
        slotFilled: Number(t.slot_terisi ?? 0),
        closeAt: t.jadwal_pendaftaran_tutup,
        playAt: t.jadwal_main,
        open: t.pendaftaran_terbuka === true,
        status: t.status_turnamen,
        createdAt: t.dibuat_pada,
      })),
    },
  };
}

// Urutan prioritas turnamen diikuti: yang sedang berlangsung tampil paling depan.
// Urutan dari BE (pendaftaran terbaru) dipertahankan di dalam status yang sama.
const STATUS_ORDER = {
  berlangsung: 0,
  pendaftaran: 1,
  selesai: 2,
  dibatalkan: 3,
};
const sortJoined = (items) =>
  [...items].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
  );

// Data Home yang masih segar (null kalau belum ada / sudah lewat 45 detik / ganti akun)
export const getCachedHome = () => homeCache.get(TTL_MS);

// GET /home-player: satu request untuk seluruh halaman
export async function getHome({ signal } = {}) {
  const res = await apiRequest("/home-player", { signal });
  const data = mapHome(res?.data ?? {});
  data.joined.items = sortJoined(data.joined.items);
  homeCache.set(data);
  return data;
}
