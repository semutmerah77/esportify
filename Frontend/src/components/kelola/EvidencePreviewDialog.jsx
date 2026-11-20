import { useEffect } from "react";
import CancellationIcon from "./CancellationIcon";
import "../../styles/match-report.css";
import "../../styles/tournament-cancellation.css";

// Popup pratinjau bukti (gambar / PDF). url = object URL yang dibuat dan di-revoke oleh pemanggil.
function EvidencePreviewDialog({ name, kind, url, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="rp-ov"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="rp-dialog cancel-preview"
        role="dialog"
        aria-modal="true"
        aria-label={`Pratinjau ${name}`}
      >
        <div className="cancel-preview-head">
          <b title={name}>{name}</b>
          <button
            type="button"
            className="rp-x"
            aria-label="Tutup"
            onClick={onClose}
          >
            <CancellationIcon name="x" size={18} />
          </button>
        </div>
        <div className="cancel-preview-body">
          {kind === "pdf" ? (
            <iframe src={url} title={name} />
          ) : (
            <img src={url} alt={name} />
          )}
        </div>
      </div>
    </div>
  );
}

export default EvidencePreviewDialog;
