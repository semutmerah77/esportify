import { apiRequest } from "./httpClient";

export const isAbort = (e) => e?.name === "AbortError";

const mapPartner = (l) => ({
  id: l.id_player,
  username: l.username,
  avatar: l.avatar_url || null,
});

export const mapMessage = (m) => ({
  id: m.id_pesan,
  conversationId: m.id_percakapan,
  senderId: m.id_player_pengirim,
  text: m.isi_pesan,
  sentAt: m.dikirim_pada,
  mine: m.milik_saya === true,
  read: m.terbaca === true,
});

// Halaman pesan (endpoint 2 dan 3 bentuknya sama)
const mapPage = (d) => ({
  id: d.id_percakapan,
  partner: mapPartner(d.lawan_bicara),
  blocked: d.saya_memblokir === true,
  messages: (d.pesan ?? []).map(mapMessage),
  hasOlder: d.ada_pesan_lebih_lama === true,
  serverTime: d.waktu_server,
});

// GET /chat/percakapan
export async function getConversations({ signal } = {}) {
  const res = await apiRequest("/chat/percakapan", { signal });
  return (res?.data ?? []).map((c) => ({
    id: c.id_percakapan,
    partner: mapPartner(c.lawan_bicara),
    last: c.pesan_terakhir ? mapMessage(c.pesan_terakhir) : null,
    unread: c.jumlah_belum_dibaca ?? 0,
    blocked: c.saya_memblokir === true,
  }));
}

// POST /chat/player/{id_player}
export async function openChatWithPlayer(playerId) {
  const res = await apiRequest(`/chat/player/${encodeURIComponent(playerId)}`, {
    method: "POST",
  });
  return mapPage(res.data);
}

// GET /chat/percakapan/{id}?sebelum_id=
export async function getConversationPage(id, { before, signal } = {}) {
  const q = before ? `?sebelum_id=${encodeURIComponent(before)}` : "";
  const res = await apiRequest(
    `/chat/percakapan/${encodeURIComponent(id)}${q}`,
    { signal },
  );
  return mapPage(res.data);
}

// POST /chat/percakapan/{id}/pesan
export async function sendMessage(id, text) {
  const res = await apiRequest(
    `/chat/percakapan/${encodeURIComponent(id)}/pesan`,
    { method: "POST", body: { isi_pesan: text } },
  );
  return mapMessage(res.data);
}

// GET /chat/percakapan/{id}/pesan-terbaru?waktu_terakhir=
export async function getNewMessages(id, since, { signal } = {}) {
  const res = await apiRequest(
    `/chat/percakapan/${encodeURIComponent(id)}/pesan-terbaru?waktu_terakhir=${encodeURIComponent(since)}`,
    { signal },
  );
  const d = res?.data ?? {};
  return {
    messages: (d.pesan ?? []).map(mapMessage),
    lastReadId: d.id_pesan_terakhir_dibaca ?? null,
    serverTime: d.waktu_server,
  };
}

// POST /chat/percakapan/{id}/dibaca
export async function markConversationRead(id) {
  await apiRequest(`/chat/percakapan/${encodeURIComponent(id)}/dibaca`, {
    method: "POST",
  });
}

// POST /chat/percakapan/{id}/bersihkan
export async function clearConversation(id) {
  await apiRequest(`/chat/percakapan/${encodeURIComponent(id)}/bersihkan`, {
    method: "POST",
  });
}

// DELETE /chat/percakapan/{id}
export async function deleteConversation(id) {
  await apiRequest(`/chat/percakapan/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// POST / DELETE /chat/blokir/{id_player}
export async function blockPlayer(playerId) {
  await apiRequest(`/chat/blokir/${encodeURIComponent(playerId)}`, {
    method: "POST",
  });
}
export async function unblockPlayer(playerId) {
  await apiRequest(`/chat/blokir/${encodeURIComponent(playerId)}`, {
    method: "DELETE",
  });
}
