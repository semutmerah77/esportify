import { useEffect, useRef, useState } from "react";
import CancellationIcon from "./CancellationIcon";
import EvidencePreviewDialog from "./EvidencePreviewDialog";
import {
  EVIDENCE_EXTENSIONS,
  EVIDENCE_MAX_BYTES,
  EXPLANATION_MAX,
  cancellationFieldErrors,
  submitTournamentCancellation,
} from "../../services/tournamentCancellationApi";
import "../../styles/match-report.css";
import "../../styles/tournament-cancellation.css";

const extensionOf = (file) => String(file.name).split(".").pop().toLowerCase();

// Form pengajuan pembatalan (penyelenggara). Dikirim lewat popup konfirmasi.
// info: { reasons, refundRequired, refundEarliest } dari GET .../pembatalan
function CancellationForm({
  tournamentId,
  tournamentName,
  info,
  onCancel,
  onSubmitted,
}) {
  const fileInput = useRef(null);
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [files, setFiles] = useState([]);
  const [refundDate, setRefundDate] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [preview, setPreview] = useState(null); // { name, kind, url }

  const selected = info.reasons.find((r) => r.code === reason);
  const evidenceRequired = selected?.evidenceRequired === true;
  const refundMissing = info.refundRequired && !refundDate;
  const canSubmit =
    Boolean(reason) &&
    explanation.trim().length > 0 &&
    confirmed &&
    (!evidenceRequired || files.length > 0) &&
    !refundMissing;

  // Bebaskan object URL pratinjau saat popup ditutup / form dilepas
  useEffect(() => {
    if (!preview) return undefined;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  useEffect(() => {
    if (!confirming) return undefined;
    const onKey = (e) => e.key === "Escape" && !sending && setConfirming(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, sending]);

  const pickFiles = (e) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    const accepted = [];
    let problem = "";
    picked.forEach((file) => {
      if (!EVIDENCE_EXTENSIONS.includes(extensionOf(file)))
        problem = "Format bukti harus JPG, JPEG, PNG, atau PDF.";
      else if (file.size > EVIDENCE_MAX_BYTES)
        problem = "Ukuran setiap bukti maksimal 2MB.";
      else accepted.push(file);
    });
    setFiles((prev) => [...prev, ...accepted]);
    setErrors((prev) => ({ ...prev, bukti: problem }));
  };

  const removeFile = (index) =>
    setFiles((prev) => prev.filter((_, i) => i !== index));

  const previewFile = (file) =>
    setPreview({
      name: file.name,
      kind: extensionOf(file) === "pdf" ? "pdf" : "gambar",
      url: URL.createObjectURL(file),
    });

  const askConfirm = () => {
    if (!canSubmit || sending) return;
    if (
      info.refundRequired &&
      info.refundEarliest &&
      refundDate < info.refundEarliest
    ) {
      setErrors((prev) => ({
        ...prev,
        rencana_pengembalian_dana:
          "Tanggal pengembalian dana belum memenuhi batas paling cepat.",
      }));
      return;
    }
    setErrors({});
    setDialogError("");
    setConfirming(true);
  };

  const send = async () => {
    setSending(true);
    setDialogError("");
    try {
      const res = await submitTournamentCancellation(tournamentId, {
        reason,
        explanation,
        refundDate: info.refundRequired ? refundDate : "",
        files,
      });
      setConfirming(false);
      onSubmitted(res);
    } catch (err) {
      const fields = cancellationFieldErrors(err);
      if (fields) {
        setErrors(fields); // pesan tampil di bawah field terkait
        setConfirming(false);
      } else {
        setDialogError(err.message || "Pengajuan gagal dikirim.");
      }
      setSending(false);
    }
  };

  return (
    <div className="cancel-card">
      <div className="cancel-warning" role="note">
        <CancellationIcon name="warn" size={20} />
        <span>
          <b>PERHATIAN PEMBATALAN:</b> Pembatalan perlu disetujui admin dan
          tidak dapat dibatalkan setelah disetujui.
        </span>
      </div>

      <h3 className="cancel-label">
        Alasan pembatalan <em>*</em>
      </h3>
      <div
        className="cancel-radios"
        role="radiogroup"
        aria-label="Alasan pembatalan"
      >
        {info.reasons.map((r) => (
          <label
            key={r.code}
            className={`cancel-radio ${reason === r.code ? "on" : ""}`}
          >
            <input
              type="radio"
              name="alasan-pembatalan"
              checked={reason === r.code}
              onChange={() => setReason(r.code)}
            />
            <i />
            <span>{r.label}</span>
          </label>
        ))}
      </div>
      {errors.alasan_pembatalan && (
        <p className="cancel-err">{errors.alasan_pembatalan}</p>
      )}

      <h3 className="cancel-label">
        Penjelasan detail <em>*</em>
      </h3>
      <div className="cancel-textwrap">
        <textarea
          className={`cancel-textarea ${errors.penjelasan_pembatalan ? "err" : ""}`}
          placeholder="Jelaskan apa yang terjadi, kapan kejadiannya, dan apa yang sudah kamu lakukan sebelum memutuskan membatalkan."
          maxLength={EXPLANATION_MAX}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
        <span className="cancel-count">
          {explanation.length}/{EXPLANATION_MAX}
        </span>
      </div>
      {errors.penjelasan_pembatalan && (
        <p className="cancel-err">{errors.penjelasan_pembatalan}</p>
      )}

      <h3 className="cancel-label">
        Bukti pendukung ({evidenceRequired ? "wajib" : "opsional"})
      </h3>
      <div className="cancel-upload">
        {files.map((file, index) => (
          <div className="cancel-file" key={`${file.name}-${index}`}>
            <span className="cancel-file-ic">
              <CancellationIcon
                name={extensionOf(file) === "pdf" ? "file" : "image"}
                size={16}
              />
            </span>
            <span className="cancel-file-name" title={file.name}>
              {file.name}
            </span>
            <button
              type="button"
              className="cancel-mini danger"
              onClick={() => removeFile(index)}
            >
              Hapus
            </button>
            <button
              type="button"
              className="cancel-mini"
              onClick={() => previewFile(file)}
            >
              Lihat
            </button>
          </div>
        ))}
        <button
          type="button"
          className="cancel-upload-btn"
          onClick={() => fileInput.current?.click()}
        >
          <CancellationIcon name="upload" size={16} /> Unggah bukti
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          multiple
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={pickFiles}
        />
        <small>Format JPG, JPEG, PNG atau PDF (maks. 2MB per berkas)</small>
      </div>
      {errors.bukti && <p className="cancel-err">{errors.bukti}</p>}

      {info.refundRequired && (
        <section className="cancel-refund">
          <h3>
            <CancellationIcon name="wallet" size={18} /> Rencana Pengembalian
            dana <em>*</em>
          </h3>
          <p>
            Setelah pembatalan disetujui, peserta akan diminta mengisi data
            rekening atau QRIS untuk menerima pengembalian dana. Kamu dapat
            memantau dan memprosesnya melalui tab <b>Pengembalian Dana</b> di
            Kelola Turnamen.
          </p>
          <label htmlFor="cancel-refund-date">
            Estimasi tanggal pengembalian dana
          </label>
          <input
            id="cancel-refund-date"
            type="date"
            className={`cancel-date ${errors.rencana_pengembalian_dana ? "err" : ""}`}
            min={info.refundEarliest || undefined}
            value={refundDate}
            onChange={(e) => setRefundDate(e.target.value)}
          />
          {errors.rencana_pengembalian_dana && (
            <p className="cancel-err">{errors.rencana_pengembalian_dana}</p>
          )}
        </section>
      )}

      <label className="cancel-agree">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          Saya memahami bahwa pembatalan akan diberitahukan ke seluruh peserta
          dan tidak dapat dibatalkan setelah disetujui admin.
        </span>
      </label>
      {errors.konfirmasi && <p className="cancel-err">{errors.konfirmasi}</p>}

      <div className="cancel-actions">
        <button type="button" className="cancel-btn ghost" onClick={onCancel}>
          Batal
        </button>
        <button
          type="button"
          className="cancel-btn primary"
          disabled={!canSubmit}
          onClick={askConfirm}
        >
          Kirim pengajuan
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
            className="rp-dialog cancel-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-confirm-title"
          >
            <span className="cancel-confirm-ic">
              <CancellationIcon name="warn" size={26} />
            </span>
            <h2 id="cancel-confirm-title">
              Ajukan pembatalan {tournamentName}?
            </h2>
            <p className="cancel-confirm-text">
              Pengajuan akan dikirim ke admin. Peserta akan diberi tahu setelah
              pembatalan disetujui.
            </p>
            <ul className="cancel-confirm-notes">
              <li>
                <CancellationIcon name="clock" size={14} /> Estimasi review
                admin sekitar 4 hari kerja
              </li>
              <li>
                <CancellationIcon name="info" size={14} /> Pengajuan tidak dapat
                diedit. Jika ditolak, kamu bisa mengajukan ulang dari awal.
              </li>
            </ul>
            {dialogError && <p className="rp-err">{dialogError}</p>}
            <div className="cancel-confirm-actions">
              <button
                type="button"
                className="cancel-btn dim"
                disabled={sending}
                onClick={() => setConfirming(false)}
              >
                Kembali
              </button>
              <button
                type="button"
                className="cancel-btn primary"
                disabled={sending}
                onClick={send}
              >
                {sending ? "Mengirim..." : "Ya, ajukan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CancellationForm;
