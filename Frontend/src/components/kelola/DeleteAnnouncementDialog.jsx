import { useEffect, useState } from "react";
import AnnouncementIcon from "./AnnouncementIcon";
import "../../styles/match-report.css";
import "../../styles/announcement.css";

// Konfirmasi hapus pengumuman (wajib sebelum memanggil endpoint DELETE).
// onConfirm: async () => void (lempar Error kalau gagal)
function DeleteAnnouncementDialog({ title, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message || "Pengumuman gagal dihapus.");
      setBusy(false);
    }
  };

  return (
    <div
      className="rp-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div
        className="rp-dialog rp-decision"
        role="dialog"
        aria-modal="true"
        aria-labelledby="an-delete-title"
      >
        <span className="rp-decision-ic bad">
          <AnnouncementIcon name="trash" size={20} />
        </span>
        <h2 id="an-delete-title">Hapus pengumuman?</h2>
        <p className="rp-decision-text">
          Pengumuman <b className="an-strong">“{title}”</b> akan dihapus dan
          tidak bisa dilihat lagi oleh peserta. Tindakan ini tidak dapat
          dibatalkan.
        </p>
        {error && <p className="rp-err">{error}</p>}
        <div className="rp-actions split">
          <button
            type="button"
            className="rp-btn ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Batal
          </button>
          <button
            type="button"
            className="rp-btn danger"
            disabled={busy}
            onClick={confirm}
          >
            Ya, hapus
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteAnnouncementDialog;
