import { useEffect, useRef, useState } from "react";
import RefundIcon from "./RefundIcon";
import EvidencePreviewDialog from "../kelola/EvidencePreviewDialog";
import "../../styles/match-report.css";
import "../../styles/refund.css";
import { cancellationFieldErrors } from "../../services/tournamentCancellationApi";
import {
  QRIS_EXTENSIONS,
  REFUND_COUNTDOWN_SECONDS,
  REFUND_FILE_MAX_BYTES,
  REFUND_METHOD_QRIS,
  REFUND_METHOD_TRANSFER,
  REFUND_TEXT_MAX,
  submitParticipantRefund,
} from "../../services/refundApi";

const METHOD_INFO = {
  [REFUND_METHOD_TRANSFER]: { label: "Nomor rekening", icon: "bank" },
  [REFUND_METHOD_QRIS]: { label: "QRIS", icon: "qr" },
};
const extensionOf = (file) => String(file.name).split(".").pop().toLowerCase();

// Formulir pengembalian dana (peserta pendaftar). Dikirim lewat dialog "Periksa kembali data";
// tombol kirim di dialog baru aktif setelah hitung mundur 10 detik (keputusan SA).
// methods: [{ code, label }] dari meta.pilihan_metode_refund (kosong = pakai kedua metode).
function RefundForm({ tournamentId, methods, onSubmitted }) {
  const fileInput = useRef(null);
  const available = methods?.length
    ? methods.map((m) => m.code).filter((code) => METHOD_INFO[code])
    : [REFUND_METHOD_TRANSFER, REFUND_METHOD_QRIS];

  const [method, setMethod] = useState(available[0] ?? REFUND_METHOD_TRANSFER);
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [qrisFile, setQrisFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [seconds, setSeconds] = useState(REFUND_COUNTDOWN_SECONDS);
  const [sending, setSending] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [qrisPreview, setQrisPreview] = useState("");
  const [preview, setPreview] = useState(null); // pratinjau gambar QRIS dari tombol "Lihat"

  // Bebaskan object URL saat popup ditutup / komponen dilepas
  useEffect(() => {
    if (!preview) return undefined;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  const isTransfer = method === REFUND_METHOD_TRANSFER;

  // Hitung mundur: dimulai setiap dialog dibuka
  useEffect(() => {
    if (!confirming) return undefined;
    setSeconds(REFUND_COUNTDOWN_SECONDS);
    const timer = setInterval(
      () => setSeconds((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => clearInterval(timer);
  }, [confirming]);

  // Pratinjau gambar QRIS di dialog (object URL dibebaskan saat dialog ditutup)
  useEffect(() => {
    if (!confirming || method !== REFUND_METHOD_QRIS || !qrisFile) {
      setQrisPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(qrisFile);
    setQrisPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [confirming, method, qrisFile]);

  useEffect(() => {
    if (!confirming) return undefined;
    const onKey = (e) => e.key === "Escape" && !sending && setConfirming(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, sending]);

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!QRIS_EXTENSIONS.includes(extensionOf(file))) {
      setErrors((prev) => ({
        ...prev,
        file_qris: "Gambar QRIS harus berformat JPG, JPEG, atau PNG.",
      }));
      return;
    }
    if (file.size > REFUND_FILE_MAX_BYTES) {
      setErrors((prev) => ({
        ...prev,
        file_qris: "Ukuran gambar QRIS maksimal 2MB.",
      }));
      return;
    }
    setErrors((prev) => ({ ...prev, file_qris: "" }));
    setQrisFile(file);
  };

  const askConfirm = () => {
    const next = {};
    if (isTransfer && !accountNumber.trim())
      next.nomor_rekening = "Nama bank dan nomor rekening wajib diisi.";
    if (!holderName.trim()) next.atas_nama = "Atas nama wajib diisi.";
    if (!isTransfer && !qrisFile)
      next.file_qris = "Gambar QRIS wajib diunggah.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setDialogError("");
    setConfirming(true);
  };

  const send = async () => {
    if (seconds > 0 || sending) return;
    setSending(true);
    setDialogError("");
    try {
      const res = await submitParticipantRefund(tournamentId, {
        method,
        accountNumber,
        holderName,
        qrisFile,
      });
      setConfirming(false);
      onSubmitted(res);
    } catch (err) {
      const fields = cancellationFieldErrors(err);
      if (fields) {
        setErrors(fields); // pesan tampil di bawah field terkait
        setConfirming(false);
      } else {
        setDialogError(err.message || "Data pengembalian dana gagal dikirim.");
      }
      setSending(false);
    }
  };

  return (
    <section className="refund-card refund-form">
      <h2>Formulir Pengembalian Dana</h2>
      <p className="refund-sub">
        Masukkan informasi rekening atau QRIS tujuan pengembalian dana
        pendaftaran.
      </p>

      <label className="refund-label">
        Metode Pengembalian <em>*</em>
      </label>
      <div
        className="refund-methods"
        role="radiogroup"
        aria-label="Metode pengembalian"
      >
        {available.map((code) => (
          <label
            key={code}
            className={`refund-method ${method === code ? "on" : ""}`}
          >
            <input
              type="radio"
              name="metode-refund"
              checked={method === code}
              onChange={() => {
                setMethod(code);
                setErrors({});
              }}
            />
            <i />
            <RefundIcon name={METHOD_INFO[code].icon} size={16} />
            <span>{METHOD_INFO[code].label}</span>
          </label>
        ))}
      </div>
      {errors.metode_refund && (
        <p className="refund-err">{errors.metode_refund}</p>
      )}

      {isTransfer && (
        <>
          <label className="refund-label" htmlFor="refund-account">
            Nama bank dan nomor rekening <em>*</em>
          </label>
          <input
            id="refund-account"
            type="text"
            className={`refund-input ${errors.nomor_rekening ? "err" : ""}`}
            maxLength={REFUND_TEXT_MAX}
            placeholder="Masukkan nama bank dan nomor rekening tujuan, contoh: ABC - 098931211"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
          {errors.nomor_rekening && (
            <p className="refund-err">{errors.nomor_rekening}</p>
          )}
        </>
      )}

      <label className="refund-label" htmlFor="refund-holder">
        Atas nama <em>*</em>
      </label>
      <input
        id="refund-holder"
        type="text"
        className={`refund-input ${errors.atas_nama ? "err" : ""}`}
        maxLength={REFUND_TEXT_MAX}
        placeholder="Nama lengkap pemilik rekening sesuai buku tabungan"
        value={holderName}
        onChange={(e) => setHolderName(e.target.value)}
      />
      {errors.atas_nama && <p className="refund-err">{errors.atas_nama}</p>}

      {!isTransfer && (
        <>
          {qrisFile ? (
            <div className="refund-file picked">
              <span className="refund-file-ic">
                <RefundIcon name="image" size={16} />
              </span>
              <span className="refund-file-name" title={qrisFile.name}>
                {qrisFile.name}
              </span>
              <button
                type="button"
                className="refund-view-btn danger"
                onClick={() => setQrisFile(null)}
              >
                Hapus
              </button>
              <button
                type="button"
                className="refund-view-btn"
                onClick={() =>
                  setPreview({
                    name: qrisFile.name,
                    kind: "gambar",
                    url: URL.createObjectURL(qrisFile),
                  })
                }
              >
                Lihat
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="refund-upload-btn"
              onClick={() => fileInput.current?.click()}
            >
              <RefundIcon name="upload" size={15} /> Unggah
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            hidden
            accept=".jpg,.jpeg,.png"
            onChange={pickFile}
          />
          {errors.file_qris && <p className="refund-err">{errors.file_qris}</p>}
        </>
      )}
      {errors.konfirmasi && <p className="refund-err">{errors.konfirmasi}</p>}

      <div className="refund-actions">
        <button type="button" className="refund-send" onClick={askConfirm}>
          <RefundIcon name="send" size={15} /> Kirim
        </button>
      </div>

      {preview && (
        <EvidencePreviewDialog {...preview} onClose={() => setPreview(null)} />
      )}

      {confirming && (
        <div
          className="rp-ov"
          onMouseDown={(e) =>
            e.target === e.currentTarget && !sending && setConfirming(false)
          }
        >
          <div
            className="rp-dialog refund-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-confirm-title"
          >
            <span className="refund-confirm-ic">
              <RefundIcon name="warn" size={26} />
            </span>
            <h2 id="refund-confirm-title">
              Periksa kembali data pengembalian dana
            </h2>
            <p className="refund-confirm-sub">
              Pastikan data di bawah sudah benar. Data tidak dapat diubah
              setelah dikirim.
            </p>

            <div className="refund-summary">
              <div>
                <small>Metode pengembalian</small>
                <b className="icon">
                  <RefundIcon name={METHOD_INFO[method].icon} size={15} />{" "}
                  {METHOD_INFO[method].label}
                </b>
              </div>
              {isTransfer ? (
                <div>
                  <small>Nama bank dan nomor rekening</small>
                  <b className="big">{accountNumber.trim()}</b>
                </div>
              ) : (
                <div>
                  <small>Gambar QRIS</small>
                  <div className="refund-qris-preview">
                    {qrisPreview && <img src={qrisPreview} alt="QRIS" />}
                    <span>{qrisFile?.name}</span>
                  </div>
                </div>
              )}
              <div>
                <small>Atas nama</small>
                <b className="icon">
                  <span className="refund-blue">
                    <RefundIcon name="user" size={15} />
                  </span>{" "}
                  {holderName.trim()}
                </b>
              </div>
            </div>

            <p className="refund-confirm-warn">
              <RefundIcon name="info" size={15} />
              <span>
                Kesalahan data dapat membuat dana tidak sampai. Jika ada
                kesalahan, tekan Kembali untuk memperbaiki.
              </span>
            </p>

            {dialogError && <p className="refund-err center">{dialogError}</p>}
            <div className="refund-confirm-actions">
              <button
                type="button"
                className="refund-btn dim"
                disabled={sending}
                onClick={() => setConfirming(false)}
              >
                Kembali
              </button>
              <button
                type="button"
                className="refund-btn primary"
                disabled={seconds > 0 || sending}
                onClick={send}
              >
                {sending
                  ? "Mengirim..."
                  : seconds > 0
                    ? `Kirim data (${seconds})`
                    : "Kirim data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default RefundForm;
