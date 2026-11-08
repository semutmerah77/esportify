import { useEffect } from "react";
import Icon from "../icon";

// Popup untuk aksi yang berhasil. Pesan diambil dari backend apa adanya.
function SuccessDialog({ message, onClose }) {
  useEffect(() => {
    const onKey = (e) => (e.key === "Escape" || e.key === "Enter") && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="sq-ov sqs-ov"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="sq-modal sqs-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sqs-title"
      >
        <span className="sqs-icon">
          <Icon name="check" size={26} />
        </span>
        <h2 id="sqs-title" className="sqs-title">
          Berhasil
        </h2>
        <p className="sqs-text">{message}</p>
        <button
          type="button"
          className="sq-btn primary sqs-btn"
          onClick={onClose}
          autoFocus
        >
          OK
        </button>
      </div>
    </div>
  );
}

export default SuccessDialog;
