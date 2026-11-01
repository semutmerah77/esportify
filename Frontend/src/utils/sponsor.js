export const MAX_SPONSOR = 20;

let seq = 0;
// key hanya untuk React (tidak dikirim ke backend)
export const newSponsor = (d = {}) => ({
  key: ++seq,
  nama_sponsor: d.nama_sponsor ?? "",
  kontak_sponsor: d.kontak_sponsor ?? "",
});
