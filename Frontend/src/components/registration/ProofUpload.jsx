import { useEffect, useRef, useState } from "react";
import Icon from "../icon";
import FilePreview from "../tournament/FilePreview";

const typeLabel = (file) => {
  if (file.type === "application/pdf") return "PDF";
  if (file.type === "image/png") return "PNG";
  return "JPG";
};

// Area unggah bukti pembayaran: tombol Upload, lalu baris file dengan Hapus dan Lihat.
// Lihat membuka popup FilePreview yang sama dengan halaman pengajuan turnamen.
// onSelect(file) : validasi dilakukan oleh halaman. onRemove() : kosongkan pilihan.
function ProofUpload({ file, onSelect, onRemove }) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [viewing, setViewing] = useState(false);

  // Pratinjau lokal dari file yang dipilih, dibebaskan saat file berganti / unmount
  useEffect(() => {
    setViewing(false);
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleChange = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onSelect(f);
  };

  return (
    <div className="tr-upframe">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        onChange={handleChange}
        hidden
      />

      {file ? (
        <div className="tr-filerow">
          <span className="tr-fileicon">
            <Icon name="file-image" size={26} />
            <b>{typeLabel(file)}</b>
          </span>
          <span className="tr-filename" title={file.name}>
            {file.name}
          </span>
          <div className="tr-fileactions">
            <button
              type="button"
              className="tr-pillbtn danger"
              onClick={onRemove}
            >
              <Icon name="trash" size={14} /> Hapus
            </button>
            <button
              type="button"
              className="tr-pillbtn"
              disabled={!previewUrl}
              onClick={() => setViewing(true)}
            >
              Lihat
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="tr-upbtn"
          onClick={() => inputRef.current?.click()}
        >
          <Icon name="upload" size={18} /> Upload
        </button>
      )}

      <p className="tr-uphint">
        JPG, PNG, atau PDF • maks 2 MB. Pastikan bukti pembayaran terbaca jelas.
      </p>

      {viewing && file && previewUrl && (
        <FilePreview
          file={{ url: previewUrl, name: file.name, type: file.type }}
          onClose={() => setViewing(false)}
        />
      )}
    </div>
  );
}

export default ProofUpload;
