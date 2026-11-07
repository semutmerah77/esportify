import { useEffect, useRef, useState } from "react";
import Icon from "../icon";
import { createSquad } from "../../services/squadApi";

const NAME_MAX = 30;
const DESC_MAX = 100;
const LOGO_MAX = 2 * 1024 * 1024;
const LOGO_TYPES = ["image/jpeg", "image/png"];

function CreateSquadModal({ onClose, onCreated }) {
  const fileRef = useRef(null);
  const [logo, setLogo] = useState(null);
  const [preview, setPreview] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const pickLogo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setErrors((p) => ({
        ...p,
        logo: "Format logo harus JPG, JPEG, atau PNG.",
      }));
      return;
    }
    if (file.size > LOGO_MAX) {
      setErrors((p) => ({ ...p, logo: "Ukuran logo maksimal 2MB." }));
      return;
    }
    setErrors((p) => ({ ...p, logo: "" }));
    setLogo(file);
    setPreview(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setErrors({ name: "Nama squad wajib diisi." });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const squad = await createSquad({
        name,
        description: desc,
        logoFile: logo,
      });
      onCreated(squad);
    } catch (err) {
      setErrors({
        [err.field || "form"]: err.message || "Gagal membuat squad.",
      });
      setSaving(false);
    }
  };

  return (
    <div
      className="sq-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <form
        className="sq-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sq-modal-title"
        onSubmit={submit}
        noValidate
      >
        <div className="sq-modal-head">
          <div>
            <h2 id="sq-modal-title">Buat Squad</h2>
            <p>Buat squad sendiri dan kumpulkan pemain untuk berkompetisi.</p>
          </div>
          <button
            type="button"
            className="sq-x"
            aria-label="Tutup"
            onClick={onClose}
            disabled={saving}
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <label className="sq-label">Logo Squad</label>
        <div className="sq-logo-pick">
          <button
            type="button"
            className="sq-logo-btn"
            onClick={() => fileRef.current?.click()}
            aria-label="Upload logo squad"
          >
            {preview ? (
              <img src={preview} alt="Pratinjau logo" />
            ) : (
              <>
                <Icon name="image" size={22} />
                <span>Upload Logo</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png"
            hidden
            onChange={pickLogo}
          />
          <div className="sq-logo-hint">
            <b>Pilih format gambar profil squad</b>
            <span>JPG, JPEG, atau PNG (Maks. 2MB)</span>
            <span>Ukuran disarankan 1:1 (persegi)</span>
          </div>
        </div>
        {errors.logo && <p className="sq-err">{errors.logo}</p>}

        <div className="sq-label-row">
          <label className="sq-label" htmlFor="sq-name">
            Nama Squad
          </label>
          <span>Maks. {NAME_MAX} karakter</span>
        </div>
        <input
          id="sq-name"
          className={`sq-input ${errors.name ? "err" : ""}`}
          placeholder="Masukkan nama squad"
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {errors.name && <p className="sq-err">{errors.name}</p>}

        <div className="sq-label-row">
          <label className="sq-label" htmlFor="sq-desc">
            Deskripsi Squad
          </label>
          <span>
            {desc.length} / {DESC_MAX} karakter
          </span>
        </div>
        <textarea
          id="sq-desc"
          className="sq-input sq-textarea"
          placeholder="Ceritakan tentang squad kamu..."
          maxLength={DESC_MAX}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />

        {errors.form && <p className="sq-err">{errors.form}</p>}

        <div className="sq-modal-actions">
          <button
            type="button"
            className="sq-btn ghost"
            onClick={onClose}
            disabled={saving}
          >
            Batal
          </button>
          <button type="submit" className="sq-btn primary" disabled={saving}>
            <Icon name="plus" size={14} />{" "}
            {saving ? "Membuat..." : "Buat Squad"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateSquadModal;
