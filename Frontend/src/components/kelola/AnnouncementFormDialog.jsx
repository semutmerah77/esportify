import { useEffect, useRef, useState } from "react";
import AnnouncementIcon from "./AnnouncementIcon";
import "../../styles/match-report.css";
import "../../styles/announcement.css";

const TITLE_MAX = 150;
const BODY_MAX = 5000;

// Dialog "Buat pengumuman" / "Edit pengumuman".
// initial: { title, body } (mode edit) | onSubmit: ({ title, body }) => Promise (lempar Error kalau gagal)
// onCancel: dipanggil saat Batal / X / Esc / klik luar (mode edit: panel membatalkan sesi edit di BE)
function AnnouncementFormDialog({ mode, initial, onSubmit, onCancel }) {
  const editing = mode === "edit";
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false); // sesi edit berakhir -> simpan dinonaktifkan
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const filled = title.trim() !== "" && body.trim() !== "";

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setError("Judul pengumuman wajib diisi.");
    if (!body.trim()) return setError("Isi pengumuman wajib diisi.");
    setBusy(true);
    setError("");
    try {
      await onSubmit({ title, body });
    } catch (err) {
      const message = err.message || "Pengumuman gagal disimpan. Coba lagi.";
      setError(message);
      if (/sesi edit sudah berakhir/i.test(message)) setLocked(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rp-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <form
        className="rp-dialog an-form-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="an-form-title"
        onSubmit={submit}
        noValidate
      >
        <header className="an-form-head">
          <h2 id="an-form-title">
            {editing ? "Edit pengumuman" : "Buat pengumuman"}
          </h2>
          <button
            type="button"
            className="rp-x"
            aria-label="Tutup"
            disabled={busy}
            onClick={onCancel}
          >
            <AnnouncementIcon name="x" size={18} />
          </button>
        </header>
        <p className="an-form-sub">
          {editing
            ? "Ubah judul atau isi pengumuman. Keduanya wajib diisi."
            : "Isi judul dan isi pengumuman. Keduanya wajib diisi."}
        </p>

        <label className="an-label" htmlFor="an-title">
          Judul <span className="rp-req">*</span>
        </label>
        <div className="an-field">
          <input
            id="an-title"
            ref={titleRef}
            type="text"
            maxLength={TITLE_MAX}
            placeholder="Contoh: Perubahan jadwal babak penyisihan"
            value={title}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
          />
          <em className="an-count">
            {title.length}/{TITLE_MAX}
          </em>
        </div>

        <label className="an-label" htmlFor="an-body">
          Isi pengumuman <span className="rp-req">*</span>
        </label>
        <div className="an-field area">
          <textarea
            id="an-body"
            rows={6}
            maxLength={BODY_MAX}
            placeholder="Tulis isi pengumuman. Link akan otomatis bisa diklik."
            value={body}
            disabled={busy}
            onChange={(e) => setBody(e.target.value)}
          />
          <em className="an-count">
            {body.length}/{BODY_MAX}
          </em>
        </div>

        {error && <p className="rp-err">{error}</p>}

        <div className="rp-actions">
          <button
            type="button"
            className="rp-btn ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Batal
          </button>
          <button
            type="submit"
            className="rp-btn primary"
            disabled={busy || locked || !filled}
          >
            <AnnouncementIcon name={editing ? "check" : "send"} size={15} />
            {editing ? "Simpan perubahan" : "Kirim"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AnnouncementFormDialog;
