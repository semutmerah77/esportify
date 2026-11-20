import { useEffect, useState } from "react";
import RefundIcon from "./RefundIcon";
import EvidencePreviewDialog from "../kelola/EvidencePreviewDialog";
import { fetchProtectedFileUrl } from "../../services/tournamentCancellationApi";
import "../../styles/refund.css";

// Baris berkas privat (gambar QRIS / bukti transfer). Berkas baru diambil saat "Lihat" ditekan,
// lalu tampil di popup. kind: "gambar" | "pdf".
function RefundFileRow({ label, url, kind = "gambar", compact = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null); // { name, kind, url }

  // Bebaskan object URL saat popup ditutup / komponen dilepas
  useEffect(() => {
    if (!preview) return undefined;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  const open = async () => {
    setBusy(true);
    setError("");
    try {
      const file = await fetchProtectedFileUrl(url);
      setPreview({
        name: label,
        kind: file.isPdf || kind === "pdf" ? "pdf" : "gambar",
        url: file.url,
      });
    } catch (err) {
      setError(err.message || "Berkas tidak dapat dibuka.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className={`refund-file ${compact ? "compact" : ""}`}>
        <span className="refund-file-ic">
          <RefundIcon name={kind === "pdf" ? "file" : "image"} size={16} />
        </span>
        <span className="refund-file-name">{label}</span>
        <button
          type="button"
          className="refund-view-btn"
          disabled={busy}
          onClick={open}
        >
          {busy ? "Membuka..." : "Lihat"}
        </button>
      </div>
      {error && <p className="refund-err">{error}</p>}
      {preview && (
        <EvidencePreviewDialog {...preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

export default RefundFileRow;
