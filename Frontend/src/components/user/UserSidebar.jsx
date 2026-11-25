import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation } from "react-router-dom";
import Icon from "../icon";
import { ChatBubbleIcon } from "../chat/ChatIcons";

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
  {
    label: "Cari Squad",
    to: "/squad/cari",
    icon: "search",
    locked: true,
    detailFrom: "cari",
  },
  {
    label: "Squad Saya",
    to: "/squad/saya",
    icon: "swords",
    locked: true,
    detailFrom: "saya",
  },
];

function UserSidebar({
  open,
  onNavigate,
  onLogout,
  guest = false,
  chatEnabled = true,
  chatUnread = 0,
}) {
  const { pathname, search, state } = useLocation();

  // Halaman yang dibuka dari kartu di Home (navigate dengan state.area = "home") -> menu Home menyala
  const fromHome = state?.area === "home" && pathname !== "/home";

  // Profil Player (/player/:id) dibuka dari Turnamen (state.area = "turnamen") atau dari Squad
  const playerFromTournament =
    pathname.startsWith("/player") && state?.area === "turnamen";
  const [menuOpen, setMenuOpen] = useState(
    pathname.startsWith("/turnamen") ||
      pathname.startsWith("/pendaftaran") ||
      playerFromTournament,
  );
  const [squadOpen, setSquadOpen] = useState(
    pathname.startsWith("/squad") ||
      (pathname.startsWith("/player") && !playerFromTournament),
  );
  const [showGate, setShowGate] = useState(false);

  // Pindah halaman (mis. dari Notifikasi): buka grup menu yang sesuai agar menu aktif terlihat
  useEffect(() => {
    if (
      pathname.startsWith("/turnamen") ||
      pathname.startsWith("/pendaftaran") ||
      playerFromTournament
    )
      setMenuOpen(true);
    if (
      pathname.startsWith("/squad") ||
      (pathname.startsWith("/player") && !playerFromTournament)
    )
      setSquadOpen(true);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const returnTo = `${pathname}${search}`;

  const navClass = ({ isActive }) =>
    isActive ? "admin-nav-item active" : "admin-nav-item";

  const handleLockedClick = () => {
    setShowGate(true);
    onNavigate?.();
  };

  // Ingat halaman daftar squad terakhir yang dibuka (Cari Squad / Squad Saya)
  const squadList =
    pathname === "/squad/cari"
      ? "cari"
      : pathname === "/squad/saya"
        ? "saya"
        : null;
  useEffect(() => {
    if (!squadList) return;
    try {
      sessionStorage.setItem("squad-list-from", squadList);
    } catch {
      /* penyimpanan tidak tersedia: pakai default */
    }
  }, [squadList]);

  const squadFrom = () => {
    if (state?.from) return state.from;
    try {
      return sessionStorage.getItem("squad-list-from") || "saya";
    } catch {
      return "saya";
    }
  };

  // Ingat halaman daftar turnamen terakhir yang dibuka (Cari Turnamen / Turnamen Saya).
  // Hanya halaman daftarnya, bukan detail, supaya detail mengikuti asalnya.
  const tournamentArea =
    pathname === "/turnamen/saya"
      ? "saya"
      : pathname === "/turnamen/cari"
        ? "cari"
        : null;
  useEffect(() => {
    if (!tournamentArea) return;
    try {
      sessionStorage.setItem("turnamen-from", tournamentArea);
    } catch {
      /* penyimpanan tidak tersedia: pakai default */
    }
  }, [tournamentArea]);

  const tournamentFrom = () => {
    try {
      return sessionStorage.getItem("turnamen-from") || "cari";
    } catch {
      return "cari";
    }
  };

  const isItemActive = (item) => {
    if (fromHome) return false;
    // Detail squad (/squad/:id): menu yang aktif mengikuti asal halaman (Cari Squad atau Squad Saya)
    // PB-23: profil Player (/player/:id) mengikuti asalnya.
    // Dari Turnamen (state.area = "turnamen") -> Cari Turnamen / Turnamen Saya; selain itu -> menu Squad.
    const isPlayerPage = /^\/player\/[^/]+$/.test(pathname);
    if (isPlayerPage && state?.area === "turnamen")
      return (
        item.to ===
        (tournamentFrom() === "saya" ? "/turnamen/saya" : "/turnamen/cari")
      );
    const isSquadDetail =
      /^\/squad\/(?!cari(\/|$)|saya(\/|$))[^/]+(\/(winrate|lencana))?$/.test(
        pathname,
      ) || isPlayerPage;
    if (isSquadDetail && item.detailFrom)
      return squadFrom() === item.detailFrom;

    // Halaman turunan turnamen (detail, form daftar, detail pendaftaran):
    // menu yang aktif mengikuti asal (Cari Turnamen atau Turnamen Saya)
    const followsList =
      /^\/turnamen\/cari\/[^/]+$/.test(pathname) ||
      /^\/turnamen\/[^/]+\/daftar$/.test(pathname) ||
      pathname.startsWith("/pendaftaran/");
    if (followsList)
      return (
        item.to ===
        (tournamentFrom() === "saya" ? "/turnamen/saya" : "/turnamen/cari")
      );
    if (
      item.to === "/turnamen/kelola" &&
      /^\/turnamen\/[^/]+\/(kelola|pembatalan)/.test(pathname)
    )
      return true;
    // Ruang Turnamen peserta (/turnamen/{id}/...): alurnya Turnamen Saya -> klik turnamen -> Ruang Turnamen,
    // jadi menu Turnamen Saya tetap menyala. Alamat kelola/daftar dan halaman turnamen lain dikecualikan.
    if (
      item.to === "/turnamen/saya" &&
      /^\/turnamen\/(?!cari|saya|kelola|buat|detail|status-pengajuan|pengajuan)[^/]+\/(?!kelola|daftar|pembatalan)[^/]+/.test(
        pathname,
      )
    )
      return true;
    return (
      pathname === item.to ||
      (item.also ?? []).some((path) => pathname.startsWith(path))
    );
  };

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
        <NavLink
          to="/home"
          end
          className={({ isActive }) =>
            isActive || fromHome ? "admin-nav-item active" : "admin-nav-item"
          }
          onClick={onNavigate}
        >
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
                className={`admin-nav-item ${isItemActive(item) ? "active" : ""}`}
                onClick={onNavigate}
              >
                <Icon name={item.icon} size={15} /> {item.label}
              </NavLink>
            );
          })}
        </div>
      )}

      {/* Obrolan (PB-27): menyala di /obrolan dan /obrolan/:id */}
      {!guest && chatEnabled && (
        <NavLink to="/obrolan" className={navClass} onClick={onNavigate}>
          <ChatBubbleIcon size={16} /> Obrolan
          {chatUnread > 0 && (
            <span className="ch-dot" aria-label="Ada pesan belum dibaca" />
          )}
        </NavLink>
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
