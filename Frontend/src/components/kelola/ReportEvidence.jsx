import { useEffect, useState } from "react";
import { fetchEvidenceObjectUrl } from "../../services/matchReportApi";
import ReportIcon from "./ReportIcon";
import "../../styles/match-report.css";

// Penampil bukti (gambar). Bukti dari server perlu token -> diambil sebagai blob.
// source: { url } untuk bukti di server, atau { file } untuk file yang baru dipilih.
export function EvidenceViewer({ name, source, onClose }) {
  const [state, setState] = useState({ src: "", error: "" });

  useEffect(() => {
    let off = false;
    let objectUrl = "";
    setState({ src: "", error: "" });
    const task = source.file
      ? Promise.resolve(URL.createObjectURL(source.file))
      : fetchEvidenceObjectUrl(source.url);
    task
      .then((u) => {
        objectUrl = u;
        if (off) URL.revokeObjectURL(u);
        else setState({ src: u, error: "" });
      })
      .catch(
        (err) =>
          !off &&
          setState({ src: "", error: err.message || "Bukti gagal dimuat." }),
      );
    return () => {
      off = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source.file, source.url]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="rp-ov rp-ov-top"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="rp-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={name}
      >
        <header>
          <b title={name}>{name}</b>
          <button
            type="button"
            className="rp-x"
            aria-label="Tutup"
            onClick={onClose}
          >
            <ReportIcon name="x" size={18} />
          </button>
        </header>
        <div className="rp-viewer-body">
          {state.src && <img src={state.src} alt={name} />}
          {state.error && <p className="rp-err">{state.error}</p>}
          {!state.src && !state.error && (
            <div className="rp-skel rp-viewer-skel" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
}

// Satu baris bukti.
// variant "tile": ikon gambar di kotak (tampilan pemain); "chip": label JPG/PNG (tampilan penyelenggara)
export function EvidenceRow({
  name,
  type,
  variant = "tile",
  onView,
  onRemove,
  disabled,
}) {
  return (
    <div className={`rp-evi ${variant}`}>
      {variant === "tile" ? (
        <span className="rp-evi-ic">
          <ReportIcon name="image" size={16} />
        </span>
      ) : (
        <span className={`rp-evi-type ${String(type).toLowerCase()}`}>
          {type}
        </span>
      )}
      <span className="rp-evi-name" title={name}>
        {name}
      </span>
      {onRemove && (
        <button
          type="button"
          className="rp-evi-btn danger"
          disabled={disabled}
          onClick={onRemove}
        >
          Hapus
        </button>
      )}
      <button
        type="button"
        className="rp-evi-btn"
        disabled={disabled}
        onClick={onView}
      >
        Lihat
      </button>
    </div>
  );
}
