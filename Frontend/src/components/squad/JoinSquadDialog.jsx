import { useEffect } from "react";

// Konfirmasi sebelum mengirim permintaan bergabung (POST /squad/:id/permintaan)
function JoinSquadDialog({ name, loading, error, onConfirm, onClose }) {
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
        className="sq-modal sqd-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sqd-join-title"
      >
        <h2 id="sqd-join-title" className="sqd-confirm-title">
          Mengirim permintaan bergabung?
        </h2>
        <p className="sqd-confirm-text">
          Permintaan bergabung ke <b>{name}</b> akan dikirim ke Leader. Kamu
          menjadi anggota setelah Leader menerimanya.
        </p>
        {error && <p className="sq-err">{error}</p>}
        <div className="sq-modal-actions">
          <button
            type="button"
            className="sq-btn ghost"
            onClick={onClose}
            disabled={loading}
          >
            Batal
          </button>
          <button
            type="button"
            className="sq-btn primary"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Mengirim..." : "Kirim Permintaan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinSquadDialog;
