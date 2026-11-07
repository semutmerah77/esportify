import { useEffect, useRef, useState } from "react";
import Icon from "../icon";
import SquadLogo from "./SquadLogo";
import { updateSquad } from "../../services/squadApi";

const NAME_MAX = 30;
const DESC_MAX = 100;
const LOGO_MAX = 2 * 1024 * 1024;
const LOGO_TYPES = ["image/jpeg", "image/png"];

function EditSquadModal({ squad, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [logo, setLogo] = useState(null);
  const [preview, setPreview] = useState("");
  const [name, setName] = useState(squad.name);
  const [desc, setDesc] = useState(squad.description);
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

    const required = {};
    if (!name.trim()) required.name = "Nama Squad tidak boleh kosong.";
    if (!desc.trim())
      required.description = "Deskripsi Squad tidak boleh kosong.";
    if (Object.keys(required).length) {
      setErrors(required);
      return;
    }

    // Kirim hanya field yang berubah (field di BE opsional)
    const changes = {};
    if (name.trim() !== squad.name) changes.name = name;
    if (desc.trim() !== squad.description) changes.description = desc;
    if (logo) changes.logoFile = logo;

    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      await updateSquad(squad.squadId ?? squad.id, changes);
      onSaved();
    } catch (err) {
      setErrors(
        err.errors ?? { form: err.message || "Gagal menyimpan perubahan." },
      );
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
        aria-labelledby="sq-edit-title"
        onSubmit={submit}
        noValidate
      >
        <div className="sq-modal-head">
          <div>
            <h2 id="sq-edit-title">Edit Squad</h2>
            <p>Tingkatkan daya tarik skuad Anda</p>
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
          <div className="sq-edit-logo">
            {preview ? (
              <img src={preview} alt="Pratinjau logo" />
            ) : (
              <SquadLogo squad={squad} size={96} />
            )}
          </div>
          <div className="sq-edit-logo-side">
            <button
              type="button"
              className="sq-btn outline blue"
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload-cloud" size={16} /> Unggah
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              hidden
              onChange={pickLogo}
            />
            <span className="sq-logo-hint">
              JPG, JPEG, atau PNG (Maks. 2MB)
            </span>
          </div>
        </div>
        {errors.logo && <p className="sq-err">{errors.logo}</p>}

        <div className="sq-label-row">
          <label className="sq-label" htmlFor="sq-edit-name">
            Nama Squad
          </label>
          <span>Maks. {NAME_MAX} karakter</span>
        </div>
        <input
          id="sq-edit-name"
          className={`sq-input ${errors.name ? "err" : ""}`}
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {errors.name && <p className="sq-err">{errors.name}</p>}

        <div className="sq-label-row">
          <label className="sq-label" htmlFor="sq-edit-desc">
            Deskripsi Squad
          </label>
          <span>
            {desc.length} / {DESC_MAX} karakter
          </span>
        </div>
        <textarea
          id="sq-edit-desc"
          className={`sq-input sq-textarea ${errors.description ? "err" : ""}`}
          maxLength={DESC_MAX}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        {errors.description && <p className="sq-err">{errors.description}</p>}

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
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditSquadModal;
