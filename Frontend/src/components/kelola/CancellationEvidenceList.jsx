import { useEffect, useState } from "react";
import CancellationIcon from "./CancellationIcon";
import EvidencePreviewDialog from "./EvidencePreviewDialog";
import { fetchProtectedFileUrl } from "../../services/tournamentCancellationApi";
import "../../styles/tournament-cancellation.css";

// Daftar bukti pendukung yang sudah tersimpan di server (privat).
// Berkas hanya diambil saat "Lihat" ditekan, lalu ditampilkan di popup.
function CancellationEvidenceList({ items }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null); // { name, kind, url }

  // Bebaskan object URL saat popup ditutup / komponen dilepas
  useEffect(() => {
    if (!preview) return undefined;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  const open = async (item) => {
    setBusyId(item.id);
    setError("");
    try {
      const file = await fetchProtectedFileUrl(item.url);
      setPreview({
        name: item.name,
        kind: file.isPdf || item.kind === "pdf" ? "pdf" : "gambar",
        url: file.url,
      });
    } catch (err) {
      setError(err.message || "Berkas tidak dapat dibuka.");
    } finally {
      setBusyId(null);
    }
  };

  if (!items?.length) return null;
  return (
    <div>
      <ul className="cancel-files">
        {items.map((item) => (
          <li key={item.id} className="cancel-file">
            <span className="cancel-file-ic">
              <CancellationIcon
                name={item.kind === "pdf" ? "file" : "image"}
                size={16}
              />
            </span>
            <span className="cancel-file-name" title={item.name}>
              {item.name}
            </span>
            <button
              type="button"
              className="cancel-mini"
              disabled={busyId === item.id}
              onClick={() => open(item)}
            >
              {busyId === item.id ? "Membuka..." : "Lihat"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="cancel-err">{error}</p>}
      {preview && (
        <EvidencePreviewDialog {...preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

export default CancellationEvidenceList;
