import { useEffect, useRef } from "react";
import ReportIcon from "./ReportIcon";
import "../../styles/match-report.css";

// Popup sukses di tengah layar (pengganti toast hijau).
// title: judul singkat | text: pesan dari BE | onClose: dipanggil saat ditutup (otomatis 2,4 detik)
function ActionDonePopup({ title, text, onClose }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => closeRef.current?.(), 2400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="rp-ov rp-ov-top"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="rp-dialog rp-done" role="status">
        <span className="rp-done-ic">
          <ReportIcon name="check" size={24} />
        </span>
        <b>{title}</b>
        {text && <p>{text}</p>}
      </div>
    </div>
  );
}

export default ActionDonePopup;
