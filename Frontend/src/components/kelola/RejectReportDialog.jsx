import { useEffect, useState } from "react";
import { rejectReport } from "../../services/matchReportApi";
import ReportIcon from "./ReportIcon";
import "../../styles/match-report.css";

// Dipakai kalau BE belum mengirim meta.pilihan_alasan_penolakan
const FALLBACK_OPTIONS = [
  { code: "bukti_tidak_jelas", label: "Bukti tidak jelas" },
  { code: "skor_tidak_sesuai", label: "Skor tidak sesuai bukti" },
  {
    code: "bukan_bukti_pertandingan",
    label: "Bukti bukan dari pertandingan ini",
  },
  { code: "bukti_tidak_valid", label: "Bukti tidak valid" },
  { code: "lainnya", label: "Lainnya" },
];

// Popup "Tolak laporan {squad}?" (PB-16).
// options: pilihan alasan dari meta inbox | onRejected: muat ulang inbox + bracket
function RejectReportDialog({
  tournamentId,
  group,
  report,
  options,
  onClose,
  onRejected,
}) {
  const { match } = group;
  const list = options.length ? options : FALLBACK_OPTIONS;
  const [reason, setReason] = useState(list[0].code);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && !done && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, done, onClose]);

  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(onClose, 2400);
    return () => clearTimeout(t);
  }, [done, onClose]);

  const reporterName = report.squad?.name ?? "";
  const winnerA = report.scoreA > report.scoreB;

  const confirm = async () => {
    if (reason === "lainnya" && !other.trim())
      return setError("Tuliskan alasan penolakan.");
    setBusy(true);
    setError("");
    try {
      const res = await rejectReport(tournamentId, report.id, {
        reason,
        otherReason: other,
      });
      setDone({ text: res.message });
      onRejected();
    } catch (err) {
      setError(err.message || "Laporan gagal ditolak.");
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="rp-ov rp-ov-top">
        <div className="rp-dialog rp-done" role="status">
          <span className="rp-done-ic bad">
            <ReportIcon name="x" size={24} />
          </span>
          <b>Laporan ditolak</b>
          <p>{done.text}</p>
        </div>
      </div>
    );

  return (
    <div
      className="rp-ov rp-ov-top"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        className="rp-dialog rp-decision"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rp-reject-title"
      >
        <span className="rp-decision-ic bad">
          <ReportIcon name="x" size={20} />
        </span>
        <h2 id="rp-reject-title">Tolak laporan {reporterName}?</h2>
        <p className="rp-decision-text">
          Hasil Pertandingan #{match.number} tidak akan diperbarui.{" "}
          {reporterName} dapat mengirim ulang laporan.
        </p>

        <div className="rp-result">
          <span>
            {match.a.name}
            {winnerA && <em className="rp-win">Menang</em>}
          </span>
          <b>
            {report.scoreA} – {report.scoreB}
          </b>
          <span>
            {match.b.name}
            {!winnerA && <em className="rp-win">Menang</em>}
          </span>
        </div>

        <p className="rp-label left">
          Alasan penolakan <span className="rp-req">*</span>
        </p>
        <div
          className="rp-chips"
          role="radiogroup"
          aria-label="Alasan penolakan"
        >
          {list.map((o) => (
            <button
              key={o.code}
              type="button"
              role="radio"
              aria-checked={reason === o.code}
              className={`rp-chip ${reason === o.code ? "on" : ""}`}
              disabled={busy}
              onClick={() => {
                setReason(o.code);
                setError("");
              }}
            >
              {reason === o.code && <ReportIcon name="check" size={13} />}
              {o.label}
            </button>
          ))}
        </div>

        {reason === "lainnya" && (
          <textarea
            className="rp-textarea"
            rows={3}
            maxLength={500}
            placeholder="Tuliskan alasan penolakan..."
            value={other}
            disabled={busy}
            onChange={(e) => setOther(e.target.value)}
          />
        )}
        {error && <p className="rp-err">{error}</p>}

        <div className="rp-actions split">
          <button
            type="button"
            className="rp-btn ghost"
            disabled={busy}
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            className="rp-btn danger"
            disabled={busy}
            onClick={confirm}
          >
            Tolak laporan
          </button>
        </div>
      </div>
    </div>
  );
}

export default RejectReportDialog;
