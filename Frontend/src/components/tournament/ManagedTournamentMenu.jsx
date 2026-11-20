import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CancellationIcon from "../kelola/CancellationIcon";
import "../../styles/tournament-cancellation.css";

// Menu ⋮ pada kartu Turnamen Kelolaan.
// Satu pintu ke halaman pembatalan: "Ajukan pembatalan" atau "Lihat pengajuan pembatalan".
// (Item "Perpanjangan" ditambahkan di PB-24.)
function ManagedTournamentMenu({ id, status, cancellation, pendingVerify }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) =>
      !rootRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Turnamen selesai tidak bisa dibatalkan: tidak ada isi menu.
  if (status === "selesai") return null;

  const viewOnly =
    status === "dibatalkan" || cancellation?.status === "menunggu";
  const blocked = !viewOnly && pendingVerify !== null && pendingVerify > 0;
  const to = `/turnamen/${id}/pembatalan`;

  return (
    <div className="t-more" ref={rootRef}>
      <button
        type="button"
        className="t-more-btn"
        aria-label="Menu turnamen"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <CancellationIcon name="dots" size={18} />
      </button>

      {open && (
        <div className="t-more-menu" role="menu">
          {viewOnly ? (
            <Link to={to} role="menuitem" className="t-more-item">
              <span className="t-more-ic danger">
                <CancellationIcon name="file-search" size={18} />
              </span>
              <span>
                <b>Lihat pengajuan pembatalan</b>
                <small>Periksa pengajuan</small>
              </span>
            </Link>
          ) : blocked ? (
            <div
              role="menuitem"
              aria-disabled="true"
              className="t-more-item disabled"
            >
              <span className="t-more-ic muted">
                <CancellationIcon name="x-circle" size={18} />
              </span>
              <span>
                <b>Ajukan pembatalan</b>
                <small className="warn">Selesaikan verifikasi pendaftar</small>
              </span>
            </div>
          ) : (
            <Link to={to} role="menuitem" className="t-more-item">
              <span className="t-more-ic danger">
                <CancellationIcon name="x-circle" size={18} />
              </span>
              <span>
                <b>Ajukan pembatalan</b>
                <small>Batalkan kompetisi</small>
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default ManagedTournamentMenu;
