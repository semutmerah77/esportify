import { useEffect } from "react";
import Icon from "../icon";
import initials from "./initials";

const joinedText = (value) => {
  // BE: "YYYY-MM-DD HH:mm:ss" -> format ISO agar terbaca di semua browser
  const d = new Date(String(value ?? "").replace(" ", "T"));
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

// Profil singkat anggota. Aksi menyesuaikan peran yang melihat:
// semua anggota : Kirim Permintaan Teman (belum ada API pertemanan -> nonaktif)
// leader        : + Tetapkan Sebagai Leader, Keluarkan dari Squad
// Keluarkan nonaktif bila anggota ada di roster turnamen (roster lock per pemain).
function MemberProfileModal({ member, canManage, onClose, onPromote, onKick }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tournaments = (member.rosterTournaments ?? [])
    .map((t) => t.name)
    .join(", ");
  const kickLocked = member.rosterLocked === true;

  return (
    <div
      className="sq-ov"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="sqm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sqm-title"
      >
        <div className="sqm-head">
          <span className="sqm-avatar">
            {initials(member.username)}
            {member.avatar && (
              <img
                src={member.avatar}
                alt=""
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
          </span>
          <h2 id="sqm-title">{member.username}</h2>
          <button
            type="button"
            className="sqm-close"
            aria-label="Tutup"
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="sqm-info">
          <div>
            <small>SEBAGAI</small>
            <b>{member.role === "leader" ? "Leader" : "Anggota Squad"}</b>
          </div>
          <div>
            <small>BERGABUNG SEJAK</small>
            <b>{joinedText(member.joinedAt)}</b>
          </div>
        </div>

        <div className="sqm-actions">
          <button
            type="button"
            className="sqm-action"
            disabled
            title="Fitur pertemanan belum tersedia"
          >
            <span className="sqm-ic blue">
              <Icon name="user-plus" size={14} />
            </span>
            Kirim Permintaan Teman
          </button>

          {canManage && member.role !== "leader" && (
            <>
              <button
                type="button"
                className="sqm-action"
                onClick={() => onPromote(member)}
              >
                <span className="sqm-ic gold">
                  <Icon name="crown" size={14} />
                </span>
                Tetapkan Sebagai Leader
              </button>
              <button
                type="button"
                className="sqm-action danger"
                disabled={kickLocked}
                onClick={() => onKick(member)}
              >
                <span className="sqm-ic red">
                  <Icon name={kickLocked ? "lock" : "user-minus"} size={14} />
                </span>
                Keluarkan dari Squad
              </button>
              {kickLocked && (
                <p className="sqm-lock-note">
                  <Icon name="lock" size={13} />
                  <span>
                    {member.username} masih terdaftar di roster turnamen
                    {tournaments ? ` ${tournaments}` : ""} dan baru bisa
                    dikeluarkan setelah turnamen selesai.
                  </span>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MemberProfileModal;
