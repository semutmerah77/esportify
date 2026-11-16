import { useEffect, useState } from "react";
import BracketIcon from "./BracketIcon";

const MAX = 999;

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

const clampScore = (n) => Math.min(MAX, Math.max(0, n));

function Avatar({ squad, tone }) {
  return (
    <span className={`kl-sc-av ${tone}`}>
      {squad.logo ? <img src={squad.logo} alt="" /> : initials(squad.name)}
    </span>
  );
}

// Baris satu squad: avatar + nama + stepper skor
function ScoreRow({ squad, tone, value, onChange, disabled }) {
  const n = value === "" ? 0 : Number(value);
  return (
    <div className="kl-sc-row">
      <Avatar squad={squad} tone={tone} />
      <span className="kl-sc-who">
        <b title={squad.name}>{squad.name}</b>
        <small>Seed #{String(squad.seed ?? "-").padStart(2, "0")}</small>
      </span>
      <span className="kl-sc-step">
        <button
          type="button"
          aria-label={`Kurangi skor ${squad.name}`}
          disabled={disabled || n <= 0}
          onClick={() => onChange(String(clampScore(n - 1)))}
        >
          <BracketIcon name="minus" size={14} />
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
          disabled={disabled || n >= MAX}
          onClick={() => onChange(String(clampScore(n + 1)))}
        >
          <BracketIcon name="plus" size={14} />
        </button>
      </span>
    </div>
  );
}

const Arrow = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

// Teks skor: nama pemenang ditaruh di sisi squad pemenang (A kiri, B kanan)
function scoreLine(match, a, b, winnerIsA) {
  return winnerIsA
    ? `${match.a.name} ${a} – ${b}`
    : `${a} – ${b} ${match.b.name}`;
}

// Input skor (PB-18) dan revisi skor (PB-19).
// match   : pertandingan (kedua squad sudah ada)
// nextNo  : nomor pertandingan tujuan pemenang (null = final)
// loserNo : nomor pertandingan tujuan yang kalah (null = tidak ada)
// onSave  : async (skorA, skorB) => hasil; lempar Error(message) kalau ditolak BE
// onClose : tutup dialog
function ScoreDialog({ match, nextNo, loserNo, onSave, onClose }) {
  const revising = match.scoreA !== null && match.scoreB !== null;
  const [a, setA] = useState(revising ? String(match.scoreA) : "0");
  const [b, setB] = useState(revising ? String(match.scoreB) : "0");
  const [step, setStep] = useState("edit"); // edit | confirm | done
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) =>
      e.key === "Escape" && !busy && step !== "done" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, step, onClose]);

  // Layar "Skor disimpan" tertutup sendiri
  useEffect(() => {
    if (step !== "done") return undefined;
    const t = setTimeout(onClose, 1400);
    return () => clearTimeout(t);
  }, [step, onClose]);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave(Number(a), Number(b));
      setStep("done");
    } catch (err) {
      setError(err.message || "Skor gagal disimpan. Coba lagi.");
      setStep("edit");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (a === "" || b === "") return setError("Skor kedua Squad wajib diisi.");
    const na = Number(a);
    const nb = Number(b);
    if (na === nb)
      return setError(
        "Skor tidak boleh seri. Pertandingan harus memiliki pemenang.",
      );
    setError("");
    const newWinnerIsA = na > nb;
    const newWinnerReg = newWinnerIsA ? match.a.regId : match.b.regId;
    // Revisi yang mengubah pemenang butuh konfirmasi dulu
    if (revising && match.winnerRegId && match.winnerRegId !== newWinnerReg)
      return setStep("confirm");
    save();
  };

  if (step === "done")
    return (
      <div className="kl-ov">
        <div className="kl-dialog kl-sc-done" role="status">
          <span className="kl-sc-done-ic">
            <BracketIcon name="check" size={24} />
          </span>
          <b>{revising ? "Skor direvisi" : "Skor disimpan"}</b>
        </div>
      </div>
    );

  if (step === "confirm") {
    const na = Number(a);
    const nb = Number(b);
    const newIsA = na > nb;
    const winner = newIsA ? match.a : match.b;
    const oldWinner = newIsA ? match.b : match.a;
    return (
      <div
        className="kl-ov"
        onMouseDown={(e) =>
          e.target === e.currentTarget && !busy && setStep("edit")
        }
      >
        <div
          className="kl-dialog kl-sc-dlg kl-sc-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kl-sc-ct"
        >
          <span className="kl-sc-warn-ic">
            <BracketIcon name="warn" size={22} />
          </span>
          <h2 id="kl-sc-ct">Pemenang akan berubah</h2>
          <p>
            Skor baru menjadikan <b>{winner.name}</b> sebagai pemenang
            Pertandingan #{match.number}.
            {nextNo && (
              <>
                {" "}
                Slot <b>{oldWinner.name}</b> di Pertandingan #{nextNo} akan
                diganti oleh <b>{winner.name}</b>.
              </>
            )}
            {loserNo && (
              <> Posisi di Pertandingan #{loserNo} juga ikut berubah.</>
            )}
          </p>
          <div className="kl-sc-diff">
            <s>{scoreLine(match, match.scoreA, match.scoreB, !newIsA)}</s>
            <Arrow />
            <b>{scoreLine(match, na, nb, newIsA)}</b>
          </div>
          {error && <p className="kl-bk-err">{error}</p>}
          <div className="kl-sc-actions">
            <button
              type="button"
              className="kl-btn ghost"
              disabled={busy}
              onClick={() => setStep("edit")}
            >
              Batal
            </button>
            <button
              type="button"
              className="kl-btn kl-sc-amber"
              disabled={busy}
              onClick={save}
            >
              Ya, ubah pemenang
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="kl-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        className="kl-dialog kl-sc-dlg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kl-sc-t"
        onSubmit={submit}
        noValidate
      >
        <header>
          <div>
            <h2 id="kl-sc-t">
              {revising ? "Revisi" : "Input"} Skor Pertandingan #{match.number}
            </h2>
            {revising && (
              <p className="kl-sc-cur">
                Skor saat ini:{" "}
                <b>
                  {match.a.name} {match.scoreA} – {match.scoreB} {match.b.name}
                </b>
              </p>
            )}
          </div>
          <button
            type="button"
            className="kl-bk-x"
            aria-label="Tutup"
            disabled={busy}
            onClick={onClose}
          >
            <BracketIcon name="x" size={18} />
          </button>
        </header>

        <ScoreRow
          squad={match.a}
          tone="gold"
          value={a}
          onChange={setA}
          disabled={busy}
        />
        <ScoreRow
          squad={match.b}
          tone="cyan"
          value={b}
          onChange={setB}
          disabled={busy}
        />

        {revising && nextNo ? (
          <div className="kl-sc-note warn">
            <BracketIcon name="warn" size={15} />
            <span>
              Skor hanya dapat direvisi selama <b>Pertandingan #{nextNo}</b>{" "}
              belum memiliki skor.
            </span>
          </div>
        ) : (
          !revising && (
            <div className="kl-sc-note info">
              <BracketIcon name="info" size={15} />
              <span>
                Skor disimpan langsung tanpa laporan peserta.
                {nextNo && (
                  <>
                    {" "}
                    Pemenang otomatis maju ke <b>Pertandingan #{nextNo}</b>
                    {loserNo && (
                      <>
                        , yang kalah ke <b>Pertandingan #{loserNo}</b>
                      </>
                    )}
                    .
                  </>
                )}
              </span>
            </div>
          )
        )}

        {error && <p className="kl-bk-err">{error}</p>}

        <div className="kl-sc-actions">
          <button
            type="button"
            className="kl-btn ghost"
            disabled={busy}
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="submit"
            className="kl-btn kl-bk-primary"
            disabled={busy}
          >
            {revising ? "Simpan Revisi" : "Simpan Skor"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ScoreDialog;
