import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Icon from "../components/icon";
import Avatar from "../components/user/Avatar";
import AdminSidebar from "../components/admin/AdminSidebar";
import PriorityPopup from "../components/admin/PriorityPopup";
import OverdueCancellationDialog from "../components/admin/OverdueCancellationDialog";
import {
  AdminPriorityProvider,
  useAdminPriority,
} from "../context/AdminPriorityContext";
import { useAuth } from "../context/AuthContext";
import { getAdminProfile } from "../services/profileApi";
import logo from "../assets/ESPORTIFY-Logo.png";
import "../styles/admin.css";
import "../styles/user.css";

const POPUP_KEY = "esportify_priority_popup";
const CANCEL_POPUP_KEY = "esportify_cancellation_popup";
const CANCEL_TAB_PATH = "/admin/pengajuan?tab=pembatalan";

function AdminShell() {
  const { user, signOut } = useAuth();
  const { priority, loading, now, cancelOverdue } = useAdminPriority();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminProfile, setAdminProfile] = useState(null);
  const [popupDone, setPopupDone] = useState(
    () => sessionStorage.getItem(POPUP_KEY) === "1",
  );
  const [cancelPopupDone, setCancelPopupDone] = useState(
    () => sessionStorage.getItem(CANCEL_POPUP_KEY) === "1",
  );

  useEffect(() => {
    getAdminProfile()
      .then(setAdminProfile)
      .catch(() => {});
  }, []);

  // Terkunci kalau ada pengajuan turnamen ATAU pembatalan turnamen yang lewat batas verifikasi
  const cancelLocked = !loading && cancelOverdue.length > 0;
  const locked = (!loading && priority.length > 0) || cancelLocked;
  // Kalau hanya pembatalan yang terlambat, arahkan ke tab Pembatalan
  const lockTarget =
    priority.length === 0 && cancelLocked
      ? CANCEL_TAB_PATH
      : "/admin/pengajuan";

  // Kalau tidak ada lagi pengajuan prioritas, reset penanda popup supaya
  // popup muncul lagi saat ada prioritas baru di sesi yang sama.
  useEffect(() => {
    if (!loading && priority.length === 0) {
      sessionStorage.removeItem(POPUP_KEY);
      setPopupDone(false);
    }
  }, [loading, priority.length]);

  useEffect(() => {
    if (!loading && cancelOverdue.length === 0) {
      sessionStorage.removeItem(CANCEL_POPUP_KEY);
      setCancelPopupDone(false);
    }
  }, [loading, cancelOverdue.length]);

  const handleLogout = async () => {
    // Popup prioritas harus muncul lagi di sesi login berikutnya
    sessionStorage.removeItem(POPUP_KEY);
    sessionStorage.removeItem(CANCEL_POPUP_KEY);
    try {
      await signOut();
    } catch (err) {
      console.error("Logout backend gagal:", err);
    } finally {
      window.location.replace("/");
    }
  };

  const goReview = () => {
    sessionStorage.setItem(POPUP_KEY, "1");
    setPopupDone(true);
    navigate("/admin/pengajuan");
  };

  const goReviewCancellation = () => {
    sessionStorage.setItem(CANCEL_POPUP_KEY, "1");
    setCancelPopupDone(true);
    navigate(CANCEL_TAB_PATH);
  };

  // Kenyamanan saja. Penguncian yang sebenarnya dilakukan backend.
  if (locked && !pathname.startsWith("/admin/pengajuan")) {
    return <Navigate to={lockTarget} replace />;
  }

  return (
    <div className="admin">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <button
            className="admin-menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Buka menu"
          >
            <Icon name="menu" size={22} />
          </button>
          <Link to="/admin/pengajuan" className="logo">
            <img src={logo} alt="ESPORTIFY" className="logo-img" />
            ESPORTIFY
          </Link>
        </div>
        <div className="admin-topbar-right">
          <Link
            to="/admin/profile"
            title="Profil admin"
            aria-label="Profil admin"
          >
            <Avatar
              src={adminProfile?.avatar}
              name={adminProfile?.username || user?.username || ""}
              size={36}
            />
          </Link>
        </div>
      </header>

      <div className="admin-body">
        <AdminSidebar
          open={sidebarOpen}
          locked={locked}
          onNavigate={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />
        {sidebarOpen && (
          <div
            className="admin-overlay"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}
        <main className="admin-main">
          <Outlet context={{ adminProfile, setAdminProfile }} />
        </main>
      </div>

      {priority.length > 0 && !popupDone && (
        <PriorityPopup items={priority} now={now} onGo={goReview} />
      )}

      {priority.length === 0 && cancelLocked && !cancelPopupDone && (
        <OverdueCancellationDialog
          items={cancelOverdue.map((r) => ({
            id: r.id,
            name: r.tournament.name,
            organizer: r.tournament.organizer,
            waitingDays: Math.max(
              0,
              Math.floor(
                (now - new Date(r.submittedAt ?? "").getTime()) / 86400000,
              ) || 0,
            ),
          }))}
          onReview={goReviewCancellation}
        />
      )}
    </div>
  );
}

function AdminLayout() {
  return (
    <AdminPriorityProvider>
      <AdminShell />
    </AdminPriorityProvider>
  );
}

export default AdminLayout;
