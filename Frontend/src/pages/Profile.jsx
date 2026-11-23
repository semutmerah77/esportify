import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Icon from "../components/icon";
import Avatar from "../components/user/Avatar";
import PasswordModal from "../components/user/PasswordModal";
import TrophyCards from "../components/player/TrophyCards";
import { useAuth } from "../context/AuthContext";
import { SKIP_AUTH } from "../config/env";
import {
  getProfile,
  updateUsername,
  updateBio,
  updateGender,
  changePassword,
  uploadAvatar,
} from "../services/profileApi";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // ASSUMPTION: batas belum dikonfirmasi backend
// value = string yang dikirim ke backend, HARUS sama persis dengan isi ENUM
// jenis_kelamin di database (cek migration). label = teks yang tampil di UI.
// ENUM database: 'laki-laki', 'perempuan', 'rahasia'
const GENDER_OPTIONS = [
  { value: "laki-laki", label: "Laki-laki" },
  { value: "perempuan", label: "Perempuan" },
  { value: "rahasia", label: "Rahasia" },
];
const DEFAULT_GENDER = "rahasia";

// Nilai kosong/tidak dikenal dari backend ditampilkan sebagai default (hanya tampilan,
// tidak dikirim ke backend kalau user tidak mengubahnya).
const resolveGender = (v) =>
  GENDER_OPTIONS.find(
    (o) =>
      o.value.toLowerCase() ===
      String(v ?? "")
        .trim()
        .toLowerCase(),
  )?.value ?? DEFAULT_GENDER;

// Tiap field tetap dikirim lewat endpoint-nya masing-masing.
// errorKey = nama key error dari backend.
const FIELDS = [
  { key: "username", api: updateUsername, errorKey: "username" },
  { key: "bio", api: updateBio, errorKey: "bio" },
  { key: "gender", api: updateGender, errorKey: "jenis_kelamin" },
];

const readError = (err, errorKey) => {
  const fe = err?.fields?.[errorKey];
  return (Array.isArray(fe) ? fe[0] : fe) || err?.message || "Gagal menyimpan.";
};

function ProfileContent({ profile, setProfile }) {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  // Mode halaman: false = hanya lihat (default), true = form bisa diedit
  const [isEditing, setIsEditing] = useState(false);

  // ---------- Avatar ----------
  const [avatarFile, setAvatarFile] = useState(null); // file terpilih, belum di-upload
  const [avatarPreview, setAvatarPreview] = useState(""); // blob URL untuk preview
  const [lightbox, setLightbox] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState({ text: "", type: "" });

  // Bersihkan blob URL supaya tidak bocor memori
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  // Tutup lightbox dengan tombol Escape
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => e.key === "Escape" && setLightbox(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const clearAvatarDraft = () => {
    setAvatarFile(null);
    setAvatarPreview("");
  };

  // HANYA validasi + preview, upload baru dilakukan saat klik "Simpan"
  const handleAvatar = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarMsg({ text: "File harus berupa gambar.", type: "error" });
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarMsg({ text: "Ukuran gambar maksimal 2 MB.", type: "error" });
      return;
    }

    setAvatarMsg({ text: "", type: "" });
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // Upload sungguhan, dipanggil dari handleSave
  const uploadAvatarNow = async () => {
    const localUrl = await uploadAvatar(avatarFile);
    let next = localUrl ? { ...profile, avatar: localUrl } : await getProfile();

    // Browser sering menampilkan gambar lama kalau URL-nya sama. Tambahkan
    // ?v=timestamp supaya dimuat ulang.
    if (next.avatar && !/^(data:|blob:)/.test(next.avatar)) {
      const sep = next.avatar.includes("?") ? "&" : "?";
      next = { ...next, avatar: `${next.avatar}${sep}v=${Date.now()}` };
    }
    return next;
  };

  // ---------- Form informasi pribadi (satu tombol simpan) ----------
  const base = {
    username: profile.username ?? "",
    bio: profile.bio ?? "",
    gender: resolveGender(profile.gender),
  };

  const [form, setForm] = useState(base);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [pwOpen, setPwOpen] = useState(false);

  // Input terkunci saat mode lihat atau saat sedang menyimpan
  const locked = !isEditing || saving;

  const valueOf = (key) =>
    key === "username" ? form.username.trim() : form[key];

  const changed = FIELDS.filter((f) => valueOf(f.key) !== base[f.key]);
  // Avatar baru juga dihitung sebagai perubahan
  const dirty = changed.length > 0 || !!avatarFile;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  // Klik "Edit profil": mulai dari data yang tersimpan
  const handleEdit = () => {
    setForm(base);
    setErrors({});
    setIsEditing(true);
  };

  // Klik "Batal": buang semua perubahan (termasuk foto terpilih)
  const handleReset = () => {
    setForm(base);
    setErrors({});
    clearAvatarDraft();
    setAvatarMsg({ text: "", type: "" });
    setIsEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isEditing || !dirty || saving) return;

    // Validasi hanya untuk field yang diubah
    const local = {};
    changed.forEach((f) => {
      const v = valueOf(f.key);
      if (f.key === "username" && v.length < 3)
        local.username = "Username minimal 3 karakter.";
      if (f.key === "gender" && !v) local.gender = "Pilih jenis kelamin.";
    });
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }

    setSaving(true);
    const saved = {};
    const failed = {};
    let avatarFailed = false;
    let avatarSaved = false;
    let nextProfile = profile;

    // Berurutan, bukan paralel, supaya perilaku ke backend tetap aman
    for (const f of changed) {
      const v = valueOf(f.key);
      try {
        await f.api(v);
        saved[f.key] = v;
      } catch (err) {
        failed[f.key] = readError(err, f.errorKey);
      }
    }
    nextProfile = { ...nextProfile, ...saved };

    // Upload avatar kalau ada yang dipilih
    if (avatarFile) {
      try {
        const withAvatar = await uploadAvatarNow();
        nextProfile = { ...nextProfile, avatar: withAvatar.avatar };
        avatarSaved = true;
        clearAvatarDraft();
      } catch (err) {
        avatarFailed = true;
        const fe = err.fields?.avatar;
        setAvatarMsg({
          text:
            (Array.isArray(fe) ? fe[0] : fe) ||
            err.message ||
            "Gagal mengunggah foto.",
          type: "error",
        });
      }
    }

    if (Object.keys(saved).length || avatarSaved) {
      setProfile(nextProfile);
      setForm((cur) => ({ ...cur, ...saved }));
      if (!SKIP_AUTH) await refreshUser().catch(() => {});
    }

    setErrors(failed);
    setSaving(false);

    // Semua berhasil: kembali ke mode lihat. Kalau ada yang gagal, tetap di
    // mode edit supaya pesan error-nya terlihat.
    if (!Object.keys(failed).length && !avatarFailed) {
      setAvatarMsg({ text: "", type: "" });
      setToast("Profil berhasil diperbarui");
      setIsEditing(false);
    }
  };

  const shownAvatar = avatarPreview || profile.avatar;
  const bioMax = 150; // sesuai desain (11/150)

  return (
    <div className="pr-page">
      <button type="button" className="pr-back" onClick={() => navigate(-1)}>
        <svg
          width="25"
          height="25"
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

      <h1 className="pr-title">Profil</h1>
      <p className="pr-sub">Kelola informasi akun kamu.</p>

      {/* ===== Kartu atas: avatar, nama, bio, tombol Edit profil ===== */}
      <section className="pr-card pm-hero">
        <div className="pm-avatar">
          {/* Klik avatar = lihat preview besar (mode lihat maupun edit) */}
          <button
            type="button"
            className="pr-avatar-btn"
            onClick={() => setLightbox(true)}
            aria-label="Lihat foto profil"
          >
            <Avatar src={shownAvatar} name={profile.username} size={76} />
          </button>

          {/* Ganti foto hanya bisa saat mode edit */}
          {isEditing && (
            <button
              type="button"
              className="pm-camera"
              onClick={() => fileRef.current.click()}
              disabled={saving}
              aria-label="Ganti foto profil"
            >
              <Icon name="camera" size={13} />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatar}
          />
        </div>

        <div className="pm-hero-main">
          <h2>{profile.username}</h2>
          {profile.bio && <p>{profile.bio}</p>}
          {saving && avatarFile && <p className="pr-msg">Mengunggah...</p>}
          {avatarMsg.text && (
            <p className={`pr-msg ${avatarMsg.type}`}>{avatarMsg.text}</p>
          )}
          {avatarFile && <p className="pm-hint">Foto baru belum disimpan.</p>}
          {isEditing && !avatarFile && (
            <p className="pm-hint">Gambar maksimal 2 MB.</p>
          )}
        </div>

        {/* Edit profil: hanya di mode lihat. Di mode edit, Batal ada di bawah form. */}
        {!isEditing && (
          <button
            type="button"
            className="pm-edit-btn"
            onClick={handleEdit}
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
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            Edit profil
          </button>
        )}
      </section>

      {/* ===== Prestasi (PB-23: piala individu dari GET /profile -> piala) ===== */}
      <section className="pr-card pm-card">
        <h3>Prestasi</h3>
        <p className="pm-card-sub">Piala kemenanganmu.</p>
        <TrophyCards trophies={profile.trophies} />
      </section>

      {/* ===== Informasi pribadi ===== */}
      <form
        className={`pr-card pm-card ${isEditing ? "editing" : "pr-view"}`}
        onSubmit={handleSave}
        noValidate
      >
        <h3>Informasi pribadi</h3>
        <p className="pm-card-sub">
          {isEditing
            ? "Perubahan tersimpan setelah kamu menekan Simpan."
            : "Informasi profil yang tampil di akun kamu."}
        </p>

        <div className="pm-two">
          <div>
            <label
              className={`pm-field ${errors.username ? "err" : ""}`}
              htmlFor="pr-username"
            >
              <span className="pm-flabel">Username</span>
              <input
                id="pr-username"
                className="pm-input"
                value={form.username}
                onChange={(e) => setField("username", e.target.value)}
                disabled={locked}
              />
            </label>
            {errors.username && <p className="pr-err">{errors.username}</p>}
          </div>

          <div>
            <label
              className={`pm-field ${errors.gender ? "err" : ""}`}
              htmlFor="pr-gender"
            >
              <span className="pm-flabel">Jenis kelamin</span>
              <select
                id="pr-gender"
                className="pm-input pm-select"
                value={form.gender}
                onChange={(e) => setField("gender", e.target.value)}
                disabled={locked}
              >
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {isEditing && (
                <svg
                  className="pm-chev"
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
                  <path d="m6 9 6 6 6-6" />
                </svg>
              )}
            </label>
            {errors.gender && <p className="pr-err">{errors.gender}</p>}
          </div>
        </div>

        <div>
          <label
            className={`pm-field pm-bio ${errors.bio ? "err" : ""}`}
            htmlFor="pr-bio"
          >
            <span className="pm-flabel">Bio</span>
            <textarea
              id="pr-bio"
              className="pm-input pm-textarea"
              value={form.bio}
              maxLength={bioMax}
              placeholder={isEditing ? "" : "Belum ada bio"}
              onChange={(e) => setField("bio", e.target.value)}
              disabled={locked}
            />
            {isEditing && (
              <span className="pm-count">
                {form.bio.length}/{bioMax}
              </span>
            )}
          </label>
          {errors.bio && <p className="pr-err">{errors.bio}</p>}
        </div>

        {isEditing && (
          <div className="pm-foot">
            <button
              type="button"
              className="pm-btn ghost"
              onClick={handleReset}
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="submit"
              className="pm-btn primary"
              disabled={!dirty || saving}
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        )}
      </form>

      {/* ===== Akun: email (read-only) dan password ===== */}
      <section className="pr-card pm-card">
        <h3>Akun</h3>
        <p className="pm-card-sub">
          Email dan password yang kamu pakai untuk masuk.
        </p>

        <div className="pm-two">
          <div className="pm-acc">
            <span className="pm-acc-ic blue" aria-hidden="true">
              <svg
                width="18"
                height="18"
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
            </span>
            <div className="pm-acc-tx">
              <small>Email</small>
              <b>{profile.email}</b>
            </div>
            {/* Email tidak bisa diubah (tidak ada endpoint ubah email) */}
            <span className="pm-lock" title="Tidak dapat diubah">
              <svg
                width="15"
                height="15"
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

          <div className="pm-acc">
            <span className="pm-acc-ic" aria-hidden="true">
              <svg
                width="18"
                height="18"
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
            </span>
            <div className="pm-acc-tx">
              <small>Password</small>
              <b className="dots">••••••••</b>
            </div>
            <button
              type="button"
              className="pm-pw-btn"
              onClick={() => setPwOpen(true)}
            >
              Ubah password
            </button>
          </div>
        </div>
      </section>

      {/* changePassword dipanggil dengan kontrak yang sama:
          { currentPassword, password, confirmPassword } */}
      {pwOpen && (
        <PasswordModal
          onSubmit={changePassword}
          onClose={() => setPwOpen(false)}
          onSuccess={() => setToast("Password berhasil diubah")}
        />
      )}

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
        <div className="pm-ov" onClick={() => setToast("")}>
          <div className="pm-done" role="status">
            <span className="pm-done-ic">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <b>{toast}</b>
          </div>
        </div>
      )}
    </div>
  );
}

// SESUDAH
function Profile() {
  const { profile, setProfile } = useOutletContext() ?? {};

  if (!profile) {
    return <p className="admin-message">Memuat profil...</p>;
  }

  return <ProfileContent profile={profile} setProfile={setProfile} />;
}

export default Profile;
