import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Avatar from "../../components/user/Avatar";
import PasswordModal from "../../components/user/PasswordModal";
import { useAuth } from "../../context/AuthContext";
import { SKIP_AUTH } from "../../config/env";
import {
  updateAdminUsername,
  changeAdminPassword,
} from "../../services/profileApi";
import "../../styles/user.css"; // style profil dipakai ulang

const readError = (err) => {
  const fe = err?.fields?.username;
  return (Array.isArray(fe) ? fe[0] : fe) || err?.message || "Gagal menyimpan.";
};

function AdminProfile() {
  // Data profil dimiliki AdminLayout supaya navbar ikut berubah
  const { adminProfile: profile, setAdminProfile: setProfile } =
    useOutletContext();
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  // Mode halaman: false = hanya lihat (default), true = form bisa diedit
  const [isEditing, setIsEditing] = useState(false);

  // ---------- Avatar (hanya preview besar, admin tidak bisa ganti foto) ----------
  const [lightbox, setLightbox] = useState(false);

  // Tutup lightbox dengan tombol Escape
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => e.key === "Escape" && setLightbox(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // ---------- Form informasi pribadi (admin hanya punya username) ----------
  const savedUsername = profile?.username ?? "";

  const [username, setUsername] = useState(savedUsername);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [pwOpen, setPwOpen] = useState(false);

  // Input terkunci saat mode lihat atau saat sedang menyimpan
  const locked = !isEditing || saving;

  const usernameChanged = username.trim() !== savedUsername;
  const dirty = usernameChanged;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // Klik "Edit": mulai dari data yang tersimpan
  const handleEdit = () => {
    setUsername(savedUsername);
    setError("");
    setIsEditing(true);
  };

  // Klik "Batal": buang semua perubahan
  const handleReset = () => {
    setUsername(savedUsername);
    setError("");
    setIsEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isEditing || !dirty || saving) return;

    const v = username.trim();
    if (v.length < 3) {
      setError("Username minimal 3 karakter.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateAdminUsername(v);
      setProfile({ ...profile, username: v }); // navbar ikut berubah
      if (!SKIP_AUTH) await refreshUser().catch(() => {});
      setToast("Profil berhasil diperbarui");
      setIsEditing(false);
    } catch (err) {
      // Tetap di mode edit supaya pesan error-nya terlihat
      setError(readError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <p className="admin-message">Memuat...</p>;

  const shownAvatar = profile.avatar;

  return (
    <div className="pr-page">
      <button type="button" className="pr-back" onClick={() => navigate(-1)}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Kembali
      </button>

      <h1 className="pr-title">Profil Admin</h1>
      <p className="pr-sub">Kelola informasi akun admin kamu.</p>

      <div className="pr-grid">
        {/* ===== Kolom kiri: avatar ===== */}
        <section className="pr-card pr-side">
          <div className="pr-ring">
            {/* Klik avatar = lihat preview besar (mode lihat maupun edit) */}
            <button
              type="button"
              className="pr-avatar-btn"
              onClick={() => setLightbox(true)}
              aria-label="Lihat foto profil"
            >
              <Avatar src={shownAvatar} name={profile.username} size={128} />
            </button>
          </div>

          <h2 className="pr-name">{profile.username}</h2>
          <p className="pr-bio">Admin Platform</p>
        </section>

        {/* ===== Kolom kanan ===== */}
        <div className="pr-col">
          <form
            className={`pr-card ${isEditing ? "" : "pr-view"}`}
            onSubmit={handleSave}
            noValidate
          >
            <div className="pr-head">
              {/* Baris judul: judul di kiri, tombol Edit/Batal di pojok kanan */}
              <div className="pr-head-top">
                <h3>Informasi pribadi</h3>

                {/* Satu tombol yang berganti: Edit (pensil) <-> Batal (silang) */}
                <button
                  type="button"
                  className="pr-btn pr-btn-s pr-btn-toggle"
                  onClick={isEditing ? handleReset : handleEdit}
                  disabled={saving}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {isEditing ? (
                      <>
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </>
                    ) : (
                      <>
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </>
                    )}
                  </svg>
                  {isEditing ? "Batal" : "Edit"}
                </button>
              </div>

              <p>
                {isEditing
                  ? "Perubahan tersimpan setelah kamu menekan Simpan perubahan."
                  : "Informasi profil yang tampil di akun kamu."}
              </p>
            </div>

            <div className="pr-body">
              <div className="pr-field">
                <label className="pr-label" htmlFor="pr-username">
                  Username
                </label>
                <input
                  id="pr-username"
                  className={`pr-input ${error ? "err" : ""}`}
                  value={isEditing ? username : savedUsername}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  disabled={locked}
                />
                {error && <p className="pr-err">{error}</p>}
              </div>
            </div>

            {isEditing && (
              <div className="pr-foot">
                <span className={`pr-dirty ${dirty ? "on" : ""}`}>
                  <i />
                  {dirty
                    ? "Ada perubahan yang belum disimpan"
                    : "Belum ada perubahan"}
                </span>
                <button
                  type="submit"
                  className="pr-btn pr-btn-p"
                  disabled={!dirty || saving}
                >
                  {saving ? "Menyimpan..." : "Simpan perubahan"}
                </button>
              </div>
            )}
          </form>

          {/* Email read-only permanen (tidak ada endpoint ubah email) */}
          <section className="pr-card">
            <div className="pr-head">
              <h3>Akun</h3>
              <p>Email dan password yang kamu pakai untuk masuk.</p>
            </div>

            <div className="pr-row">
              <div className="pr-sec-ic blue" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
              </div>
              <div className="pr-sec-tx">
                <b>Email</b>
                <span className="pr-email">{profile.email}</span>
              </div>
              <span className="pr-badge">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
            </div>

            <div className="pr-row">
              <div className="pr-sec-ic" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </div>
              <div className="pr-sec-tx">
                <b>Password</b>
                <span>••••••••</span>
              </div>
              <button
                type="button"
                className="pr-btn pr-btn-s"
                onClick={() => setPwOpen(true)}
              >
                Ubah password
              </button>
            </div>
          </section>

          {/* changeAdminPassword dipanggil dengan kontrak yang sama:
              { currentPassword, password, confirmPassword } */}
          {pwOpen && (
            <PasswordModal
              onSubmit={changeAdminPassword}
              onClose={() => setPwOpen(false)}
              onSuccess={() => setToast("Password berhasil diubah")}
            />
          )}
        </div>
      </div>

      {/* ===== Lightbox preview avatar (4:3, dipangkas) ===== */}
      {lightbox && (
        <div
          className="pr-lightbox"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Preview foto profil"
        >
          <div className="pr-lightbox-box" onClick={(e) => e.stopPropagation()}>
            {shownAvatar ? (
              <img src={shownAvatar} alt={profile.username} />
            ) : (
              <div className="pr-lightbox-ph">
                {profile.username?.charAt(0).toUpperCase() || "•"}
              </div>
            )}
            <button
              type="button"
              className="pr-lightbox-x"
              onClick={() => setLightbox(false)}
              aria-label="Tutup"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="pr-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

export default AdminProfile;
