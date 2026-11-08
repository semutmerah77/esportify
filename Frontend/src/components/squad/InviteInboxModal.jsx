import { useEffect, useState } from "react";
import Icon from "../icon";
import SquadLogo from "./SquadLogo";
import { respondInvitation } from "../../services/squadApi";

// Inbox undangan squad: Terima atau Tolak.
function InviteInboxModal({ invites, onClose, onChange, onAccepted }) {
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busyId && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busyId, onClose]);

  const answer = async (invite, accept) => {
    setBusyId(invite.id);
    setMessage({ text: "", type: "" });
    try {
      const res = await respondInvitation(invite.id, accept);
      onChange((list) => list.filter((i) => i.id !== invite.id));
      if (accept) onAccepted(res.squad, res.message);
      else
        setMessage({
          text: res.message || `Undangan dari ${invite.squad.name} ditolak.`,
          type: "",
        });
    } catch (err) {
      if (err.removed)
        onChange((list) => list.filter((i) => i.id !== invite.id));
      setMessage({
        text: err.message || "Gagal memproses undangan.",
        type: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="sq-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !busyId && onClose()}
    >
      <div
        className="sq-modal sqi-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sqi-title"
      >
        <header className="sqi-head">
          <span className="sqi-head-ic">
            <Icon name="mail" size={18} />
          </span>
          <h2 id="sqi-title">Inbox Undangan Squad</h2>
          <button
            type="button"
            className="sqi-close"
            aria-label="Tutup"
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="sqi-body">
          {invites.length === 0 && (
            <p className="sqi-empty">Belum ada undangan squad.</p>
          )}

          {invites.map((invite) => (
            <article key={invite.id} className="sqi-item">
              <SquadLogo squad={invite.squad} size={48} />
              <div className="sqi-info">
                <h3>
                  {invite.squad.name} <span>#{invite.squad.id}</span>
                </h3>
                <p>
                  Diundang oleh <b>{invite.invitedBy}</b>
                </p>
                <small>
                  <Icon name="users" size={12} /> {invite.squad.members}/
                  {invite.squad.capacity} Anggota
                </small>
              </div>
              <div className="sqi-actions">
                <button
                  type="button"
                  className="sqi-btn reject"
                  disabled={busyId === invite.id}
                  onClick={() => answer(invite, false)}
                >
                  Tolak
                </button>
                <button
                  type="button"
                  className="sqi-btn accept"
                  disabled={busyId === invite.id}
                  onClick={() => answer(invite, true)}
                >
                  Terima
                </button>
              </div>
            </article>
          ))}
        </div>

        <footer className="sqi-foot">
          {message.text && (
            <p className={message.type === "error" ? "error" : ""}>
              {message.text}
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}

export default InviteInboxModal;
