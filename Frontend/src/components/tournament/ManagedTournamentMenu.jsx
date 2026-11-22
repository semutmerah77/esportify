import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ScheduleExtendedPopup from "../kelola/ScheduleExtendedPopup";
import CancellationIcon from "../kelola/CancellationIcon";
import ScheduleExtensionDialog from "../kelola/ScheduleExtensionDialog";
import ScheduleIcon from "../kelola/ScheduleIcon";
import "../../styles/tournament-cancellation.css";
import "../../styles/schedule-extension.css";
import { clearTournamentCache } from "../../services/tournamentSearchApi";

// Batas bawah area yang terlihat: tepi bawah wadah yang bisa di-scroll/memotong, atau layar.
function visibleBottom(el) {
  let bottom = window.innerHeight;
  let node = el.parentElement;
  while (node && node !== document.body) {
    const { overflowY } = window.getComputedStyle(node);
    if (/(auto|scroll|hidden|clip)/.test(overflowY)) {
      bottom = Math.min(bottom, node.getBoundingClientRect().bottom);
    }
    node = node.parentElement;
  }
  return bottom;
}

// Menu ⋮ pada kartu Turnamen Kelolaan.
// "Perpanjangan" (PB-24) membuka dialog perpanjang jadwal; pembatalan (PB-25) membuka halaman pembatalan.
function ManagedTournamentMenu({
  id,
  name,
  status,
  cancellation,
  pendingVerify,
  onChanged,
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false); // true = menu dibuka ke atas (ruang di bawah kurang)
  const navigate = useNavigate();
  const [extending, setExtending] = useState(false);
  const [doneText, setDoneText] = useState("");
  const rootRef = useRef(null);
  const menuRef = useRef(null);

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

  // Ukur sebelum tampil: kalau menu melewati batas bawah, buka ke atas
  useLayoutEffect(() => {
    if (!open) {
      setUp(false);
      return;
    }
    const menu = menuRef.current;
    if (!menu) return;
    const menuBottom = menu.getBoundingClientRect().bottom;
    setUp(menuBottom > visibleBottom(menu));
  }, [open]);

  // Turnamen selesai tidak bisa dibatalkan maupun diperpanjang: tidak ada isi menu.
  if (status === "selesai") return null;

  const viewOnly =
    status === "dibatalkan" || cancellation?.status === "menunggu";
  const blocked = !viewOnly && pendingVerify !== null && pendingVerify > 0;
  const to = `/turnamen/${id}/pembatalan`;
  // Perpanjangan tidak tersedia untuk turnamen dibatalkan / ada pembatalan menunggu verifikasi
  const canExtend = !viewOnly;

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
        <div
          className={`t-more-menu ${up ? "up" : ""}`}
          role="menu"
          ref={menuRef}
        >
          {canExtend && (
            <button
              type="button"
              role="menuitem"
              className="t-more-item"
              onClick={() => {
                setOpen(false);
                setExtending(true);
              }}
            >
              <span className="t-more-ic info">
                <ScheduleIcon name="calendar-clock" size={18} />
              </span>
              <span>
                <b>Perpanjangan</b>
                <small>Ubah tanggal daftar</small>
              </span>
            </button>
          )}

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

      {extending && (
        <ScheduleExtensionDialog
          id={id}
          name={name}
          onClose={() => setExtending(false)}
          onExtended={(res) => {
            setExtending(false);
            setDoneText(res.message);
            clearTournamentCache(); // Cari Turnamen memuat ulang jadwal terbaru
            onChanged?.(); // segarkan daftar SATU kali agar jadwal & badge ikut berubah
          }}
        />
      )}

      {doneText && (
        <ScheduleExtendedPopup
          text={doneText}
          onClose={() => setDoneText("")}
          onAnnounce={() => {
            setDoneText("");
            // buka Kelola Turnamen langsung di tab Pengumuman
            navigate(`/turnamen/${id}/kelola`, {
              state: { tab: "pengumuman" },
            });
          }}
        />
      )}
    </div>
  );
}

export default ManagedTournamentMenu;
