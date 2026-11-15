import { apiRequest } from "./httpClient";

// Daftar peserta untuk anggota roster peserta (dan penyelenggara).
// GET /turnamen/{id}/peserta
// 403 "Daftar peserta hanya dapat dilihat oleh peserta turnamen ini." -> err.message dari BE.
// squad_saya = true -> squad milik user login (diberi tanda di daftar).
export async function getTournamentParticipants(id) {
  const res = await apiRequest(`/turnamen/${encodeURIComponent(id)}/peserta`);
  const rows = Array.isArray(res?.data) ? res.data : [];
  return {
    items: rows.map((r) => ({
      id: Number(r.id_pendaftaran),
      mine: r.squad_saya === true,
      squad: {
        id: r.squad?.id_squad ?? null,
        code: r.squad?.kode_squad ?? "",
        name: r.squad?.nama_squad ?? "-",
        logo: r.squad?.logo_url ?? "",
      },
      rep: {
        id: null, // endpoint ini tidak membawa id_player perwakilan
        username: r.perwakilan?.username ?? "-",
        avatar: r.perwakilan?.avatar_url ?? "",
      },
      gameNickname: r.nickname_game ?? "",
      gameUid: r.uid_game ?? "",
    })),
    meta: {
      id: res?.meta?.id_turnamen ?? null,
      name: res?.meta?.nama_turnamen ?? "",
      count: Number(res?.meta?.jumlah_peserta ?? rows.length),
    },
  };
}