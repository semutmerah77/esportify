import { Link } from "react-router-dom";

// Tab halaman Pengajuan Turnamen (admin): Pembuatan | Pembatalan.
// Tab aktif ditentukan oleh ?tab=pembatalan di URL, jadi bisa dituju langsung (mis. dari popup follow-up).
function SubmissionKindTabs({ active }) {
  return (
    <div
      className="t-tabs"
      role="tablist"
      aria-label="Jenis pengajuan turnamen"
    >
      <Link
        to="/admin/pengajuan"
        role="tab"
        aria-selected={active === "pembuatan"}
        className={`t-tab ${active === "pembuatan" ? "active" : ""}`}
      >
        Pembuatan Turnamen
      </Link>
      <Link
        to="/admin/pengajuan?tab=pembatalan"
        role="tab"
        aria-selected={active === "pembatalan"}
        className={`t-tab ${active === "pembatalan" ? "active" : ""}`}
      >
        Pembatalan Turnamen
      </Link>
    </div>
  );
}

export default SubmissionKindTabs;
