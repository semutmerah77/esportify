import { useEffect, useRef, useState } from "react";
import Icon from "../icon";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const extOf = (name = "") =>
  (name.split(".").pop() || "").toUpperCase().slice(0, 4);

// file = File baru. existing = { name, url } file lama dari backend (mode edit), url boleh null.
function UploadButton({
  label = "Upload",
  hint,
  accept = ".jpg,.jpeg,.png,.webp",
  allowedTypes = IMAGE_TYPES,
  maxMB,
  file,
  existing,
  onViewExisting,
  viewLoading = false,
  onChange,
  onError,
}) {
  const ref = useRef(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [open, setOpen] = useState(false);

  // URL pratinjau file baru hanya dibuat saat dibuka, dan selalu dilepas lagi
  useEffect(() => {
    if (!open || !file) return undefined;
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setBlobUrl(null);
    };
  }, [open, file]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleFile = (e) => {
    const picked = e.target.files[0];
    e.target.value = "";
    if (!picked) return;
    if (!allowedTypes.includes(picked.type)) {
      onError("Format file tidak didukung.");
      return;
    }
    if (picked.size > maxMB * 1024 * 1024) {
      onError(`Ukuran file maksimal ${maxMB} MB.`);
      return;
    }
    onError("");
    onChange(picked);
  };

  const name = file ? file.name : existing?.name;
  const hasFile = Boolean(file || existing);
  const src = file ? blobUrl : existing?.url;
  const canView = Boolean(file || existing?.url || onViewExisting);
  const isPdf = file?.type === "application/pdf";

  return (
    <div className="t-upload">
      {hasFile ? (
        <div className="t-file-row">
          <span className="t-file-icon">
            <Icon name="file-image" size={26} />
            <b>{extOf(name)}</b>
          </span>
          <span className="t-file-name" title={name}>
            {name}
          </span>
          <div className="t-file-actions">
            {existing ? (
              <button
                type="button"
                className="t-pill"
                onClick={() => ref.current.click()}
              >
                <Icon name="upload" size={14} /> Ganti
              </button>
            ) : (
              <button
                type="button"
                className="t-pill danger"
                onClick={() => onChange(null)}
              >
                <Icon name="trash" size={14} /> Hapus
              </button>
            )}
            <button
              type="button"
              className="t-pill"
              disabled={!canView || viewLoading}
              title={canView ? "Lihat" : "File ini bersifat privat"}
              onClick={() =>
                !file && !existing?.url && onViewExisting
                  ? onViewExisting()
                  : setOpen(true)
              }
            >
              {viewLoading ? "Memuat..." : "Lihat"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="t-upload-btn"
          onClick={() => ref.current.click()}
        >
          <Icon name="upload" size={18} /> {label}
        </button>
      )}

      {hint && <p className="t-upload-hint">{hint}</p>}
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={handleFile}
      />

      {open && canView && (
        <div className="t-preview-backdrop" onMouseDown={() => setOpen(false)}>
          <div
            className="t-preview"
            role="dialog"
            aria-modal="true"
            aria-label="Pratinjau file"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="t-preview-head">
              <span title={name}>{name}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
              >
                <Icon name="x" size={20} />
              </button>
            </div>
            {src && isPdf && (
              <iframe
                title="Pratinjau PDF"
                src={src}
                className="t-preview-pdf"
              />
            )}
            {src && !isPdf && <img src={src} alt={`Pratinjau ${name}`} />}
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadButton;
