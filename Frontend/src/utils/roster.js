// Batas jumlah pemain per squad pada pengajuan turnamen.
// Harus sama dengan validasi backend (min:1, max:10).
export const MIN_ROSTER_LIMIT = 1;
export const MAX_ROSTER_LIMIT = 10;

// Teks tampilan, contoh: "5 - 7 pemain" atau "5 pemain" kalau min = maks.
export const rosterLabel = (min, max) => {
  if (!min && !max) return "-";
  if (Number(min) === Number(max)) return `${min} pemain`;
  return `${min} - ${max} pemain`;
};
