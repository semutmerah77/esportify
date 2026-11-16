import { useCallback, useEffect, useRef, useState } from "react";
import {
  getBracket,
  publishBracket,
  updateDescription,
  shuffleBracket,
  updateRound,
  updateScore,
} from "../../services/tournamentBracketApi";
import BracketCanvas from "./BracketCanvas";
import BracketIcon from "./BracketIcon";
import ScoreDialog from "./ScoreDialog";
import ReportInboxDrawer from "./ReportInboxDrawer";
import ActionDonePopup from "./ActionDonePopup";
import "../../styles/bracket.css";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const WIB = "Asia/Jakarta";

const wibDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("sv-SE", { timeZone: WIB });
};
const wibTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: WIB,
      });
};

// Konfirmasi Acak / Publikasi
function ConfirmDialog({
  icon,
  title,
  children,
  note,
  confirmLabel,
  confirmIcon,
  busy,
  error,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="kl-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div
        className="kl-dialog kl-bk-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kl-bk-ct"
      >
        <span className="kl-bk-confirm-ic">
          <BracketIcon name={icon} size={22} />
        </span>
        <h2 id="kl-bk-ct">{title}</h2>
        <p>{children}</p>
        {note && (
          <small className="kl-bk-note">
            <BracketIcon name="info" size={13} /> {note}
          </small>
        )}
        {error && <p className="kl-bk-err">{error}</p>}
        <div className="kl-bk-confirm-actions">
          <button
            type="button"
            className="kl-btn ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Batal
          </button>
          <button
            type="button"
            className="kl-btn kl-bk-primary"
            disabled={busy}
            onClick={onConfirm}
          >
            <BracketIcon name={confirmIcon} size={15} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Pemilih jam (24 jam): putar jam & menit dengan panah, klik angka, roda mouse/touchpad, atau tombol panah keyboard
const pad2 = (n) => String(n).padStart(2, "0");
const wrapNum = (n, max) => (n + max) % max;

function Spinner({ label, value, max, onPick }) {
  const acc = useRef(0);
  const cur = value === "" ? 0 : Number(value);
  const rows = [-2, -1, 0, 1, 2].map((o) => wrapNum(cur + o, max));
  const step = (d) => onPick(wrapNum(cur + d, max));

  const onWheel = (e) => {
    acc.current += e.deltaY;
    if (Math.abs(acc.current) >= 40) {
      step(acc.current > 0 ? 1 : -1);
      acc.current = 0;
    }
    e.stopPropagation();
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      step(1);
    }
  };

  return (
    <div
      className="kl-bk-tp-col"
      role="spinbutton"
      aria-label={label}
      aria-valuenow={cur}
      aria-valuemin={0}
      aria-valuemax={max - 1}
      tabIndex={0}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className="step"
        aria-label={`${label} naik`}
        onClick={() => step(-1)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
      {rows.map((n, i) => (
        <button
          key={i}
          type="button"
          className={i === 2 ? "on" : ""}
          onClick={() => onPick(n)}
        >
          {pad2(n)}
        </button>
      ))}
      <button
        type="button"
        className="step"
        aria-label={`${label} turun`}
        onClick={() => step(1)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

function TimePicker({ id, value, onChange }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const [h, m] = value ? value.split(":") : ["", ""];

  // Tutup saat klik di luar
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="kl-bk-tp" ref={boxRef}>
      <button
        type="button"
        id={id}
        className="kl-bk-field"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <BracketIcon name="clock" size={16} />
        <span className={value ? "" : "ph"}>{value || "Belum diatur"}</span>
        <em>WIB</em>
      </button>

      {open && (
        <div className="kl-bk-tp-pop">
          <div className="kl-bk-tp-cols">
            <Spinner
              label="Jam"
              value={h}
              max={24}
              onPick={(n) => onChange(`${pad2(n)}:${m || "00"}`)}
            />
            <span className="kl-bk-tp-sep">:</span>
            <Spinner
              label="Menit"
              value={m}
              max={60}
              onPick={(n) => onChange(`${h || "00"}:${pad2(n)}`)}
            />
          </div>
          <div className="kl-bk-tp-foot">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Hapus
            </button>
            <button type="button" className="ok" onClick={() => setOpen(false)}>
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Edit jadwal babak: judul (maks 30) + jam WIB (HH:MM). Tanggal mengikuti jadwal_main turnamen.
function EditRoundDialog({ round, onClose, onSave }) {
  const [name, setName] = useState(round.name);
  const [time, setTime] = useState(
    /^\d{2}:\d{2}/.test(round.startTime ?? "")
      ? round.startTime.slice(0, 5)
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("Judul babak wajib diisi.");
    if (n.length > 30) return setError("Judul babak maksimal 30 karakter.");
    if (time && !TIME_RE.test(time))
      return setError("Format jam tidak valid. Gunakan format 24 jam (HH:MM).");
    setBusy(true);
    setError("");
    try {
      await onSave({ name: n, time });
    } catch (err) {
      setError(err.message || "Jadwal babak gagal disimpan.");
      setBusy(false);
    }
  };

  return (
    <div
      className="kl-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        className="kl-dialog kl-bk-edit-dlg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kl-bk-et"
        onSubmit={submit}
      >
        <header>
          <h2 id="kl-bk-et">Edit jadwal babak</h2>
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
        <p>Judul dan jam akan tampil di header babak pada bracket.</p>

        <label htmlFor="kl-bk-name">Judul babak</label>
        <div className="kl-bk-field">
          <input
            id="kl-bk-name"
            autoFocus
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <em>{name.length}/30</em>
        </div>

        <label htmlFor="kl-bk-time">Jam</label>
        <TimePicker id="kl-bk-time" value={time} onChange={setTime} />
        <small className="kl-bk-hint">Format 24 jam, zona WIB.</small>

        {error && <p className="kl-bk-err">{error}</p>}

        <div className="kl-bk-confirm-actions">
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
            Simpan
          </button>
        </div>
      </form>
    </div>
  );
}

// Deskripsi bracket (tampil di semua status; edit selama turnamen belum selesai)
function DescriptionCard({ text, editable, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = () => {
    setValue(text);
    setError("");
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave(value.trim());
      setEditing(false);
    } catch (err) {
      setError(err.message || "Deskripsi gagal disimpan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kl-bk-card kl-bk-desc">
      <div className="kl-bk-desc-top">
        <h4>Deskripsi Bracket</h4>
        {editable && !editing && (
          <button
            type="button"
            className="kl-bk-edit static"
            aria-label="Edit deskripsi bracket"
            onClick={open}
          >
            <BracketIcon name="pencil" size={14} />
          </button>
        )}
      </div>
      {editing ? (
        <>
          <textarea
            className="kl-bk-textarea"
            autoFocus
            rows={4}
            maxLength={2000}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="kl-bk-desc-foot">
            <em>{value.length}/2000</em>
            {error && <span className="kl-bk-err inline">{error}</span>}
            <div>
              <button
                type="button"
                className="kl-btn ghost"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="kl-btn kl-bk-primary"
                disabled={busy}
                onClick={save}
              >
                Simpan
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className={text ? "" : "empty"}>{text || "Belum ada deskripsi."}</p>
      )}
    </div>
  );
}

function fmtCountdown(sec) {
  const h = Math.floor(sec / 3600);
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function Skeleton() {
  return (
    <div aria-hidden="true">
      <div className="kl-bk-card kl-bk-skel">
        <i className="w40" />
        <i className="w70" />
      </div>
      <div className="kl-bk-skel-canvas" />
    </div>
  );
}

// Popup sukses di tengah layar (sama gayanya dengan "Skor disimpan")
function SuccessPopup({ title, text, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2200);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="kl-ov"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="kl-dialog kl-sc-done" role="status">
        <span className="kl-sc-done-ic">
          <BracketIcon name="check" size={24} />
        </span>
        <b>{title}</b>
        {text && <p>{text}</p>}
      </div>
    </div>
  );
}

// id      : id turnamen
// onChanged: dipanggil setelah acak/publikasi/edit agar header halaman (status) disegarkan
function BracketPanel({ id, onChanged }) {
  const [state, setState] = useState({ data: null, error: "" });
  const [dialog, setDialog] = useState(null); // "acak" | "publikasi" | { round }
  const [busy, setBusy] = useState(false);
  const [dlgError, setDlgError] = useState("");
  const [popup, setPopup] = useState(null); // { title, text } popup sukses di tengah layar
  const [done, setDone] = useState(null); // { title, text } popup sukses
  const [inboxOpen, setInboxOpen] = useState(false); // panel Laporan Hasil

  const load = useCallback(
    () =>
      getBracket(id)
        .then((data) => setState({ data, error: "" }))
        .catch((err) =>
          setState((s) => ({
            ...s,
            error: err.message || "Bracket tidak dapat dimuat.",
          })),
        ),
    [id],
  );

  useEffect(() => {
    setState({ data: null, error: "" });
    load();
  }, [load]);

  // Hitung mundur publikasi otomatis: sisa detik dari BE (waktu server), dikurangi tiap detik
  const autoSecs = state.data?.tournament.autoSeconds ?? null;
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (autoSecs === null) {
      setLeft(null);
      return undefined;
    }
    setLeft(autoSecs);
    const timer = setInterval(
      () => setLeft((s) => (s === null ? s : Math.max(0, s - 1))),
      1000,
    );
    return () => clearInterval(timer);
  }, [autoSecs, state.data]);

  // Waktu habis: ambil ulang dari BE (bracket otomatis dipublikasikan)
  useEffect(() => {
    if (left === 0) load().then(() => onChanged?.());
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeDialog = () => {
    setDialog(null);
    setDlgError("");
  };

  const run = async (fn) => {
    setBusy(true);
    setDlgError("");
    try {
      await fn();
      closeDialog();
    } catch (err) {
      setDlgError(err.message || "Aksi gagal. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const doShuffle = () =>
    run(async () => {
      const res = await shuffleBracket(id);
      setState({ data: res, error: "" });
      setPopup({
        title: "Bracket diacak",
        text: res.message || "Posisi squad pada bracket berhasil diacak.",
      });
    });

  const doPublish = () =>
    run(async () => {
      const res = await publishBracket(id);
      await load();
      // Kalau BE menambahkan kalimat lain (mis. "Turnamen kini berlangsung."), tampil sebagai keterangan
      const extra = (res.message || "")
        .replace(/^Bracket berhasil dipublikasikan\.?\s*/i, "")
        .trim();
      setDone({ title: "Bracket dipublikasikan", text: extra });
      onChanged?.(); // status turnamen bisa berubah jadi "berlangsung"
    });

  const doSaveDescription = async (text) => {
    const res = await updateDescription(id, text);
    setState({ data: res, error: "" });
    setPopup({
      title: "Deskripsi disimpan",
      text: res.message || "Deskripsi bracket berhasil disimpan.",
    });
  };

  const doEditRound = async ({ name, time }) => {
    const res = await updateRound(id, dialog.round.id, { name, time });
    setState({ data: res, error: "" });
    setPopup({
      title: "Babak diperbarui",
      text: res.message || "Babak berhasil diperbarui.",
    });
    closeDialog();
  };

  // PB-18/19: simpan skor; BE mengembalikan bracket terbaru (pemenang sudah maju)
  const doScore = async (match, scoreA, scoreB) => {
    const res = await updateScore(id, match.id, { scoreA, scoreB });
    setState({ data: res, error: "" });
    onChanged?.(); // status turnamen bisa ikut berubah
    return res;
  };

  if (state.error && !state.data)
    return <p className="admin-message error">{state.error}</p>;
  if (!state.data) return <Skeleton />;

  const { data } = state;
  const t = data.tournament;
  const b = data.bracket;
  const published = b?.status === "dipublikasikan";
  const finished = t.status === "selesai";
  const blocked = t.registrationClosed && !t.canPublish;

  let hint = null;
  if (!published) {
    if (left !== null)
      hint = {
        cls: "timer",
        icon: "clock",
        text: "Otomatis dipublikasikan dalam",
        time: fmtCountdown(left),
      };
    else if (!t.registrationClosed)
      hint = {
        cls: "lock",
        icon: "lock",
        text: "Tersedia setelah pendaftaran ditutup",
      };
    else if (t.waiting > 0)
      hint = {
        cls: "warn",
        icon: "warn",
        text: `Selesaikan verifikasi ${t.waiting} pendaftar`,
      };
    else if (t.canPublish)
      hint = { cls: "ok", icon: "check", text: "Siap dipublikasikan" };
    else if (t.cannotPublishReason)
      hint = { cls: "warn", icon: "warn", text: t.cannotPublishReason };
  }

  const subtitle = published
    ? "Terlihat oleh semua peserta. Perbarui bracket melalui laporan hasil atau input skor."
    : !b && data.reason
      ? data.reason
      : "Hanya terlihat oleh penyelenggara. Squad di tab Peserta otomatis dimasukkan ke bracket.";

  return (
    <>
      <div className="kl-bk-card">
        <div className="kl-bk-card-top">
          <div className="kl-bk-title">
            {!published && <span className="kl-bk-draft">Draft</span>}
            <h3>
              {published
                ? "Bracket sedang berjalan"
                : blocked
                  ? "Bracket belum bisa dipublikasikan"
                  : "Bracket belum dipublikasikan"}
            </h3>
          </div>

          {published && (
            <div className="kl-bk-actions">
              <button
                type="button"
                className="kl-bk-btn report"
                onClick={() => setInboxOpen(true)}
              >
                <BracketIcon name="file" size={15} /> Laporan Hasil
                {t.pendingReports > 0 && (
                  <span className="kl-bk-badge">{t.pendingReports}</span>
                )}
              </button>
            </div>
          )}

          {!published && (
            <div className="kl-bk-actions">
              <button
                type="button"
                className="kl-bk-btn"
                disabled={!data.canShuffle}
                onClick={() => setDialog("acak")}
              >
                <BracketIcon name="shuffle" size={15} /> Acak Posisi
              </button>
              <button
                type="button"
                className="kl-bk-btn primary"
                disabled={!t.canPublish}
                onClick={() => setDialog("publikasi")}
              >
                <BracketIcon name="eye" size={15} /> Publikasikan Bracket
              </button>
            </div>
          )}
        </div>
        <div className="kl-bk-card-sub">
          <p>{subtitle}</p>
          {hint && (
            <span className={`kl-bk-hintline ${hint.cls}`}>
              <BracketIcon name={hint.icon} size={15} /> {hint.text}
              {hint.time && <b>{hint.time}</b>}
            </span>
          )}
        </div>
      </div>

      {b && (
        <DescriptionCard
          text={b.description}
          editable={!finished}
          onSave={doSaveDescription}
        />
      )}

      {b ? (
        <BracketCanvas
          rounds={b.rounds}
          editable={!finished}
          onEdit={(round) => {
            setDlgError("");
            setDialog({ round });
          }}
          onScore={
            finished
              ? undefined
              : (match) => {
                  if (match.a && match.b) setDialog({ score: match });
                }
          }
        />
      ) : (
        <p className="kl-empty">
          {data.reason ||
            "Bracket akan dibentuk otomatis setelah pendaftaran ditutup."}
        </p>
      )}

      {dialog === "acak" && (
        <ConfirmDialog
          icon="refresh"
          title="Acak posisi squad?"
          note="Pengacakan hanya bisa dilakukan selama bracket masih draft."
          confirmLabel="Acak Sekarang"
          confirmIcon="shuffle"
          busy={busy}
          error={dlgError}
          onCancel={closeDialog}
          onConfirm={doShuffle}
        >
          Posisi squad di bracket akan diacak ulang, susunan saat ini akan
          hilang dan tidak bisa dikembalikan.
        </ConfirmDialog>
      )}

      {dialog === "publikasi" && (
        <ConfirmDialog
          icon="eye"
          title="Publikasikan bracket?"
          confirmLabel="Publikasikan"
          confirmIcon="eye"
          busy={busy}
          error={dlgError}
          onCancel={closeDialog}
          onConfirm={doPublish}
        >
          Bracket akan terlihat oleh seluruh peserta turnamen. Setelah
          dipublikasikan, posisi squad tidak bisa diacak lagi.
        </ConfirmDialog>
      )}

      {dialog?.round && (
        <EditRoundDialog
          round={dialog.round}
          dateHint={wibDate(t.matchDate)}
          onClose={closeDialog}
          onSave={doEditRound}
        />
      )}

      {dialog?.score && (
        <ScoreDialog
          match={dialog.score}
          nextNo={
            b?.rounds
              .flatMap((r) => r.matches)
              .find((m) => m.id === dialog.score.nextId)?.number ?? null
          }
          loserNo={
            b?.rounds
              .flatMap((r) => r.matches)
              .find((m) => m.id === dialog.score.loserNextId)?.number ?? null
          }
          onSave={(a, c) => doScore(dialog.score, a, c)}
          onClose={closeDialog}
        />
      )}

      {inboxOpen && (
        <ReportInboxDrawer
          id={id}
          onClose={() => setInboxOpen(false)}
          onChanged={() => {
            load();
            onChanged?.();
          }}
        />
      )}

      {done && (
        <SuccessPopup
          title={done.title}
          text={done.text}
          onClose={() => setDone(null)}
        />
      )}

      {popup && (
        <ActionDonePopup
          title={popup.title}
          text={popup.text}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  );
}

export default BracketPanel;
