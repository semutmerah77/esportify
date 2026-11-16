import { useEffect, useState } from "react";
import { approveReport, getReportDetail } from "../../services/matchReportApi";
import ReportIcon from "./ReportIcon";
import "../../styles/match-report.css";

// Popup "Setujui laporan {squad}?" (PB-16).
// group: { match, reports } | report: laporan yang akan disetujui
// onApproved: dipanggil setelah berhasil (muat ulang inbox + bracket)
function ApproveReportDialog({
  tournamentId,
  group,
  report,
  onClose,
  onApproved,
}) {
  const { match } = group;
  const [detail, setDetail] = useState(null); // { canApprove, cannotApproveReason }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  // Detail laporan menentukan apakah tombol Setujui boleh aktif (bisa_disetujui)
  useEffect(() => {
    let off = false;
    getReportDetail(tournamentId, report.id)
      .then((d) => !off && setDetail(d))
      .catch(
        (err) =>
          !off &&
          setDetail({
            canApprove: false,
            cannotApproveReason: err.message || "Detail laporan gagal dimuat.",
          }),
      );
    return () => {
      off = true;
    };
  }, [tournamentId, report.id]);

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

  // Laporan squad lawan yang masih menunggu: skor sama ikut disetujui, skor beda ditolak otomatis
  const others = group.reports.filter(
    (r) => r.id !== report.id && r.status === "menunggu",
  );
  const differing = others.filter(
    (r) => r.scoreA !== report.scoreA || r.scoreB !== report.scoreB,
  );
  const same = others.filter(
    (r) => r.scoreA === report.scoreA && r.scoreB === report.scoreB,
  );

  const winnerA = report.scoreA > report.scoreB;
  const reporterName = report.squad?.name ?? "";

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await approveReport(tournamentId, report.id);
      setDone({ text: res.message });
      onApproved();
    } catch (err) {
      setError(err.message || "Laporan gagal disetujui.");
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="rp-ov rp-ov-top">
        <div className="rp-dialog rp-done" role="status">
          <span className="rp-done-ic">
            <ReportIcon name="check" size={24} />
          </span>
          <b>Laporan disetujui</b>
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
        aria-labelledby="rp-approve-title"
      >
        <span className="rp-decision-ic ok">
          <ReportIcon name="check" size={20} />
        </span>
        <h2 id="rp-approve-title">Setujui laporan {reporterName}?</h2>
        <p className="rp-decision-text">
          Hasil Pertandingan #{match.number} akan ditetapkan dan bracket akan
          diperbarui.
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

        {differing.map((r) => (
          <div className="rp-note warn" key={r.id}>
            <ReportIcon name="warn" size={15} />
            <span>
              Laporan {r.squad?.name ?? "squad lawan"} memiliki skor berbeda dan
              akan ditolak otomatis.
            </span>
          </div>
        ))}
        {same.map((r) => (
          <div className="rp-note info" key={r.id}>
            <ReportIcon name="check" size={15} />
            <span>
              Laporan {r.squad?.name ?? "squad lawan"} memiliki skor yang sama
              dan ikut disetujui.
            </span>
          </div>
        ))}

        {detail && !detail.canApprove && (
          <div className="rp-note bad">
            <ReportIcon name="alert" size={15} />
            <span>
              {detail.cannotApproveReason ||
                "Laporan ini belum dapat disetujui."}
            </span>
          </div>
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
            className="rp-btn success"
            disabled={busy || !detail || !detail.canApprove}
            onClick={confirm}
          >
            Ya, setujui
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApproveReportDialog;
