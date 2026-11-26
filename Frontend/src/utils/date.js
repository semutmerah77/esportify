const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// 2026-11-12 atau ISO penuh -> 12 November 2026. Teks lain ditampilkan apa adanya.
// ISO dengan zona waktu (Z / +07:00) dikonversi ke tanggal WIB dulu, supaya
// "2026-11-24T17:00:00Z" tampil 25 November (bukan 24).
export const longDate = (value) => {
  const s = String(value ?? "");
  if (/T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const [y, mo, da] = d
        .toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
        .split("-");
      return `${Number(da)} ${MONTHS[Number(mo) - 1]} ${y}`;
    }
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m
    ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`
    : value || "-";
};

// Format YYYY-MM-DD memakai tanggal lokal (bukan UTC)
export const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  return toISO(new Date(y, m - 1, d + n));
};

// "2026-10-27 07:50:54" (tanpa zona waktu) dibaca sebagai waktu lokal. ASSUMPTION: zona waktu belum pasti.
export const parseDeadline = (value) => {
  const t = Date.parse(String(value ?? "").replace(" ", "T"));
  return Number.isNaN(t) ? null : t;
};

export const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

export const rupiah = (v) =>
  v === null || v === undefined || v === ""
    ? "-"
    : `Rp. ${Number(v).toLocaleString("id-ID")}`;
