import { useState } from "react";

const COLORS = [
  ["#f59e0b", "#d97706"],
  ["#f97316", "#ea580c"],
  ["#0ea5e9", "#2563eb"],
  ["#f43f5e", "#e11d48"],
  ["#8b5cf6", "#6d28d9"],
  ["#10b981", "#059669"],
];

export const initialsOf = (name) => {
  const parts = String(name ?? "")
    .trim()
    .split(/[\s_]+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  const a = parts[0][0] ?? "";
  const b = parts.length > 1 ? parts[1][0] : (parts[0][1] ?? "");
  return (a + b).toUpperCase();
};

const colorFor = (seed) => {
  let h = 0;
  for (const ch of String(seed ?? "")) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
};

export function KlAvatar({ name, src, size = 40, seed }) {
  const [broken, setBroken] = useState(false);
  const [from, to] = colorFor(seed ?? name);
  return (
    <span
      className="kl-avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
    >
      {initialsOf(name)}
      {src && !broken && (
        <img src={src} alt="" onError={() => setBroken(true)} />
      )}
    </span>
  );
}

export function RegistrantRow({ item, repLabel = "Pendaftar", onReview }) {
  return (
    <li className="kl-row">
      <KlAvatar
        name={item.squad.name}
        src={item.squad.logo}
        seed={item.squad.code || item.squad.name}
      />
      <div className="kl-row-main">
        <b>{item.squad.name}</b>
        <small>
          {item.memberCount} Anggota
          {item.squad.code ? ` • ID: ${item.squad.code}` : ""}
        </small>
      </div>
      <span className="kl-row-rep">
        {repLabel}: {item.rep.username}
      </span>
      {onReview ? (
        <button
          type="button"
          className="kl-review-btn"
          onClick={() => onReview(item)}
        >
          Tinjau
        </button>
      ) : (
        <span className="kl-row-spacer" />
      )}
    </li>
  );
}

// Pratinjau bukti (gambar / PDF) di modal, memakai gaya .t-preview yang sudah ada.
export function ProofPreview({ file, name, onClose }) {
  const isPdf = file.type === "application/pdf";
  return (
    <div
      className="t-preview-backdrop kl-preview-top"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="t-preview" role="dialog" aria-modal="true">
        <div className="t-preview-head">
          <span>{name}</span>
          <button type="button" aria-label="Tutup" onClick={onClose}>
            ✕
          </button>
        </div>
        {isPdf ? (
          <iframe className="t-preview-pdf" src={file.url} title={name} />
        ) : (
          <img src={file.url} alt={name} />
        )}
      </div>
    </div>
  );
}
