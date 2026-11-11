import { useEffect, useState } from "react";
import Icon from "../icon";
import {
  acceptJoinRequest,
  getJoinRequests,
  isRosterLocked,
  rejectJoinRequest,
} from "../../services/squadApi";
import RosterLockNotice from "./RosterLockNotice";

// Daftar permintaan bergabung (khusus Leader): Terima atau Tolak.
function JoinRequestsModal({ squad, locked = false, onClose, onChanged }) {
  const apiId = squad.squadId ?? squad.id;
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [lockedNow, setLockedNow] = useState(false);
  const isLocked = locked || lockedNow;

  useEffect(() => {
    let off = false;
    getJoinRequests(apiId)
      .then((res) => {
        if (off) return;
        setItems(res.items);
        setReady(true);
      })
      .catch((err) => {
        if (off) return;
        setLoadError(err.message || "Gagal memuat permintaan bergabung.");
        setReady(true);
      });
    return () => {
      off = true;
    };
  }, [apiId]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busyId && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busyId, onClose]);

  const answer = async (req, accept) => {
    setBusyId(req.id);
    setMessage({ text: "", type: "" });
    try {
      const res = await (accept ? acceptJoinRequest : rejectJoinRequest)(
        apiId,
        req.id,
      );
      setItems((list) => list.filter((r) => r.id !== req.id));
      // Diterima: sebut username player. Ditolak: tetap pesan dari BE.
      setMessage({
        text: accept
          ? `${req.username} berhasil menjadi anggota squad.`
          : res.message,
        type: "",
      });
      onChanged(); // muat ulang detail squad (jumlah anggota & badge permintaan)
    } catch (err) {
      // 404 = sudah diproses: kartunya dihapus dari daftar
      if (isRosterLocked(err)) setLockedNow(true);
      if (err.status === 404)
        setItems((list) => list.filter((r) => r.id !== req.id));
      setMessage({
        text: err.message || "Gagal memproses permintaan.",
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
        className="sq-modal sqr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sqr-title"
      >
        <div className="sqr-head">
          <h2 id="sqr-title">Permintaan Bergabung</h2>
          <button
            type="button"
            className="sqr-close"
            aria-label="Tutup"
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {loadError && <p className="sq-err">{loadError}</p>}
        {ready && !loadError && items.length === 0 && !message.text && (
          <p className="sqr-empty">Belum ada permintaan bergabung.</p>
        )}

        <ul className="sqr-list">
          {items.map((req) => (
            <li key={req.id} className="sqr-item">
              <span className="sqr-avatar">
                <Icon name="user" size={20} />
                {req.avatar && (
                  <img
                    src={req.avatar}
                    alt=""
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}
              </span>
              <b>{req.username}</b>
              <div className="sqr-actions">
                <button
                  type="button"
                  className="sqr-btn reject"
                  disabled={busyId === req.id}
                  onClick={() => answer(req, false)}
                >
                  Tolak
                </button>
                <button
                  type="button"
                  className="sqr-btn accept"
                  disabled={busyId === req.id || squad.full || isLocked}
                  title={squad.full ? "Squad sudah penuh" : undefined}
                  onClick={() => answer(req, true)}
                >
                  Terima
                </button>
              </div>
            </li>
          ))}
        </ul>
        {isLocked && <RosterLockNotice />}

        {message.text && (
          <p
            className={`sqr-msg ${message.type === "error" ? "error" : ""} ${items.length === 0 ? "center" : ""}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

export default JoinRequestsModal;
