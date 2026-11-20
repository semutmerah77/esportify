import { apiRequest } from "./httpClient";
import { formatShortDate } from "./tournamentCancellationApi";

// PB-26 Pengembalian Dana (refund) turnamen berbayar yang dibatalkan.
// Respons { success, message, data, meta }. 422 validasi: { message, errors }.
// Berkas privat (QRIS & bukti transfer) diambil lewat fetchProtectedFileUrl (butuh token) hanya saat "Lihat".

export const REFUND_TEXT_MAX = 150; // nomor_rekening & atas_nama
export const REFUND_FILE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const QRIS_EXTENSIONS = ["jpg", "jpeg", "png"];
export const PROOF_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"];
export const REFUND_COUNTDOWN_SECONDS = 10; // tombol kirim aktif 10 detik setelah dialog terbuka (keputusan SA)

export const REFUND_METHOD_TRANSFER = "transfer_bank";
export const REFUND_METHOD_QRIS = "qris";

const num = (v) =>
  v === null || v === undefined || v === "" ? null : Number(v);

export const formatRupiah = (value) =>
  value === null || value === undefined || value === ""
    ? "-"
    : `Rp${Number(value).toLocaleString("id-ID")}`;

export { formatShortDate };

// <Refund> dari kontrak PB-26
export function mapRefund(r) {
  if (!r) return null;
  return {
    id: Number(r.id_refund),
    registrationId: num(r.id_pendaftaran),
    squadId: num(r.squad?.id_squad),
    squadName: r.squad?.nama_squad ?? "-",
    registrantId: num(r.pendaftar?.id_player),
    registrant: r.pendaftar?.username ?? "-",
    amount: num(r.nominal),
    status: String(r.status_refund ?? "").toLowerCase(), // menunggu_data | menunggu_transfer | selesai
    statusLabel: r.label_status_refund ?? "",
    method: r.metode_refund ?? null, // transfer_bank | qris
    methodLabel: r.label_metode_refund ?? "",
    holderName: r.atas_nama ?? null, // null untuk anggota non-pendaftar
    accountNumber: r.nomor_rekening ?? null, // "NAMA BANK - NOMOR"
    qrisUrl: r.file_qris_url ?? null,
    proofUrl: r.bukti_transfer_url ?? null,
    proofKind: r.jenis_bukti_transfer ?? null, // gambar | pdf
    submittedAt: r.tanggal_pengajuan ?? null,
    refundedAt: r.tanggal_refund ?? null,
    canUploadProof: r.bisa_unggah_bukti === true, // hanya di respons penyelenggara
  };
}

const mapTournament = (t = {}) => ({
  id: num(t.id_turnamen),
  name: t.nama_turnamen ?? "",
  organizer: t.nama_penyelenggara ?? "",
  status: String(t.status ?? "").toLowerCase(),
  feeType: String(t.jenis_biaya ?? "").toLowerCase(),
});

// ----- Peserta -----
// GET /turnamen/{id}/refund (dipanggil saat tab dibuka dan setelah submit; tanpa polling)
export async function getParticipantRefund(id) {
  const res = await apiRequest(`/turnamen/${id}/refund`);
  const d = res?.data ?? {};
  const methods = (res?.meta?.pilihan_metode_refund ?? []).map((m) => ({
    code: m.kode,
    label: m.label,
  }));
  return {
    tournament: mapTournament(d.turnamen),
    available: d.tersedia === true,
    note: d.keterangan ?? "",
    plannedDate: d.rencana_pengembalian_dana ?? null,
    isRegistrant: d.saya_pendaftar === true,
    canFill: d.bisa_isi_data === true,
    refund: mapRefund(d.refund),
    methods,
  };
}

// POST /turnamen/{id}/refund (multipart). Hanya sekali; sukses 201.
export async function submitParticipantRefund(
  id,
  { method, accountNumber, holderName, qrisFile },
) {
  const form = new FormData();
  form.append("metode_refund", method);
  if (method === REFUND_METHOD_TRANSFER)
    form.append("nomor_rekening", accountNumber.trim());
  form.append("atas_nama", holderName.trim());
  if (method === REFUND_METHOD_QRIS && qrisFile)
    form.append("file_qris", qrisFile);
  form.append("konfirmasi", "1"); // dialog "Periksa kembali data" berfungsi sebagai konfirmasi
  const res = await apiRequest(`/turnamen/${id}/refund`, {
    method: "POST",
    body: form,
  });
  return { message: res?.message ?? "", refund: mapRefund(res?.data) };
}

// ----- Penyelenggara -----
// GET /turnamen-kelolaan/{id}/refund
export async function getOrganizerRefunds(id) {
  const res = await apiRequest(`/turnamen-kelolaan/${id}/refund`);
  const d = res?.data ?? {};
  const s = d.ringkasan ?? {};
  return {
    tournament: mapTournament(d.turnamen),
    available: d.tersedia === true,
    note: d.keterangan ?? "",
    plannedDate: d.rencana_pengembalian_dana ?? null,
    summary: {
      participants: Number(s.jumlah_peserta ?? 0),
      waitingData: Number(s.menunggu_data ?? 0),
      waitingTransfer: Number(s.menunggu_transfer ?? 0),
      done: Number(s.selesai ?? 0),
      amountEach: num(s.nominal_per_peserta),
      total: num(s.total_nominal),
    },
    items: (d.refund ?? []).map(mapRefund), // urutan dari BE: menunggu_transfer, menunggu_data, selesai
  };
}

// POST /turnamen-kelolaan/{id}/refund/{id_refund}/bukti-transfer (multipart). Sukses 200.
export async function uploadTransferProof(tournamentId, refundId, file) {
  const form = new FormData();
  form.append("bukti_transfer", file);
  form.append("konfirmasi", "1");
  const res = await apiRequest(
    `/turnamen-kelolaan/${tournamentId}/refund/${refundId}/bukti-transfer`,
    { method: "POST", body: form },
  );
  return { message: res?.message ?? "", refund: mapRefund(res?.data) };
}

// "BCA - 1234567890" -> { bank: "BCA", number: "1234567890" }
export function splitAccount(value) {
  const text = String(value ?? "").trim();
  const at = text.indexOf(" - ");
  if (at === -1) return { bank: "", number: text };
  return { bank: text.slice(0, at).trim(), number: text.slice(at + 3).trim() };
}
