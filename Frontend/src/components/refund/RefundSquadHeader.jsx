import RefundIcon from "./RefundIcon";
import "../../styles/refund.css";

const AVATAR_COLORS = [
  "#f59e0b",
  "#ea580c",
  "#2563eb",
  "#e11d48",
  "#9333ea",
  "#0d9488",
  "#4f46e5",
];

export const refundInitials = (name) =>
  String(name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase() || "?";

export const refundAvatarColor = (seed) =>
  AVATAR_COLORS[Math.abs(Number(seed) || 0) % AVATAR_COLORS.length];

const STATUS_TONE = {
  menunggu_data: "amber",
  menunggu_transfer: "blue",
  selesai: "green",
};
const STATUS_TEXT = {
  menunggu_data: "Menunggu Data",
  menunggu_transfer: "Menunggu Transfer",
  selesai: "Selesai",
};

export function RefundStatusPill({ status, label }) {
  return (
    <span className={`refund-pill ${STATUS_TONE[status] ?? "amber"}`}>
      <i /> {label || STATUS_TEXT[status] || status}
    </span>
  );
}

export function RefundAvatar({ name, seed, size = 44 }) {
  return (
    <span
      className="refund-avatar"
      style={{
        width: size,
        height: size,
        background: refundAvatarColor(seed),
        fontSize: size * 0.34,
      }}
    >
      {refundInitials(name)}
    </span>
  );
}

// Kartu atas tab Pengembalian Dana (peserta): squad, pendaftar, status, dan satu baris catatan.
function RefundSquadHeader({
  squadName,
  squadId,
  registrant,
  status,
  statusLabel,
  note,
}) {
  return (
    <section className="refund-card refund-squad">
      <div className="refund-squad-top">
        <RefundAvatar name={squadName} seed={squadId} />
        <div className="refund-squad-main">
          <b>{squadName}</b>
          <small>
            {squadId != null && (
              <>
                ID: {squadId} <i className="refund-dot" />{" "}
              </>
            )}
            Pendaftar: <span>{registrant}</span>
          </small>
        </div>
        <RefundStatusPill status={status} label={statusLabel} />
      </div>
      {note && (
        <p className="refund-squad-note">
          <RefundIcon name="info" size={14} /> {note}
        </p>
      )}
    </section>
  );
}

export default RefundSquadHeader;
