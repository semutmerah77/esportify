import CancellationIcon from "../kelola/CancellationIcon";
import "../../styles/match-report.css";
import "../../styles/tournament-cancellation.css";

// Popup follow-up (HTTP 423, data.jenis = "pembatalan_turnamen"):
// daftar pengajuan pembatalan yang menunggu lebih dari batas hari verifikasi.
// items: [{ id, tournament: { name }, organizer, waitingDays }]
function OverdueCancellationDialog({ items, onReview }) {
  return (
    <div className="rp-ov">
      <div
        className="rp-dialog cancel-overdue"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-overdue-title"
      >
        <span className="cancel-overdue-ic">
          <CancellationIcon name="clock" size={28} />
        </span>
        <p className="cancel-overdue-tag">TINDAKAN DIPERLUKAN</p>
        <h2 id="cancel-overdue-title">
          {items.length} Pengajuan Pembatalan Perlu Segera Diverifikasi
        </h2>
        <p className="cancel-overdue-text">
          Ada pengajuan pembatalan yang belum diverifikasi lebih dari 3 hari.
          Tinjau pengajuan pembatalan terlebih dahulu sebelum melanjutkan
          aktivitas di Admin Panel.
        </p>
        <ul className="cancel-overdue-list">
          {items.map((item) => (
            <li key={item.id}>
              <span>
                <i /> {item.name} · {item.organizer}
              </span>
              <b>Menunggu {item.waitingDays} hari</b>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="cancel-btn primary wide"
          onClick={onReview}
        >
          Tinjau Pengajuan Pembatalan Sekarang{" "}
          <CancellationIcon name="arrow-right" size={16} />
        </button>
      </div>
    </div>
  );
}

export default OverdueCancellationDialog;
