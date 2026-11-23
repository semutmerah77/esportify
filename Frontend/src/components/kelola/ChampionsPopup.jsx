import { useEffect } from "react";
import { ChampionsPodium } from "./ChampionsPodium";
import "../../styles/bracket-final.css";

// Popup "Selamat kepada Para Juara!". Hanya dibuka saat turnamen BARU SAJA selesai.
// subtitle: "Nama Turnamen · Nama Game"
function ChampionsPopup({ champions, subtitle, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="kl-ov"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="kl-dialog fin-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fin-popup-title"
      >
        <small className="fin-popup-kicker">TURNAMEN SELESAI</small>
        <h2 id="fin-popup-title">Selamat kepada Para Juara!</h2>
        {subtitle && <p className="fin-popup-sub">{subtitle}</p>}
        <ChampionsPodium champions={champions} />
        <p className="fin-popup-note">
          Hasil akhir telah ditetapkan dan tidak dapat diubah lagi.
        </p>
        <button
          type="button"
          className="kl-btn kl-bk-primary fin-popup-btn"
          onClick={onClose}
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

export default ChampionsPopup;
