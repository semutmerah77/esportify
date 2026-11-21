import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell";
import FormField from "../components/auth/FormField";
import Icon from "../components/icon";
import { register } from "../services/authApi";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Nama field backend -> nama field di form
const fieldMap = {
  password_confirmation: "confirmPassword",
};

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Validasi klien
  const usernameValid = form.username.trim().length >= 3;
  const emailValid = emailPattern.test(form.email);
  const passwordValid = form.password.length >= 8;
  const confirmFilled = form.confirmPassword.length > 0;
  const passwordMatch = confirmFilled && form.password === form.confirmPassword;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));

    setMessage("");
  };

  const validate = () => {
    const result = {};

    if (!usernameValid) {
      result.username = "Username minimal 3 karakter.";
    }

    if (!emailValid) {
      result.email = "Format email tidak valid.";
    }

    if (!passwordValid) {
      result.password = "Password minimal 8 karakter.";
    }

    if (!passwordMatch) {
      result.confirmPassword = "Konfirmasi password tidak sama.";
    }

    return result;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    const result = validate();

    if (Object.keys(result).length > 0) {
      setErrors(result);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await register(form);
      navigate("/login");
    } catch (err) {
      const fieldErrors = {};

      Object.entries(err.fields || {}).forEach(([key, value]) => {
        fieldErrors[fieldMap[key] || key] = Array.isArray(value)
          ? value[0]
          : value;
      });

      setErrors(fieldErrors);

      if (Object.keys(fieldErrors).length > 0) {
        setMessage("Periksa kembali data yang kamu isi.");
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
      onClick={() => setShowPassword((prev) => !prev)}
      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
    >
      <Icon name={showPassword ? "eye-off" : "eye"} size={16} />
    </button>
  );

  return (
    <AuthShell
      heading="Mulailah Perjalanan"
      highlight="Esports Anda."
      description="Arena Digital yang telah teruji untuk para peserta individu dan organisasi. bersaing, dan raih kemenangan!"
    >
      <div className="register-page">
        {/* Tombol Batal di kiri atas */}
        <button
          type="button"
          className="register-back"
          onClick={() => navigate("/")}
          aria-label="Tutup"
        >
          <Icon name="x" size={20} />{" "}
        </button>

        <h2 className="auth-title">Buat Akun</h2>

        <p className="auth-subtitle">
          Bergabunglah dengan ESPORTIFY sebagai pemain Kompetitif
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <FormField
            label="Username"
            icon="gamepad"
            name="username"
            type="text"
            placeholder="Masukkan Username Anda"
            value={form.username}
            onChange={handleChange}
            error={errors.username}
            autoComplete="username"
            right={usernameValid && <Icon name="badge-check" size={16} />}
          />

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
            right={emailValid && <Icon name="check" size={16} />}
          />

          <FormField
            label="Password"
            hint="Min. 8 Karakter"
            icon="lock"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            autoComplete="new-password"
            right={toggleButton}
          />

          <FormField
            label="Konfirmasi Password"
            icon="lock"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={form.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
            autoComplete="new-password"
            right={passwordMatch && <Icon name="check-check" size={16} />}
          />

          {confirmFilled && (
            <p className={passwordMatch ? "field-ok" : "field-error"}>
              {passwordMatch ? (
                <>
                  <Icon name="check" size={12} />
                  Password sesuai
                </>
              ) : (
                "Password belum sama"
              )}
            </p>
          )}

          {message && <p className="auth-error">{message}</p>}

          {/* Hanya satu tombol: Buat Akun full-width */}
          <div className="auth-form-actions">
            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={loading}
            >
              {loading ? "Memproses..." : "Buat Akun"}
              {!loading && <Icon name="arrow-right" size={16} />}
            </button>
          </div>
        </form>

        <p className="auth-switch">
          Sudah punya akun?{" "}
          <Link to="/login">
            Login <Icon name="login" size={12} />
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default Register;
