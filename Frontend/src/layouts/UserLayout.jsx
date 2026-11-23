import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import Icon from "../components/icon";
import UserSidebar from "../components/user/UserSidebar";
import ProfileMenu from "../components/user/ProfileMenu";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/ESPORTIFY-Logo.png";
import "../styles/admin.css";
import "../styles/user.css";
import { getProfile } from "../services/profileApi";
import useChatList from "../hooks/useChatList";
import "../styles/chat.css";

function UserLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const guest = !user;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  const closeSidebar = () => setSidebarOpen(false);

  // Daftar percakapan + jumlah belum dibaca (titik biru di sidebar). Dipakai juga oleh halaman Obrolan.
  const chat = useChatList(!guest && !loading);

  useEffect(() => {
    if (loading || !user) {
      setProfile(null);
      setError("");
      return;
    }

    let cancelled = false;

    getProfile()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Gagal memuat profil.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  const handleLogout = async () => {
    navigate("/", { replace: true });

    try {
      await signOut();
    } catch (err) {
      console.error("Logout backend gagal:", err);
    }
  };

  if (loading) {
    return (
      <div className="admin">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <span className="logo">
              <img src={logo} alt="ESPORTIFY" className="logo-img" />
              ESPORTIFY
            </span>
          </div>
        </header>
        <div className="admin-body">
          <main className="admin-main">
            <p className="admin-message">Memuat...</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="admin">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <button
            type="button"
            className="admin-menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Buka menu"
          >
            <Icon name="menu" size={22} />
          </button>

          <Link to={guest ? "/" : "/home"} className="logo">
            <img src={logo} alt="ESPORTIFY" className="logo-img" />
            ESPORTIFY
          </Link>
        </div>

        <div className="admin-topbar-right">
          {guest ? (
            <>
              <Link
                to="/login"
                state={{ from: "/turnamen/cari" }}
                className="guest-topbar-login"
              >
                Masuk
              </Link>

              <Link
                to="/register"
                state={{ from: "/turnamen/cari" }}
                className="guest-topbar-register"
              >
                Daftar
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                className="admin-circle-btn"
                aria-label="Notifikasi"
              >
                <Icon name="bell" size={18} />
              </button>

              <ProfileMenu
                username={profile?.username ?? user?.username ?? ""}
                avatar={profile?.avatar}
              />
            </>
          )}
        </div>
      </header>

      <div className="admin-body">
        <UserSidebar
          open={sidebarOpen}
          onNavigate={closeSidebar}
          onLogout={handleLogout}
          guest={guest}
          chatEnabled={!chat.denied}
          chatUnread={chat.unread}
        />

        {sidebarOpen && (
          <div className="admin-overlay" onClick={closeSidebar} />
        )}

        <main className="admin-main">
          {error && <p className="admin-message error">{error}</p>}

          <Outlet context={{ profile, setProfile, chat }} />
        </main>
      </div>
    </div>
  );
}

export default UserLayout;
