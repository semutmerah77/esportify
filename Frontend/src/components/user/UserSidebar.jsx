import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation } from "react-router-dom";
import Icon from "../icon"; // samakan huruf besar/kecil dengan nama file aslinya

const tournamentItems = [
  {
    label: "Cari Turnamen",
    to: "/turnamen/cari",
    icon: "search",
    also: ["/turnamen/cari/"],
    locked: false,
  },
  {
    label: "Turnamen Saya",
    to: "/turnamen/saya",
    icon: "ticket",
    locked: true,
  },
  {
    label: "Kelola Turnamen",
    to: "/turnamen/kelola",
    icon: "manage",
    also: [
      "/turnamen/buat",
      "/turnamen/status-pengajuan",
      "/turnamen/pengajuan",
      "/turnamen/detail",
    ],
    locked: true,
  },
];

const squadItems = [
  { label: "Cari Squad", to: "/squad/cari", icon: "search", locked: true },
  { label: "Squad Saya", to: "/squad/saya", icon: "swords", locked: true },
];

function UserSidebar({ open, onNavigate, onLogout, guest = false }) {
  const { pathname, search } = useLocation();

  const [menuOpen, setMenuOpen] = useState(pathname.startsWith("/turnamen"));
  const [squadOpen, setSquadOpen] = useState(pathname.startsWith("/squad"));
  const [showGate, setShowGate] = useState(false);

  const returnTo = `${pathname}${search}`;

  const navClass = ({ isActive }) =>
    isActive ? "admin-nav-item active" : "admin-nav-item";

  const handleLockedClick = () => {
    setShowGate(true);
    onNavigate?.();
  };

  const isItemActive = (item) =>
    pathname === item.to ||
    (item.also ?? []).some((path) => pathname.startsWith(path));

  // Tutup modal dengan tombol Escape
  useEffect(() => {
    if (!showGate) return undefined;
    const onKey = (e) => e.key === "Escape" && setShowGate(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showGate]);

  return (
    <aside className={`admin-sidebar ${open ? "open" : ""}`}>
      {/* Home hanya untuk user yang sudah login */}
      {!guest && (
        <NavLink to="/home" end className={navClass} onClick={onNavigate}>
          <Icon name="home" size={16} /> Home
        </NavLink>
      )}

      {/* Menu turnamen tersedia untuk guest dan user */}
      <button
        type="button"
        className="admin-nav-item admin-nav-toggle"
        onClick={() => setMenuOpen((previous) => !previous)}
        aria-expanded={menuOpen}
      >
        <Icon name="trophy" size={16} /> Turnamen
        <Icon name={menuOpen ? "chevron-up" : "chevron-down"} size={14} />
      </button>

      {menuOpen && (
        <div className="admin-submenu">
          {tournamentItems.map((item) => {
            const active = isItemActive(item);

            if (guest && item.locked) {
              return (
                <button
                  key={item.to}
                  type="button"
                  className="admin-nav-item guest-locked-item"
                  onClick={handleLockedClick}
                  title="Masuk untuk menggunakan fitur ini"
                  aria-label={`${item.label}, perlu login`}
                >
                  <Icon name={item.icon} size={15} /> {item.label}
                  <Icon name="lock" size={13} />
                </button>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/turnamen/cari"}
                className={`admin-nav-item ${active ? "active" : ""}`}
                onClick={onNavigate}
              >
                <Icon name={item.icon} size={15} /> {item.label}
              </NavLink>
            );
          })}
        </div>
      )}

      {/* Menu squad */}
      <button
        type="button"
        className="admin-nav-item admin-nav-toggle"
        onClick={() => setSquadOpen((previous) => !previous)}
        aria-expanded={squadOpen}
      >
        <Icon name="shield" size={16} /> Squad
        <Icon name={squadOpen ? "chevron-up" : "chevron-down"} size={14} />
      </button>

      {squadOpen && (
        <div className="admin-submenu">
          {squadItems.map((item) => {
            if (guest && item.locked) {
              return (
                <button
                  key={item.to}
                  type="button"
                  className="admin-nav-item guest-locked-item"
                  onClick={handleLockedClick}
                  title="Masuk untuk menggunakan fitur ini"
                  aria-label={`${item.label}, perlu login`}
                >
                  <Icon name={item.icon} size={15} /> {item.label}
                  <Icon name="lock" size={13} />
                </button>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`admin-nav-item ${
                  item.to === "/squad/cari"
                    ? pathname === "/squad/cari"
                      ? "active"
                      : ""
                    : pathname.startsWith("/squad") &&
                        pathname !== "/squad/cari"
                      ? "active"
                      : ""
                }`}
                onClick={onNavigate}
              >
                <Icon name={item.icon} size={15} /> {item.label}
              </NavLink>
            );
          })}
        </div>
      )}

      {/* Aksi di dasar sidebar: sama posisinya untuk guest dan user */}
      {guest ? (
        <Link
          to="/"
          className="admin-nav-item sidebar-logout guest-back"
          onClick={onNavigate}
        >
          <Icon name="arrow-left" size={18} /> Kembali ke Landing Page
        </Link>
      ) : (
        <button
          type="button"
          className="admin-nav-item sidebar-logout"
          onClick={onLogout}
        >
          <Icon name="logout" size={18} /> Keluar
        </button>
      )}

      {/* Modal akses khusus guest. Lewat portal supaya tidak terikat transform sidebar di ponsel. */}
      {guest &&
        showGate &&
        createPortal(
          <div
            className="admin-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowGate(false);
            }}
          >
            <section
              className="admin-modal guest-gate-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="guest-gate-title"
            >
              <div className="admin-modal-head">
                <h2 id="guest-gate-title">Masuk untuk melanjutkan</h2>
                <button
                  type="button"
                  className="admin-modal-close"
                  aria-label="Tutup"
                  onClick={() => setShowGate(false)}
                >
                  <Icon name="x" size={20} />
                </button>
              </div>

              <p className="guest-gate-description">
                Masuk atau buat akun Esportify untuk mengakses fitur ini dan
                mengelola aktivitas turnamenmu.
              </p>

              <div className="admin-modal-actions">
                <Link
                  to="/login"
                  state={{ from: returnTo }}
                  className="guest-gate-btn guest-gate-secondary"
                  onClick={() => setShowGate(false)}
                >
                  Masuk
                </Link>
                <Link
                  to="/register"
                  state={{ from: returnTo }}
                  className="guest-gate-btn guest-gate-primary"
                  onClick={() => setShowGate(false)}
                >
                  Buat Akun
                </Link>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </aside>
  );
}

export default UserSidebar;
