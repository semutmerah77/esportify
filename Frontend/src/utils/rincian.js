export const MIN_RINCIAN = 2;
export const MAX_RINCIAN = 20;

let seq = 0;
export const newRincian = (d = {}) => ({
  key: ++seq,
  peruntukanDana: d.peruntukanDana ?? "",
  keterangan: d.keterangan ?? "",
  nominal: d.nominal ?? "",
});

export const newRincianRows = () =>
  Array.from({ length: MIN_RINCIAN }, () => newRincian());

const PLACEHOLDERS = [
  {
    peruntukanDana: "Contoh: Hadiah pemenang",
    keterangan: "Contoh: Juara 1 Rp500.000, Juara 2 Rp300.000",
  },
  {
    peruntukanDana: "Contoh: Sewa tempat / server",
    keterangan: "Contoh: Sewa venue 1 hari",
  },
];

export const rincianPlaceholder = (i) =>
  PLACEHOLDERS[i] ?? {
    peruntukanDana: "Nama pengeluaran",
    keterangan: "Penjelasan singkat (opsional)",
  };
