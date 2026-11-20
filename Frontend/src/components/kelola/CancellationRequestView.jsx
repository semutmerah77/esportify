import CancellationIcon from "./CancellationIcon";
import CancellationEvidenceList from "./CancellationEvidenceList";
import {
  formatLongDate,
  formatShortDate,
} from "../../services/tournamentCancellationApi";
import "../../styles/tournament-cancellation.css";

const STATUS_PILL = {
  menunggu: { text: "Pembatalan Diajukan", tone: "purple" },
  ditolak: { text: "Ditolak", tone: "red" },
  disetujui: { text: "Dibatalkan", tone: "danger" },
};

export function CancellationStatusPill({ status }) {
  const pill = STATUS_PILL[status];
  if (!pill) return null;
  return (
    <span className={`cancel-pill ${pill.tone}`}>
      <i /> {pill.text}
    </span>
  );
}

// Isi pengajuan (alasan, penjelasan, bukti, rencana pengembalian dana). Dipakai penyelenggara dan admin.
export function CancellationContent({ request, feeType }) {
  return (
    <section className="cancel-card">
      <h2 className="cancel-h2">Isi pengajuan</h2>

      <h3 className="cancel-key">Alasan pembatalan</h3>
      <span className="cancel-chip">{request.reasonLabel}</span>

      <h3 className="cancel-key">Penjelasan detail</h3>
      <p className="cancel-text">{request.explanation}</p>

      {request.evidence.length > 0 && (
        <>
          <h3 className="cancel-key">Bukti pendukung</h3>
          <CancellationEvidenceList items={request.evidence} />
        </>
      )}

      {feeType === "berbayar" && request.refundPlanDate && (
        <div className="cancel-refund-view">
          <h3>
            <CancellationIcon name="wallet" size={18} /> Pengembalian dana
            peserta
          </h3>
          <small>Estimasi tanggal pengembalian dana</small>
          <b>{formatLongDate(request.refundPlanDate)}</b>
        </div>
      )}
    </section>
  );
}

// Status + isi pengajuan terbaru milik penyelenggara.
// canResubmit: tombol "Ajukan Ulang" (hanya setelah ditolak).
function CancellationRequestView({
  request,
  feeType,
  canResubmit,
  blockedReason,
  onResubmit,
}) {
  return (
    <>
      {request.status === "menunggu" && (
        <div className="cancel-banner purple">
          <CancellationIcon name="clock" size={20} />
          <div>
            <b>Menunggu keputusan admin</b>
            <small>
              Diajukan {formatShortDate(request.submittedAt)} · Estimasi review
              sekitar 4 hari kerja
            </small>
          </div>
        </div>
      )}
      {request.status === "ditolak" && (
        <div className="cancel-banner plain">
          <CancellationIcon name="x-circle" size={20} />
          <div>
            <b>Pembatalan ditolak</b>
            <small>
              Turnamen tetap berjalan · Diputuskan{" "}
              {formatShortDate(request.decidedAt)}
            </small>
          </div>
        </div>
      )}
      {request.status === "disetujui" && (
        <div className="cancel-banner danger">
          <CancellationIcon name="x-circle" size={20} />
          <div>
            <b>Turnamen dibatalkan</b>
            <small>
              Pembatalan disetujui admin pada{" "}
              {formatShortDate(request.decidedAt)}
            </small>
          </div>
        </div>
      )}

      <CancellationContent request={request} feeType={feeType} />

      {request.status === "ditolak" && request.adminNote && (
        <section className="cancel-card cancel-note">
          <div className="cancel-note-head">
            <h2 className="cancel-h2">
              <CancellationIcon name="info" size={16} /> Catatan admin
            </h2>
            <small>
              Admin Esportify · {formatShortDate(request.decidedAt)}
            </small>
          </div>
          <p>{request.adminNote}</p>
        </section>
      )}

      {request.status === "ditolak" && canResubmit && (
        <div className="cancel-actions">
          <button
            type="button"
            className="cancel-btn primary"
            onClick={onResubmit}
          >
            Ajukan Ulang
          </button>
        </div>
      )}
      {request.status === "ditolak" && !canResubmit && blockedReason && (
        <p className="cancel-hint">{blockedReason}</p>
      )}
    </>
  );
}

export default CancellationRequestView;
