import { useEffect, useRef, useState } from "react";
import {
  formatReportDateTime,
  getMyReportStatus,
  submitReport,
} from "../../services/matchReportApi";
import { EvidenceRow, EvidenceViewer } from "./ReportEvidence";
import ReportIcon from "./ReportIcon";
import "../../styles/match-report.css";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const MAX_SCORE = 999;

const SUBMIT_LABEL = {
  laporan: "Kirim Laporan",
  kirim_ulang: "Kirim Ulang",
  sanggahan: "Ajukan Sanggahan",
};
const DONE_TITLE = {
  laporan: "Laporan terkirim",
  kirim_ulang: "Laporan dikirim ulang",
  sanggahan: "Sanggahan terkirim",
};
const NOTE_PLACEHOLDER = {
  laporan: "Contoh: Squad A WIN, lawan terlambat, lihat bukti ke-2.",
  kirim_ulang: "Contoh: lawan menggunakan akun joki, lihat bukti ke-2.",
  sanggahan: "Contoh: lawan menggunakan akun joki, lihat bukti ke-2.",
};

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

function SquadAvatar({ squad, tone }) {
  return (
    <span className={`rp-av ${tone}`}>
      {squad.logo ? (
        <img src={squad.logo} alt="" loading="lazy" decoding="async" />
      ) : (
        initials(squad.name)
      )}
    </span>
  );
}

// Baris skor satu squad: stepper (bisa diubah) atau angka saja (read-only)
function ScoreRow({ squad, tone, value, onChange, readOnly, disabled }) {
  const n = value === "" ? 0 : Number(value);
  return (
    <div className="rp-score-row">
      <SquadAvatar squad={squad} tone={tone} />
      <span className="rp-score-name" title={squad.name}>
        {squad.name}
      </span>
      {readOnly ? (
        <b className="rp-score-static">{value}</b>
      ) : (
        <span className="rp-step">
          <button
            type="button"
            aria-label={`Kurangi skor ${squad.name}`}
            disabled={disabled || n <= 0}
            onClick={() => onChange(String(Math.max(0, n - 1)))}
          >
            <ReportIcon name="minus" size={14} />
          </button>
          <input
            inputMode="numeric"
            maxLength={3}
            aria-label={`Skor ${squad.name}`}
            value={value}
            disabled={disabled}
            onFocus={(e) => e.target.select()}
            onChange={(e) =>
              onChange(e.target.value.replace(/\D/g, "").slice(0, 3))
            }
          />
          <button
            type="button"
            aria-label={`Tambah skor ${squad.name}`}
            disabled={disabled || n >= MAX_SCORE}
            onClick={() => onChange(String(Math.min(MAX_SCORE, n + 1)))}
          >
            <ReportIcon name="plus" size={14} />
          </button>
        </span>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="rp-skel rp-skel-line w60" />
      <div className="rp-skel rp-skel-row" />
      <div className="rp-skel rp-skel-row" />
      <div className="rp-skel rp-skel-line w40" />
      <div className="rp-skel rp-skel-row" />
    </div>
  );
}

// Modal "Laporkan Hasil Pertandingan" untuk pemain (PB-15 lapor, PB-17 kirim ulang & sanggahan).
// tournamentId: id turnamen | match: pertandingan dari bracket (a, b, number, scoreA/scoreB)
// onSubmitted: dipanggil setelah laporan terkirim (muat ulang bracket)
function PlayerReportDialog({ tournamentId, match, onClose, onSubmitted }) {
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [note, setNote] = useState("");
  const [kept, setKept] = useState([]); // bukti lama yang dipertahankan
  const [files, setFiles] = useState([]); // bukti baru
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [viewer, setViewer] = useState(null);
  const fileInput = useRef(null);

  useEffect(() => {
    let off = false;
    getMyReportStatus(tournamentId, match.id)
      .then((s) => {
        if (off) return;
        setStatus(s);
        // Laporan menunggu: tampil read-only. Laporan ditolak: form kirim ulang terisi data lama
        // (bukti lama bisa dipertahankan / dihapus).
        if (s.report) {
          setScoreA(String(s.report.scoreA ?? 0));
          setScoreB(String(s.report.scoreB ?? 0));
          setNote(s.report.note || "");
          if (s.report.status === "ditolak") setKept(s.report.evidences);
        }
      })
      .catch(
        (err) =>
          !off &&
          setLoadError(err.message || "Status laporan tidak dapat dimuat."),
      );
    return () => {
      off = true;
    };
  }, [tournamentId, match.id]);

  useEffect(() => {
    if (viewer) return undefined;
    const onKey = (e) => e.key === "Escape" && !busy && !done && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, done, viewer, onClose]);

  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
  }, [done, onClose]);

  const kind = status?.kind || "laporan";
  const report = status?.report;
  const waiting = report?.status === "menunggu";
  const rejected = report?.status === "ditolak";
  const readOnly = waiting;
  const blocked = status && !status.canSend && !waiting;

  const addFiles = (list) => {
    const problems = [];
    const accepted = Array.from(list).filter((f) => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        problems.push(
          `Format "${f.name}" tidak didukung. Gunakan JPG atau PNG.`,
        );
        return false;
      }
      if (f.size > MAX_FILE_BYTES) {
        problems.push(`"${f.name}" melebihi 2 MB.`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...accepted]);
    setError(problems[0] || "");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (scoreA === "" || scoreB === "")
      return setError("Skor kedua Squad wajib diisi.");
    if (Number(scoreA) === Number(scoreB))
      return setError(
        "Skor tidak boleh seri. Pertandingan harus memiliki pemenang.",
      );
    if (kept.length + files.length === 0)
      return setError("Unggah minimal satu bukti pertandingan.");
    setBusy(true);
    setError("");
    try {
      const res = await submitReport(tournamentId, match.id, {
        scoreA: Number(scoreA),
        scoreB: Number(scoreB),
        note,
        files,
        keepEvidenceIds: kept.map((k) => k.id),
      });
      setDone({
        title: DONE_TITLE[res.kind] ?? DONE_TITLE[kind],
        text: res.message,
      });
      onSubmitted?.();
    } catch (err) {
      setError(err.message || "Laporan gagal dikirim. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="rp-ov">
        <div className="rp-dialog rp-done" role="status">
          <span className="rp-done-ic">
            <ReportIcon name="check" size={24} />
          </span>
          <b>{done.title}</b>
          {done.text && <p>{done.text}</p>}
        </div>
      </div>
    );

  const title =
    kind === "sanggahan"
      ? `Ajukan Sanggahan Pertandingan #${match.number}`
      : `Laporkan Hasil Pertandingan #${match.number}`;
  const hasResult = match.scoreA !== null && match.scoreB !== null;

  return (
    <div
      className="rp-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        className="rp-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rp-player-title"
        onSubmit={submit}
        noValidate
      >
        <header className="rp-head">
          <div>
            <h2 id="rp-player-title">
              {title}
              {waiting && (
                <span className="rp-badge wait">
                  <ReportIcon name="clock" size={12} /> Menunggu verifikasi
                </span>
              )}
              {rejected && (
                <span className="rp-badge bad">
                  <ReportIcon name="x" size={12} /> Ditolak
                </span>
              )}
            </h2>
            {report && (
              <p className="rp-sub">
                Dikirim {formatReportDateTime(report.sentAt)}
                {report.sentBy && ` oleh ${report.sentBy}`}
              </p>
            )}
          </div>
          {report && (
            <button
              type="button"
              className="rp-x"
              aria-label="Tutup"
              disabled={busy}
              onClick={onClose}
            >
              <ReportIcon name="x" size={18} />
            </button>
          )}
        </header>

        {loadError && <p className="rp-err">{loadError}</p>}
        {!status && !loadError && <LoadingSkeleton />}

        {blocked && (
          <div className="rp-note warn">
            <ReportIcon name="warn" size={15} />
            <span>
              {status.cannotSendReason ||
                "Laporan belum dapat dikirim saat ini."}
            </span>
          </div>
        )}

        {status && !blocked && (
          <>
            {rejected && (
              <div className="rp-reject-box">
                <b>
                  <ReportIcon name="alert" size={15} /> Alasan penolakan
                </b>
                <p>
                  {report.rejectReason || "Laporan ditolak oleh penyelenggara."}
                </p>
              </div>
            )}

            {kind === "sanggahan" && hasResult && (
              <div className="rp-note warn">
                <ReportIcon name="warn" size={15} />
                <span>
                  Pertandingan ini sudah memiliki hasil:{" "}
                  <b>
                    {match.a.name} {match.scoreA} – {match.scoreB}{" "}
                    {match.b.name}
                  </b>
                  . Ajukan sanggahan jika hasil tidak sesuai.
                </span>
              </div>
            )}

            <p className="rp-label">
              Skor pertandingan {!readOnly && <span className="rp-req">*</span>}
            </p>
            <ScoreRow
              squad={match.a}
              tone="gold"
              value={scoreA}
              onChange={setScoreA}
              readOnly={readOnly}
              disabled={busy}
            />
            <ScoreRow
              squad={match.b}
              tone="cyan"
              value={scoreB}
              onChange={setScoreB}
              readOnly={readOnly}
              disabled={busy}
            />

            <p className="rp-label">
              Bukti pertandingan{" "}
              {!readOnly && <span className="rp-req">*</span>}
            </p>
            {!readOnly && (
              <small className="rp-hint">
                JPG atau PNG, maks. 2 MB per file. Minimal 1 bukti.
              </small>
            )}

            {(readOnly ? report.evidences : kept).map((ev) => (
              <EvidenceRow
                key={`old-${ev.id}`}
                name={ev.name}
                type={ev.type}
                disabled={busy}
                onView={() =>
                  setViewer({ name: ev.name, source: { url: ev.url } })
                }
                onRemove={
                  readOnly
                    ? undefined
                    : () =>
                        setKept((prev) => prev.filter((k) => k.id !== ev.id))
                }
              />
            ))}
            {!readOnly &&
              files.map((file, i) => (
                <EvidenceRow
                  key={`new-${file.name}-${i}`}
                  name={file.name}
                  type={file.type === "image/png" ? "PNG" : "JPG"}
                  disabled={busy}
                  onView={() =>
                    setViewer({ name: file.name, source: { file } })
                  }
                  onRemove={() =>
                    setFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                />
              ))}

            {!readOnly && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  hidden
                  multiple
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="rp-upload"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  <ReportIcon name="upload" size={16} /> Unggah bukti
                </button>
              </>
            )}

            {readOnly ? (
              <>
                <p className="rp-label muted">Catatan</p>
                <div className="rp-note-box">
                  {report.note || <em>Tidak ada catatan.</em>}
                </div>
              </>
            ) : (
              <>
                <label className="rp-label" htmlFor="rp-note">
                  Catatan (opsional)
                </label>
                <textarea
                  id="rp-note"
                  className="rp-textarea"
                  rows={3}
                  maxLength={1000}
                  placeholder={NOTE_PLACEHOLDER[kind]}
                  value={note}
                  disabled={busy}
                  onChange={(e) => setNote(e.target.value)}
                />
              </>
            )}
          </>
        )}

        {error && <p className="rp-err">{error}</p>}

        <div className="rp-actions">
          {readOnly || blocked || loadError ? (
            <button type="button" className="rp-btn ghost" onClick={onClose}>
              Tutup
            </button>
          ) : (
            <>
              <button
                type="button"
                className="rp-btn ghost"
                disabled={busy}
                onClick={onClose}
              >
                Batal
              </button>
              <button
                type="submit"
                className="rp-btn primary"
                disabled={busy || !status}
              >
                <ReportIcon name="send" size={15} /> {SUBMIT_LABEL[kind]}
              </button>
            </>
          )}
        </div>
      </form>

      {viewer && (
        <EvidenceViewer
          name={viewer.name}
          source={viewer.source}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

export default PlayerReportDialog;
