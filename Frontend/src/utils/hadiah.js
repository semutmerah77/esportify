export const MAX_HADIAH = 20;

let seq = 0;
export const newHadiah = (d = {}) => ({
  key: ++seq,
  nama_hadiah: d.nama_hadiah ?? "",
  keterangan: d.keterangan ?? "",
});
