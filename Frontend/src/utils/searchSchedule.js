// Logika filter jadwal untuk halaman Cari Turnamen.
// Semua perbandingan memakai tanggal "YYYY-MM-DD" di zona Asia/Jakarta (WIB).

export const SCHEDULE_OPTIONS = [
  { value: "", label: "Semua waktu" },
  { value: "today", label: "Hari ini" },
  { value: "7", label: "7 hari ke depan" },
  { value: "custom", label: "Pilih tanggal" },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const wibFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// ISO UTC (2026-11-10T06:00:00.000000Z) -> "2026-11-10" menurut WIB
export function toWIBDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(
    wibFormat.formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

export const todayWIB = () => toWIBDate(new Date());

export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Bersihkan nilai dari URL / panel: nilai tidak valid jadi kosong,
// dan dari/sampai ditukar kalau terbalik.
export function cleanSchedule({ jadwal = "", dari = "", sampai = "" } = {}) {
  const valid = SCHEDULE_OPTIONS.some((o) => o.value === jadwal) ? jadwal : "";
  if (valid !== "custom") return { jadwal: valid, dari: "", sampai: "" };
  let a = ISO_DATE.test(dari) ? dari : "";
  let b = ISO_DATE.test(sampai) ? sampai : "";
  if (a && b && a > b) [a, b] = [b, a];
  return { jadwal: "custom", dari: a, sampai: b };
}

// "Pilih tanggal" tanpa satu pun tanggal dianggap belum ada filter
export const isScheduleActive = (s) => {
  const c = cleanSchedule(s);
  return c.jadwal === "custom"
    ? Boolean(c.dari || c.sampai)
    : Boolean(c.jadwal);
};

// jadwalMain: nilai ISO dari backend (pengajuan.jadwal_main)
export function matchesSchedule(jadwalMain, schedule) {
  const s = cleanSchedule(schedule);
  if (!isScheduleActive(s)) return true;
  const day = toWIBDate(jadwalMain);
  if (!day) return false;
  const today = todayWIB();
  if (s.jadwal === "today") return day === today;
  if (s.jadwal === "7") return day >= today && day <= addDaysISO(today, 7);
  if (s.dari && day < s.dari) return false;
  if (s.sampai && day > s.sampai) return false;
  return true;
}

const shortDate = (iso) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00Z`));

// Teks untuk chip filter aktif. Kosong = tidak ada chip.
export function scheduleLabel(schedule) {
  const s = cleanSchedule(schedule);
  if (s.jadwal === "today") return "Hari ini";
  if (s.jadwal === "7") return "7 hari ke depan";
  if (s.jadwal !== "custom") return "";
  if (s.dari && s.sampai) {
    return s.dari === s.sampai
      ? shortDate(s.dari)
      : `${shortDate(s.dari)} – ${shortDate(s.sampai)}`;
  }
  if (s.dari) return `Mulai ${shortDate(s.dari)}`;
  if (s.sampai) return `Sampai ${shortDate(s.sampai)}`;
  return "";
}

// ===== Filter jadwal pendaftaran (memakai logika tanggal yang sama) =====

const toSchedule = (c = {}) => ({
  jadwal: c.daftar ?? "",
  dari: c.daftarDari ?? "",
  sampai: c.daftarSampai ?? "",
});

export function cleanRegistration(c = {}) {
  const s = cleanSchedule(toSchedule(c));
  return { daftar: s.jadwal, daftarDari: s.dari, daftarSampai: s.sampai };
}

export const isRegistrationActive = (c) => isScheduleActive(toSchedule(c));

// tanggal: nilai ISO dari backend (pengajuan.jadwal_pendaftaran_tutup)
export const matchesRegistration = (tanggal, c) =>
  matchesSchedule(tanggal, toSchedule(c));

export function registrationLabel(c) {
  const label = scheduleLabel(toSchedule(c));
  return label ? `Daftar: ${label}` : "";
}
