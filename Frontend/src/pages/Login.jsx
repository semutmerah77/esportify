import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell";
import FormField from "../components/auth/FormField";
import Icon from "../components/icon";
import { useAuth } from "../context/AuthContext";
import { homePathFor } from "../utils/role";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: checking, signIn } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Halaman asal (string path) dari ProtectedRoute. Dipakai hanya kalau
  // sesuai dengan role-nya (admin tidak dikirim ke halaman user, dan sebaliknya).
  const from = location.state?.from;
  const targetFor = (u) => {
    const home = homePathFor(u);
    return typeof from === "string" &&
      from.startsWith("/admin") === (home === "/admin")
      ? from
      : home;
  };

  // Sudah login? Tidak perlu lihat halaman login
  if (!checking && user) return <Navigate to={targetFor(user)} replace />;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!form.email.trim() || !form.password) {
      setMessage("Email dan password wajib diisi.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const currentUser = await signIn(form);
      navigate(targetFor(currentUser), { replace: true });
    } catch (err) {
      const fieldErrors = {};
      Object.entries(err.fields || {}).forEach(([key, value]) => {
        fieldErrors[key] = Array.isArray(value) ? value[0] : value;
      });
      setErrors(fieldErrors);

      if (err.status === 401 || err.status === 422) {
        setMessage("Email atau password salah.");
      } else {
        setMessage(err.message || "Terjadi kesalahan. Coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleButton = (
    <button
      type="button"
      className="field-toggle"
      onClick={() => setShowPassword(!showPassword)}
      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
    >
      <Icon name={showPassword ? "eye-off" : "eye"} size={16} />
    </button>
  );

  return (
    <AuthShell
      heading="Bersainglah di"
      highlight="Level Tertinggi."
      description="Bergabunglah dengan ribuan pemain dan tim yang bertanding di turnamen regional terverifikasi dengan sistem anti-cheat"
    >
      <div className="login-page">
        <button
          type="button"
          className="login-back"
          onClick={() => navigate("/")}
          aria-label="Tutup"
        >
          <Icon name="x" size={20} />{" "}
        </button>
      </div>
      <h2 className="auth-title">Selamat datang kembali</h2>
      <p className="auth-subtitle">login untuk melanjutkan ke turnamen anda.</p>

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Email"
          icon="mail"
          name="email"
          type="email"
          placeholder="Masukkan Email Anda"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
          autoComplete="email"
        />

        <FormField
          label="Password"
          icon="lock"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••••••"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          autoComplete="current-password"
          right={toggleButton}
        />

        {message && <p className="auth-error">{message}</p>}

        <button
          type="submit"
          className="btn btn-primary btn-block auth-submit"
          disabled={loading}
        >
          {loading ? "Memproses..." : "Login"}
          {!loading && <Icon name="arrow-right" size={16} />}
        </button>
      </form>

      <p className="auth-switch">
        Tidak punya akun?{" "}
        <Link to="/register">
          Buat Akun <Icon name="external-link" size={12} />
        </Link>
      </p>
    </AuthShell>
  );
}

export default Login;
