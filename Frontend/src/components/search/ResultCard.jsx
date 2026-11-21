import { useState } from "react";
import Icon from "../icon";
import "../../styles/schedule-extension.css";
import {
  formatDate,
  formatFee,
  formatRupiah,
} from "../../services/tournamentSearchApi";

// onOpen kosong = halaman detail belum ada, tombol dinonaktifkan.
function ResultCard({ item, onOpen }) {
  const [imgFailed, setImgFailed] = useState(false);

  // Slot terisi belum ada di backend (null). Selama itu, tampilkan total slot saja.
  const hasSlotFilled = item.slotFilled != null;
  const full =
    hasSlotFilled && item.slotTotal > 0 && item.slotFilled >= item.slotTotal;
  const percent =
    hasSlotFilled && item.slotTotal > 0
      ? Math.min(100, Math.round((item.slotFilled / item.slotTotal) * 100))
      : 0;

  // CHANGED: baris lokasi selalu tampil supaya semua kartu punya struktur yang sama.
  // Online: teks "Online" (dari frontend). Offline: "Kota, Provinsi".
  const locationText = item.type === "Online" ? "Online" : item.location || "—";

  const statusLabel =
    item.status === "berlangsung"
      ? "Sedang berlangsung"
      : item.registrationOpen === false
        ? "Pendaftaran Ditutup"
        : "";

  return (
    <article className="ct-card">
      <div className="ct-poster">
        {item.poster && !imgFailed ? (
          <img
            src={item.poster}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="ct-poster-img"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="ct-poster-fb">
            <Icon name="trophy" size={64} />
          </div>
        )}
        {item.game && <span className="ct-tag ct-tag-game">{item.game}</span>}
        {item.type && (
          <span
            className={`ct-tag ct-tag-type ${item.type === "Online" ? "online" : ""}`}
          >
            {item.type}
          </span>
        )}
        {statusLabel && (
          <span
            className={`ct-tag ct-tag-status ${item.status === "berlangsung" ? "live" : ""}`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      <div className="ct-meta ct-meta-date">
        <Icon name="calendar" size={16} />
        <span>{formatDate(item.date)}</span>
        {item.extended && (
          <span className="ct-ext-group">
            <i className="ct-dot" aria-hidden="true" />
            <span className="ext-badge ct-ext-inline">Diperpanjang</span>
          </span>
        )}
      </div>

      <h3 className="ct-title">{item.name}</h3>

      {/* CHANGED: selalu tampil, menjorok sejajar teks tanggal */}
      <div className="ct-meta ct-loc">
        <span>{locationText}</span>
      </div>

      {/* CHANGED: selalu tampil. Data kosong ditulis "—", bukan Rp0 atau Gratis */}
      <div className="ct-stats">
        <div>
          <span>Total Hadiah</span>
          <b className={item.prize != null ? "ct-prize" : ""}>
            {item.prize != null ? formatRupiah(item.prize) : "—"}
          </b>
        </div>
        <div className="ct-right">
          <span>Biaya Pendaftaran</span>
          <b>{item.fee != null ? formatFee(item.fee) : "—"}</b>
        </div>
      </div>

      {/* CHANGED: selalu tampil */}
      <div>
        <div className="ct-slot">
          <span>{hasSlotFilled ? "Slot Terisi" : "Total Slot"}</span>
          <b>
            {hasSlotFilled
              ? `${item.slotFilled} / ${item.slotTotal}${full ? " (Penuh)" : ""}`
              : item.slotTotal > 0
                ? item.slotTotal
                : "—"}
          </b>
        </div>
        {hasSlotFilled && (
          <div className="ct-bar" aria-hidden="true">
            <i style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>

      <button
        type="button"
        className="ct-btn ct-btn-s ct-btn-block"
        disabled={!onOpen}
        title={onOpen ? undefined : "Halaman detail belum tersedia"}
        onClick={() => onOpen?.(item)}
      >
        Lihat Detail <Icon name="chevron-right" size={14} />
      </button>
    </article>
  );
}

export default ResultCard;
