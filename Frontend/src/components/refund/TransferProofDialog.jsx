import { useEffect, useRef, useState } from "react";
import RefundIcon from "./RefundIcon";
import RefundFileRow from "./RefundFileRow";
import EvidencePreviewDialog from "../kelola/EvidencePreviewDialog";
import { RefundAvatar, RefundStatusPill } from "./RefundSquadHeader";
import { cancellationFieldErrors } from "../../services/tournamentCancellationApi";
import {
  PROOF_EXTENSIONS,
  REFUND_FILE_MAX_BYTES,
  REFUND_METHOD_QRIS,
  REFUND_METHOD_TRANSFER,
  formatRupiah,
  formatShortDate,
  splitAccount,
  uploadTransferProof,
} from "../../services/refundApi";
import "../../styles/match-report.css";
import "../../styles/refund.css";

const extensionOf = (file) => String(file.name).split(".").pop().toLowerCase();

// Dialog "Proses" / "Detail" refund per squad (penyelenggara).
// canUpload = bisa_unggah_bukti dari BE. Tanpa itu dialog hanya menampilkan data (mis. status selesai).
function TransferProofDialog({ tournamentId, item, onClose, onUploaded }) {
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(null);

  const bank =
    item.method === REFUND_METHOD_TRANSFER
      ? splitAccount(item.accountNumber)
      : null;
  const canUpload = item.canUploadProof;
  const done = item.status === "selesai";

  useEffect(() => {
    const onKey = (e) =>
      e.key === "Escape" && !sending && !preview && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending, preview]);

  useEffect(() => {
    if (!preview) return undefined;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  const pickFile = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!PROOF_EXTENSIONS.includes(extensionOf(picked))) {
      setErrors({
        bukti_transfer:
          "Bukti transfer harus berformat JPG, JPEG, PNG, atau PDF.",
      });
      return;
    }
    if (picked.size > REFUND_FILE_MAX_BYTES) {
      setErrors({ bukti_transfer: "Ukuran bukti transfer maksimal 2MB." });
      return;
    }
    setErrors({});
    setFile(picked);
  };

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(bank?.number ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  const submit = async () => {
    if (!file || !confirmed || sending) return;
    setSending(true);
    setError("");
    setErrors({});
    try {
      const res = await uploadTransferProof(tournamentId, item.id, file);
      onUploaded(res);
    } catch (err) {
      const fields = cancellationFieldErrors(err);
      if (fields) setErrors(fields);
      else setError(err.message || "Bukti transfer gagal dikirim.");
      setSending(false);
    }
  };

  return (
    <div
      className="rp-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !sending && onClose()}
    >
      <div
        className="rp-dialog refund-proof"
        role="dialog"
        aria-modal="true"
        aria-label={`Refund ${item.squadName}`}
      >
        <div className="refund-proof-head">
          <RefundAvatar
            name={item.squadName}
            seed={item.squadId}
            src={item.squadLogo}
            size={44}
          />
          <div>
            <b>{item.squadName}</b>
            <small>ID: {item.squadId}</small>
          </div>
          <RefundStatusPill status={item.status} label={item.statusLabel} />
        </div>

        <p className="refund-proof-title">DATA TUJUAN TRANSFER</p>
        <dl className="refund-proof-box">
          <div>
            <dt>Metode</dt>
            <dd>
              {item.method === REFUND_METHOD_QRIS ? "QRIS" : "Nomor rekening"}
            </dd>
          </div>
          {bank && (
            <>
              <div>
                <dt>Nama bank</dt>
                <dd>{bank.bank || "-"}</dd>
              </div>
              <div>
                <dt>Nomor rekening</dt>
                <dd className="account">
                  {bank.number}
                  <button
                    type="button"
                    className="refund-copy"
                    aria-label="Salin nomor rekening"
                    onClick={copyNumber}
                  >
                    <RefundIcon name={copied ? "check" : "copy"} size={14} />
                  </button>
                </dd>
              </div>
            </>
          )}
          <div>
            <dt>Atas nama</dt>
            <dd>{item.holderName ?? "-"}</dd>
          </div>
          <div>
            <dt>Nominal</dt>
            <dd className="amount">{formatRupiah(item.amount)}</dd>
          </div>
        </dl>

        {item.method === REFUND_METHOD_QRIS && item.qrisUrl && (
          <RefundFileRow
            label="Gambar QRIS"
            url={item.qrisUrl}
            kind="gambar"
            compact
          />
        )}
        {item.submittedAt && (
          <p className="refund-proof-date">
            Data dikirim pada {formatShortDate(item.submittedAt)}.
          </p>
        )}

        <p className="refund-proof-title">BUKTI TRANSFER</p>
        {done && item.proofUrl ? (
          <>
            <RefundFileRow
              label="Bukti transfer"
              url={item.proofUrl}
              kind={item.proofKind === "pdf" ? "pdf" : "gambar"}
              compact
            />
            {item.refundedAt && (
              <p className="refund-proof-date">
                Bukti diunggah pada {formatShortDate(item.refundedAt)}.
              </p>
            )}
          </>
        ) : canUpload ? (
          <>
            {file ? (
              <div className="refund-file picked">
                <span className="refund-file-ic">
                  <RefundIcon
                    name={extensionOf(file) === "pdf" ? "file" : "image"}
                    size={16}
                  />
                </span>
                <span className="refund-file-name" title={file.name}>
                  {file.name}
                </span>
                <button
                  type="button"
                  className="refund-view-btn danger"
                  onClick={() => setFile(null)}
                >
                  Hapus
                </button>
                <button
                  type="button"
                  className="refund-view-btn"
                  onClick={() =>
                    setPreview({
                      name: file.name,
                      kind: extensionOf(file) === "pdf" ? "pdf" : "gambar",
                      url: URL.createObjectURL(file),
                    })
                  }
                >
                  Lihat
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="refund-drop"
                onClick={() => fileInput.current?.click()}
              >
                <span className="refund-drop-ic">
                  <RefundIcon name="cloud-upload" size={18} />
                </span>
                <b>Unggah bukti transfer</b>
                <small>Format JPG, PNG atau PDF (maks. 2MB)</small>
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              hidden
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={pickFile}
            />
            {errors.bukti_transfer && (
              <p className="refund-err">{errors.bukti_transfer}</p>
            )}

            <label className="refund-agree">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>Dana sudah ditransfer, bukti tidak dapat diubah.</span>
            </label>
            {errors.konfirmasi && (
              <p className="refund-err">{errors.konfirmasi}</p>
            )}
          </>
        ) : (
          <p className="refund-proof-date">
            Bukti transfer belum dapat diunggah.
          </p>
        )}

        {error && <p className="refund-err">{error}</p>}

        <div className="refund-proof-actions">
          <button
            type="button"
            className="refund-btn dim"
            disabled={sending}
            onClick={onClose}
          >
            {canUpload ? "Batal" : "Tutup"}
          </button>
          {canUpload && !done && (
            <button
              type="button"
              className="refund-btn primary"
              disabled={!file || !confirmed || sending}
              onClick={submit}
            >
              <RefundIcon name="send" size={15} />{" "}
              {sending ? "Mengirim..." : "Kirim"}
            </button>
          )}
        </div>

        {preview && (
          <EvidencePreviewDialog
            {...preview}
            onClose={() => setPreview(null)}
          />
        )}
      </div>
    </div>
  );
}

export default TransferProofDialog;
