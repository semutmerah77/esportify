import { useEffect, useState } from "react";
import Icon from "../icon";
import { KlAvatar, ProofPreview } from "./KlParts";
import {
  acceptRegistration,
  getProofFile,
  getRegistrationReview,
  rejectRegistration,
} from "../../services/tournamentManageApi";

const OTHER = "lainnya";
const MAX_OTHER = 200;
const REASONS = [
  {
    key: "tidak-ditemukan",
    title: "Pembayaran tidak ditemukan",
    desc: "Dana belum atau tidak masuk ke rekening penyelenggara.",
  },
  {
    key: "rekening-salah",
    title: "Rekening tujuan salah",
    desc: "Transfer ke rekening yang bukan milik penyelenggara.",
  },
  {
    key: "bukan-bukti",
    title: "Bukan bukti pembayaran",
    desc: "File yang diunggah bukan bukti transfer (salah kirim).",
  },
  {
    key: "tidak-valid",
    title: "Bukti tidak valid",
    desc: "Bukti terindikasi diedit atau dipakai oleh squad lain.",
  },
  { key: OTHER, title: "Lainnya", desc: "Tulis alasan sendiri." },
];

const EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};
const sizeText = (bytes) =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// Panel kanan: Tinjau Pendaftaran -> (Tolak) Tolak Pendaftaran
function ReviewDrawer({ tournamentId, row, onClose, onDone, onStale }) {
  const [detail, setDetail] = useState(null);
  const [ready, setReady] = useState(false); // detail + bukti pembayaran sudah siap, tampil bersamaan
  const [loadError, setLoadError] = useState("");
  const [proof, setProof] = useState(null); // { url, type, size }
  const [proofError, setProofError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [view, setView] = useState("review"); // review | reject
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let off = false;
    let objectUrl = null;
    getRegistrationReview(tournamentId, row.id)
      .then(async (d) => {
        if (off) return;
        let file = null;
        if (d.proofUrl) {
          try {
            file = await getProofFile(d.proofUrl);
            objectUrl = file.url;
            if (off) {
              URL.revokeObjectURL(file.url);
              return;
            }
          } catch (err) {
            if (!off)
              setProofError(
                err.message || "Bukti pembayaran tidak dapat dimuat.",
              );
          }
        }
        if (off) return;
        // Semua diisi sekaligus supaya isi panel muncul bersamaan
        setDetail(d);
        setProof(file);
        setReady(true);
      })
      .catch((err) => {
        if (off) return;
        setLoadError(err.message || "Gagal memuat pendaftaran.");
        setReady(true);
      });
    return () => {
      off = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [tournamentId, row.id]);

  useEffect(() => {
    const onKey = (e) =>
      e.key === "Escape" && !busy && !previewing && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, previewing, onClose]);

  const squad = detail?.squad ?? row.squad;
  const rep = detail?.rep ?? row.rep;

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      const res = await action();
      onDone(res.message);
    } catch (err) {
      setError(err.message || "Gagal memproses pendaftaran.");
      // 404/422 = sudah diproses / turnamen sudah berjalan: muat ulang daftar
      if (err.status === 404 || err.status === 422) onStale?.();
    } finally {
      setBusy(false);
    }
  };

  const reasonText = () => {
    if (choice === OTHER) return other.trim();
    const r = REASONS.find((x) => x.key === choice);
    return r ? `${r.title}. ${r.desc}` : "";
  };
  const canReject = Boolean(reasonText()) && !busy;

  const proofName = proof
    ? `Bukti_Pembayaran_${squad.code || row.id}.${EXT[proof.type] ?? "file"}`
    : "";

  const squadCard = (compact) => (
    <div className={compact ? "kl-dr-squad compact" : "kl-dr-squad"}>
      <KlAvatar
        name={squad.name}
        src={squad.logo}
        seed={squad.code || squad.name}
        size={compact ? 36 : 48}
      />
      <div>
        <b>{squad.name}</b>
        {squad.code && <small>ID: {squad.code}</small>}
        {!compact && (
          <span>
            Didaftarkan oleh <strong>{rep.username}</strong>
          </span>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="kl-dr-back" onMouseDown={() => !busy && onClose()} />
      <aside
        className="kl-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Tinjau pendaftaran"
      >
        {view === "review" ? (
          <>
            <header className="kl-dr-head">
              <h2>Tinjau Pendaftaran</h2>
              <button
                type="button"
                className="kl-dr-x"
                aria-label="Tutup"
                onClick={onClose}
              >
                <Icon name="x" size={18} />
              </button>
            </header>

            <div className="kl-dr-body">
              {!ready && (
                <div className="kl-dr-skel" aria-hidden="true">
                  <i className="tall" />
                  <i />
                  <i />
                  <i className="tall" />
                </div>
              )}
              {loadError && <p className="kl-dr-err">{loadError}</p>}
              {ready && !loadError && squadCard(false)}

              {ready && detail && (
                <>
                  <h3 className="kl-dr-label">
                    Daftar Anggota ({detail.members.length})
                  </h3>
                  <ul className="kl-dr-members">
                    {detail.members.map((m) => (
                      <li key={m.id ?? m.username}>
                        <KlAvatar name={m.username} src={m.avatar} size={24} />
                        <span>{m.username}</span>
                      </li>
                    ))}
                  </ul>

                  {detail.proofUrl && (
                    <>
                      <h3 className="kl-dr-label">Bukti Pembayaran</h3>
                      <div className="kl-dr-proof">
                        {proofError && (
                          <p className="kl-dr-err">{proofError}</p>
                        )}
                        {proof && (
                          <div className="kl-dr-file">
                            <span className="kl-dr-file-ic">
                              <Icon name="file-image" size={22} />
                            </span>
                            <div>
                              <b>{proofName}</b>
                              <small>Ukuran: {sizeText(proof.size)}</small>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPreviewing(true)}
                            >
                              Pratinjau
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {detail?.canVerify && (
              <footer className="kl-dr-foot">
                {error && <p className="kl-dr-err">{error}</p>}
                <div className="kl-dr-actions">
                  <button
                    type="button"
                    className="kl-btn reject-outline"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setView("reject");
                    }}
                  >
                    Tolak
                  </button>
                  <button
                    type="button"
                    className="kl-btn accept"
                    disabled={busy}
                    onClick={() =>
                      run(() => acceptRegistration(tournamentId, row.id))
                    }
                  >
                    {busy ? "Memproses..." : "Terima"}
                  </button>
                </div>
              </footer>
            )}
            {detail && !detail.canVerify && (
              <footer className="kl-dr-foot">
                <p className="kl-dr-note">
                  Pendaftaran ini sudah diverifikasi atau tidak dapat
                  diverifikasi lagi.
                </p>
              </footer>
            )}
          </>
        ) : (
          <>
            <header className="kl-dr-head">
              <button
                type="button"
                className="kl-dr-x left"
                aria-label="Kembali"
                onClick={() => setView("review")}
              >
                <Icon name="arrow-left" size={18} />
              </button>
              <h2 className="grow">Tolak Pendaftaran</h2>
              <button
                type="button"
                className="kl-dr-x"
                aria-label="Tutup"
                onClick={onClose}
              >
                <Icon name="x" size={18} />
              </button>
            </header>

            <div className="kl-dr-body">
              {squadCard(true)}
              <h3 className="kl-dr-label">Pilih alasan penolakan</h3>
              <div className="kl-reasons" role="radiogroup">
                {REASONS.map((r) => {
                  const on = choice === r.key;
                  return (
                    <div key={r.key} className={`kl-reason ${on ? "on" : ""}`}>
                      <label>
                        <input
                          type="radio"
                          name="reason"
                          checked={on}
                          onChange={() => setChoice(r.key)}
                        />
                        <span className="kl-radio" />
                        <span>
                          <b>{r.title}</b>
                          <small>{r.desc}</small>
                        </span>
                      </label>
                      {on && r.key === OTHER && (
                        <div className="kl-other">
                          <textarea
                            rows={3}
                            maxLength={MAX_OTHER}
                            value={other}
                            onChange={(e) => setOther(e.target.value)}
                            autoFocus
                          />
                          <span>
                            {other.length}/{MAX_OTHER}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="kl-dr-note">
                Alasan ini akan dikirim ke squad dan tampil di Status
                Pendaftaran mereka.
              </p>
            </div>

            <footer className="kl-dr-foot">
              {error && <p className="kl-dr-err">{error}</p>}
              <div className="kl-dr-actions">
                <button
                  type="button"
                  className="kl-btn ghost"
                  disabled={busy}
                  onClick={() => setView("review")}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="kl-btn reject"
                  disabled={!canReject}
                  onClick={() =>
                    run(() =>
                      rejectRegistration(tournamentId, row.id, reasonText()),
                    )
                  }
                >
                  {busy ? "Memproses..." : "Tolak Pendaftaran"}
                </button>
              </div>
            </footer>
          </>
        )}
      </aside>

      {previewing && proof && (
        <ProofPreview
          file={proof}
          name={proofName}
          onClose={() => setPreviewing(false)}
        />
      )}
    </>
  );
}

export default ReviewDrawer;
