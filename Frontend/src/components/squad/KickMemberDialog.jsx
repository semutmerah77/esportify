import { useEffect } from "react";
import Icon from "../icon";

function initials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  const caps = name.match(/[A-Z]/g);
  if (caps && caps.length >= 2) return caps[0] + caps[1];
  return name.slice(0, 2).toUpperCase();
}

function KickMemberDialog({
  member,
  locked,
  loading,
  error,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !loading && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, onClose]);

  return (
    <div
      className="sq-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div
        className="sq-modal sqd-kick-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sqd-kick-title"
      >
        <span className="sqd-kick-icon">
          <Icon name="user-minus" size={22} />
        </span>
        <h2 id="sqd-kick-title" className="sqd-kick-title">
          Keluarkan Anggota?
        </h2>
        <p className="sqd-kick-text">
          Apakah kamu yakin ingin mengeluarkan anggota ini dari squad?
        </p>

        <div className="sqd-kick-member">
          <span className="sqd-kick-initial">{initials(member.username)}</span>
          <b>{member.username}</b>
          <em>Anggota Squad</em>
        </div>

        <div className="sqd-kick-actions">
          <button
            type="button"
            className="sqd-kick-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Batal
          </button>
          <button
            type="button"
            className={`sqd-kick-confirm ${locked ? "locked" : ""}`}
            onClick={onConfirm}
            disabled={loading || locked}
          >
            {locked && <Icon name="lock" size={14} />}
            {loading ? "Memproses..." : "Keluarkan"}
          </button>
        </div>

        {locked && (
          <div className="sqd-kick-warn" role="alert">
            <Icon name="lock" size={16} />
            <div>
              <b>Roster Lock Aktif</b>
              <p>
                Squad ini telah terdaftar sebagai peserta turnamen aktif.
                Anggota tidak dapat dikeluarkan hingga seluruh rangkaian
                turnamen selesai.
              </p>
            </div>
          </div>
        )}
        {!locked && error && <p className="sq-err">{error}</p>}
      </div>
    </div>
  );
}

export default KickMemberDialog;
