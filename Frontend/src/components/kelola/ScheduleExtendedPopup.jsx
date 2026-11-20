import ReportIcon from "./ReportIcon";
import "../../styles/match-report.css";
import "../../styles/schedule-extension.css";

// Popup sukses perpanjangan jadwal (di tengah layar). Tidak tertutup sendiri karena ada pilihan lanjutan:
// BE tidak membuat pengumuman otomatis, jadi penyelenggara disarankan membuatnya sendiri.
function ScheduleExtendedPopup({ text, onClose, onAnnounce }) {
  return (
    <div
      className="rp-ov rp-ov-top"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="rp-dialog rp-done ext-done" role="status">
        <span className="rp-done-ic">
          <ReportIcon name="check" size={24} />
        </span>
        <b>Jadwal diperpanjang</b>
        {text && <p>{text}</p>}
        <p>Beritahu peserta tentang perubahan jadwal lewat pengumuman.</p>
        <div className="ext-actions split">
          <button type="button" className="ext-btn dim" onClick={onClose}>
            Nanti saja
          </button>
          <button
            type="button"
            className="ext-btn primary"
            onClick={onAnnounce}
          >
            Buat pengumuman
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScheduleExtendedPopup;
