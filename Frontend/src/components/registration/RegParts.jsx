import initials from "../squad/initials";
import { STATUS } from "../../services/tournamentRegApi";

const TONES = ["#4338ca", "#6d28d9", "#0f766e", "#334155", "#3730a3"];

export function Avatar({ name = "", src, size = 40 }) {
  const tone =
    TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
  return src ? (
    <img
      className="tr-avatar"
      src={src}
      alt=""
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="tr-avatar"
      style={{
        width: size,
        height: size,
        background: tone,
        fontSize: size * 0.4,
      }}
    >
      {initials(name).slice(0, 1)}
    </span>
  );
}

export function StatusPill({ status, full = false }) {
  const s = STATUS[status] ?? STATUS.menunggu;
  return (
    <span className={`tr-pill ${s.tone}`}>
      <i /> {full ? s.full : s.label}
    </span>
  );
}

export function MemberGrid({ members, meName }) {
  return (
    <div className="tr-members">
      {members.map((m) => (
        <div key={m.id ?? m.username} className="tr-member">
          <Avatar name={m.username} src={m.avatar} />
          <b>{m.username}</b>
          {meName && m.username === meName && <span>(Anda)</span>}
        </div>
      ))}
    </div>
  );
}
