import { useEffect, useRef, useState } from "react";
import BracketIcon from "./BracketIcon";
import "../../styles/bracket-final.css";

// Scheduler BE berjalan tiap menit: beri jeda sebelum mengambil hasil akhir
const SETTLE_DELAY_MS = 60 * 1000;

const mmss = (sec) =>
  `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

// Banner "Masa Koreksi Hasil Final" dengan hitung mundur lokal (tanpa polling).
// seconds  : sisa_detik dari BE saat data diterima
// onExpired: dipanggil SEKALI, ±1 menit setelah hitungan habis, untuk mengambil hasil akhir
// Pasang dengan key={berakhir_pada} supaya hitungan mulai ulang kalau ada koreksi baru.
function CorrectionBanner({ seconds, onExpired }) {
  const deadline = useRef(Date.now() + seconds * 1000);
  const [left, setLeft] = useState(seconds);
  const expiredRef = useRef(onExpired);
  expiredRef.current = onExpired;
  const running = left > 0;

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(
      () =>
        setLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (running) return undefined;
    const timer = setTimeout(() => expiredRef.current?.(), SETTLE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [running]);

  return (
    <section className="fin-correction" role="status">
      <span className="fin-correction-ic">
        <BracketIcon name="clock" size={18} />
      </span>
      <div className="fin-correction-main">
        <b>Masa Koreksi Hasil Final</b>
        {running ? (
          <p>
            Skor final sudah diisi. Juara akan ditetapkan otomatis dalam{" "}
            <strong>{mmss(left)}</strong>. Jika ada hasil yang tidak sesuai,
            kirim sanggahan sebelum waktu habis.
          </p>
        ) : (
          <p>Waktu koreksi habis. Juara segera ditetapkan.</p>
        )}
      </div>
      <div className="fin-correction-time">
        <b>{mmss(left)}</b>
        <small>MENIT TERSISA</small>
      </div>
    </section>
  );
}

export default CorrectionBanner;
