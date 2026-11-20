import { apiRequest } from "./httpClient";

// PB-24 Perpanjangan Jadwal (penyelenggara).
// Respons { success, message, data, meta }. 422 validasi: { message, errors }.
// Semua tanggal dari BE berformat ISO UTC dan ditampilkan dalam WIB.

const TZ = "Asia/Jakarta";
const WIB_OFFSET = "+07:00";
export const DAY_MS = 86400000;

// Satu instance formatter dipakai ulang (tidak dibuat per baris / per render)
const inputParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const longDate = new Intl.DateTimeFormat("id-ID", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortDateTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const toDate = (value) => {
  if (!value) return null;
  const text = String(value)
    .trim()
    .replace(/(\.\d{3})\d+/, "$1");
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

// ISO UTC -> "YYYY-MM-DDTHH:mm" (WIB) untuk <input type="datetime-local">
export function toWibInput(value) {
  const date = toDate(value);
  if (!date) return "";
  const p = Object.fromEntries(
    inputParts.formatToParts(date).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// "YYYY-MM-DDTHH:mm" (WIB) -> Date
export function wibInputToDate(input) {
  if (!input) return null;
  const date = new Date(`${input}:00${WIB_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const formatWibDate = (value) => {
  const date = toDate(value);
  return date ? longDate.format(date) : "";
};
export const formatWibDateTime = (value) => {
  const date = toDate(value);
  return date ? shortDateTime.format(date).replace(",", "") : "";
};

const pair = (o = {}) => ({
  close: o.jadwal_pendaftaran_tutup ?? null,
  play: o.jadwal_main ?? null,
});

function mapExtension(res) {
  const d = res?.data ?? {};
  const m = res?.meta ?? {};
  const t = d.turnamen ?? {};
  return {
    message: res?.message ?? "",
    tournament: {
      id: Number(t.id_turnamen),
      name: t.nama_turnamen ?? "",
      status: String(t.status ?? "").toLowerCase(),
      registrationOpen: t.pendaftaran_terbuka === true,
    },
    canExtend: d.bisa_perpanjang === true,
    reason: d.alasan_tidak_bisa_perpanjang ?? "",
    extended: d.sudah_diperpanjang === true,
    initial: pair(d.jadwal_awal),
    active: pair(d.jadwal_aktif),
    max: pair(d.batas_maksimal),
    limits: {
      maxDays: Number(m.batas_hari_perpanjangan ?? 14),
      minGapDays: Number(m.jarak_minimal_tutup_ke_main_hari ?? 1),
      // selisih jam server dengan jam perangkat: hitung waktu "sekarang" di FE tanpa request ulang
      serverOffset: toDate(m.waktu_server)
        ? toDate(m.waktu_server).getTime() - Date.now()
        : 0,
    },
    impact: d.dampak
      ? {
          reopened: d.dampak.pendaftaran_dibuka_kembali === true,
          bracketDraft: d.dampak.bracket_kembali_draft === true,
          before: d.dampak.status_sebelumnya ?? null,
          after: d.dampak.status_sekarang ?? null,
        }
      : null,
  };
}

// GET /turnamen-kelolaan/{id}/perpanjangan-jadwal (hanya saat dialog dibuka)
export async function getScheduleExtension(id) {
  return mapExtension(
    await apiRequest(`/turnamen-kelolaan/${id}/perpanjangan-jadwal`),
  );
}

// PUT /turnamen-kelolaan/{id}/perpanjangan-jadwal (JSON). Kirim KEDUA jadwal:
// yang tidak diubah dikirim apa adanya dari jadwal_aktif. Respons sudah memuat data terbaru + dampak.
export async function submitScheduleExtension(id, { close, play }) {
  const res = await apiRequest(`/turnamen-kelolaan/${id}/perpanjangan-jadwal`, {
    method: "PUT",
    body: {
      jadwal_pendaftaran_tutup_baru: close,
      jadwal_main_baru: play,
      konfirmasi: true,
    },
  });
  return mapExtension(res);
}
