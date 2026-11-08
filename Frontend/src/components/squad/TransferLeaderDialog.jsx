import { useEffect } from "react";
import Icon from "../icon";
import initials from "./initials";

// Konfirmasi pengalihan kepemimpinan (POST /squad/:id/leader)
function TransferLeaderDialog({ member, loading, error, onConfirm, onClose }) {
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
        aria-labelledby="sqd-promote-title"
      >
        <span className="sqd-kick-icon gold">
          <Icon name="crown" size={22} />
        </span>
        <h2 id="sqd-promote-title" className="sqd-kick-title">
          Jadikan Leader?
        </h2>
        <p className="sqd-kick-text">
          Apakah kamu yakin ingin menjadikan anggota ini Leader? Kamu akan
          menjadi anggota biasa di squad ini.
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
            className="sqd-kick-confirm blue"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Memproses..." : "Jadikan Leader"}
          </button>
        </div>

        {error && <p className="sq-err">{error}</p>}
      </div>
    </div>
  );
}

export default TransferLeaderDialog;
