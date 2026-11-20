import { useEffect, useState } from "react";
import CancellationIcon from "../kelola/CancellationIcon";
import {
  REJECTION_OTHER_MAX,
  REJECTION_REASONS,
} from "../../services/adminCancellationApi";
import { cancellationFieldErrors } from "../../services/tournamentCancellationApi";
import "../../styles/match-report.css";
import "../../styles/tournament-cancellation.css";

// Dialog tolak pengajuan pembatalan. onConfirm({ reason, otherText }) mengembalikan promise;
// error 422 ditampilkan di bawah field / di dalam dialog.
function RejectCancellationDialog({ onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [otherText, setOtherText] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !sending && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const other = reason === "lainnya";
  const canSend =
    Boolean(reason) && (!other || otherText.trim().length > 0) && !sending;

  const submit = async () => {
    setSending(true);
    setError("");
    setFieldError("");
    try {
      await onConfirm({ reason, otherText });
    } catch (err) {
      const fields = cancellationFieldErrors(err);
      if (fields?.alasan_lainnya || fields?.alasan)
        setFieldError(fields.alasan_lainnya || fields.alasan);
      else setError(err.message || "Pengajuan gagal ditolak.");
      setSending(false);
    }
  };

  return (
    <div
      className="rp-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !sending && onClose()}
    >
      <div
        className="rp-dialog cancel-reject"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-reject-title"
      >
        <div className="cancel-reject-head">
          <span className="cancel-reject-ic">
            <CancellationIcon name="warn" size={22} />
          </span>
          <div>
            <h2 id="cancel-reject-title">Tolak Pengajuan Pembatalan</h2>
            <p>
              Pilih alasan penolakan. Keterangan ini akan langsung dikirimkan ke
              dashboard penyelenggara turnamen sebagai Catatan Admin.
            </p>
        </div>
        </div>

        <p className="cancel-reject-label">ALASAN PENOLAKAN</p>
        <div
          className="cancel-reject-list"
          role="radiogroup"
          aria-label="Alasan penolakan"
        >
          {REJECTION_REASONS.map((r) => (
            <label
              key={r.code}
              className={`cancel-reject-opt ${reason === r.code ? "on" : ""}`}
            >
              <input
                type="radio"
                name="alasan-penolakan"
                checked={reason === r.code}
                onChange={() => setReason(r.code)}
              />
              <i />
              <span>{r.label}</span>
            </label>
          ))}
        </div>

        {other && (
          <div className="cancel-textwrap">
            <textarea
              className={`cancel-textarea ${fieldError ? "err" : ""}`}
              placeholder="Tulis alasan penolakan..."
              maxLength={REJECTION_OTHER_MAX}
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              autoFocus
            />
            <span className="cancel-count">
              {otherText.length}/{REJECTION_OTHER_MAX}
            </span>
          </div>
        )}
        {fieldError && <p className="cancel-err">{fieldError}</p>}

        <div className="cancel-reject-note">
          <CancellationIcon name="info" size={16} />
          <span>
            Status turnamen akan tetap berjalan dan penyelenggara akan menerima
            pemberitahuan penolakan ini.
          </span>
        </div>
        {error && <p className="rp-err">{error}</p>}

        <div className="cancel-reject-actions">
          <button
            type="button"
            className="cancel-btn ghost"
            disabled={sending}
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            className="cancel-btn danger"
            disabled={!canSend}
            onClick={submit}
          >
            {sending ? "Memproses..." : "Konfirmasi Tolak Pengajuan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RejectCancellationDialog;
