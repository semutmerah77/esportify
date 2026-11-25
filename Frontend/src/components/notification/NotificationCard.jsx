import Icon from "../icon";

const TZ = "Asia/Jakarta";

const dayKey = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const clock = (d) =>
  d
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TZ,
    })
    .replace(":", ".");

// "2 menit lalu" / "1 jam lalu" / "Kemarin, 19.00" / "22 Nov 2026" (hanya tampilan; pengelompokan dari BE)
export function timeText(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const minutes = (now.getTime() - d.getTime()) / 60000;
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${Math.floor(minutes)} menit lalu`;
  if (dayKey(d) === dayKey(now)) return `${Math.floor(minutes / 60)} jam lalu`;
  const yesterday = new Date(now.getTime() - 86400000);
  if (dayKey(d) === dayKey(yesterday)) return `Kemarin, ${clock(d)}`;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}

const RESPONSE_LABEL = {
  diterima: { text: "Diterima", tone: "ok" },
  ditolak: { text: "Ditolak", tone: "no" },
};

function NotificationCard({ item, busy, onOpen }) {
  const label = RESPONSE_LABEL[item.response];
  const meta = [item.sender?.role, item.related?.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      className={`nt-card ${item.read ? "read" : "unread"}`}
      onClick={() => onOpen(item)}
      disabled={busy}
    >
      {!item.read && <span className="nt-dot" aria-label="Belum dibaca" />}
      <span className="nt-main">
        <span className="nt-title">
          <b>{item.title}</b>
          {label && <i className={`nt-pill ${label.tone}`}>{label.text}</i>}
        </span>
        {meta && <span className="nt-meta">{meta}</span>}
        <span className="nt-msg">{item.message}</span>
      </span>
      <span className="nt-time">{timeText(item.createdAt)}</span>
      <Icon name="chevron-right" size={14} />
    </button>
  );
}

export default NotificationCard;
