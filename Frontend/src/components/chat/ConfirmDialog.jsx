import { useEffect } from "react";

// Popup konfirmasi (Blokir / Hapus Percakapan / Bersihkan Pesan)
function ConfirmDialog({
  title,
  description,
  confirmLabel,
  icon,
  busy,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="ch-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div className="ch-confirm" role="dialog" aria-modal="true">
        <h3>{title}</h3>
        <p>{description}</p>
        <button
          type="button"
          className="ch-confirm-danger"
          onClick={onConfirm}
          disabled={busy}
        >
          {icon} {confirmLabel}
        </button>
        <button
          type="button"
          className="ch-confirm-cancel"
          onClick={onCancel}
          disabled={busy}
        >
          Batal
        </button>
      </div>
    </div>
  );
}

export default ConfirmDialog;
