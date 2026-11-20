import { useEffect, useMemo, useState } from "react";
import ScheduleIcon from "./ScheduleIcon";
import { cancellationFieldErrors } from "../../services/tournamentCancellationApi";
import {
  DAY_MS,
  formatWibDate,
  formatWibDateTime,
  getScheduleExtension,
  submitScheduleExtension,
  toWibInput,
  wibInputToDate,
} from "../../services/scheduleExtensionApi";
import "../../styles/match-report.css";
import "../../styles/schedule-extension.css";

const pad = (n) => String(n).padStart(2, "0");
const clamp = (text, max) => pad(Math.min(max, Math.max(0, Number(text) || 0)));

// Kotak jam "HH : MM": diketik atau dinaikkan/diturunkan dengan panah ↑↓ (tanpa daftar yang harus di-scroll)
function TimeBox({ label, hour, minute, disabled, invalid, onChange }) {
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);
  useEffect(() => {
    setH(hour);
    setM(minute);
  }, [hour, minute]);

  const digits = (e) => e.target.value.replace(/\D/g, "").slice(0, 2);
  const step = (e, current, max, isHour) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const size = max + 1;
    const next =
      ((((Number(current) || 0) + (e.key === "ArrowUp" ? 1 : -1)) % size) +
        size) %
      size;
    if (isHour) onChange(pad(next), clamp(m, 59));
    else onChange(clamp(h, 23), pad(next));
  };

  return (
    <div
      className={`ext-time ${invalid ? "err" : ""} ${disabled ? "off" : ""}`}
    >
      <ScheduleIcon name="clock" size={15} />
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        aria-label={`${label}: jam`}
        value={h}
        disabled={disabled}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setH(digits(e))}
        onBlur={() => onChange(clamp(h, 23), clamp(m, 59))}
        onKeyDown={(e) => step(e, h, 23, true)}
      />
      <span>:</span>
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        aria-label={`${label}: menit`}
        value={m}
        disabled={disabled}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setM(digits(e))}
        onBlur={() => onChange(clamp(h, 23), clamp(m, 59))}
        onKeyDown={(e) => step(e, m, 59, false)}
      />
    </div>
  );
}

function FormSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="ext-skel label" />
      <div className="ext-skel input" />
      <div className="ext-skel label" />
      <div className="ext-skel input" />
      <div className="ext-skel info" />
    </div>
  );
}

// Dampak perpanjangan (kontrak bagian B), dihitung di FE sebelum kirim.
function impactText({ status, registrationOpen, closeChanged, playChanged }) {
  if (closeChanged && (!registrationOpen || status === "berlangsung")) {
    return "Pendaftaran akan dibuka kembali dan bracket kembali ke draft.";
  }
  if (status === "berlangsung" && playChanged) {
    return "Turnamen kembali ke tahap persiapan dan bracket kembali ke draft.";
  }
  if (playChanged && !closeChanged)
    return "Hanya jadwal main yang berubah. Bracket tidak berubah.";
  return "Jadwal pendaftaran diperpanjang. Roster peserta tetap terkunci.";
}

// Dialog "Perpanjang jadwal" (menu ⋮ pada kartu Turnamen Kelolaan).
// GET dipanggil sekali saat dialog dibuka. Setelah PUT sukses, respons dipakai langsung (tanpa GET ulang).
function ScheduleExtensionDialog({ id, name, onClose, onExtended }) {
  const [state, setState] = useState({ data: null, error: "" });
  const [closeVal, setCloseVal] = useState("");
  const [playVal, setPlayVal] = useState("");
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    let off = false;
    getScheduleExtension(id)
      .then((data) => {
        if (off) return;
        setState({ data, error: "" });
        setCloseVal(toWibInput(data.active.close));
        setPlayVal(toWibInput(data.active.play));
      })
      .catch(
        (err) =>
          !off &&
          setState({
            data: null,
            error: err.message || "Jadwal tidak dapat dimuat.",
          }),
      );
    return () => {
      off = true;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || sending) return;
      if (confirming) setConfirming(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending, confirming]);

  const { data, error } = state;
  const bounds = useMemo(() => {
    if (!data) return null;
    return {
      closeMin: toWibInput(data.active.close),
      closeMax: toWibInput(data.max.close),
      playMin: toWibInput(data.active.play),
      playMax: toWibInput(data.max.play),
    };
  }, [data]);

  const closeChanged = Boolean(data) && closeVal !== bounds.closeMin;
  const playChanged = Boolean(data) && playVal !== bounds.playMin;
  const locked = !data || !data.canExtend;

  // Validasi di FE dulu supaya tidak mengirim request yang pasti ditolak
  const validate = () => {
    const next = {};
    const now = Date.now() + data.limits.serverOffset;
    const check = (key, value, min, max, label) => {
      const at = wibInputToDate(value);
      if (!at) {
        next[key] = `${label} wajib diisi.`;
        return;
      }
      if (at.getTime() <= now)
        next[key] = `${label} harus setelah waktu sekarang.`;
      else if (value < min)
        next[key] =
          `${label} tidak boleh lebih awal dari jadwal saat ini (${formatWibDateTime(data.active[key])}).`;
      else if (value > max)
        next[key] =
          `${label} maksimal ${data.limits.maxDays} hari dari jadwal awal (paling lambat ${formatWibDateTime(data.max[key])}).`;
    };
    if (closeChanged)
      check(
        "close",
        closeVal,
        bounds.closeMin,
        bounds.closeMax,
        "Jadwal tutup pendaftaran baru",
      );
    if (playChanged)
      check(
        "play",
        playVal,
        bounds.playMin,
        bounds.playMax,
        "Jadwal main baru",
      );
    const closeAt = wibInputToDate(closeVal);
    const playAt = wibInputToDate(playVal);
    if (
      !next.play &&
      !next.close &&
      closeAt &&
      playAt &&
      playAt.getTime() < closeAt.getTime() + data.limits.minGapDays * DAY_MS
    ) {
      next.play = `Jadwal main minimal ${data.limits.minGapDays} hari setelah jadwal tutup pendaftaran.`;
    }
    if (!closeChanged && !playChanged) {
      next.form =
        "Tidak ada jadwal yang diperpanjang. Ubah minimal salah satu jadwal.";
    }
    return next;
  };

  const askConfirm = () => {
    const next = validate();
    setErrors(next);
    setApiError("");
    if (Object.keys(next).length) return;
    setConfirming(true);
  };

  const send = async () => {
    if (sending) return;
    setSending(true);
    setApiError("");
    try {
      const res = await submitScheduleExtension(id, {
        // jadwal yang tidak diubah dikirim apa adanya dari jadwal_aktif
        close: closeChanged ? closeVal : data.active.close,
        play: playChanged ? playVal : data.active.play,
      });
      onExtended(res);
    } catch (err) {
      const fields = cancellationFieldErrors(err);
      if (fields) {
        setErrors({
          close: fields.jadwal_pendaftaran_tutup_baru,
          play: fields.jadwal_main_baru,
          form: fields.konfirmasi,
        });
      } else {
        setApiError(err.message || "Jadwal gagal diperpanjang.");
      }
      setConfirming(false);
      setSending(false);
    }
  };

  // value = "YYYY-MM-DDTHH:mm" (WIB)
  const clearError = (key) =>
    setErrors((prev) => ({ ...prev, [key]: "", form: "" }));
  const changeDate = (key, setValue, value, date) => {
    setValue(date ? `${date}T${value.slice(11, 16) || "00:00"}` : "");
    clearError(key);
  };
  const changeTime = (key, setValue, value, hh, mm) => {
    const date = value.slice(0, 10);
    if (date) setValue(`${date}T${hh}:${mm}`);
    clearError(key);
  };

  const field = (key, label, value, setValue, current, min, max) => (
    <>
      <div className="ext-label-row">
        <label htmlFor={`ext-${key}`}>{label}</label>
        <span>Saat ini: {formatWibDate(current)}</span>
      </div>
      <div className="ext-when">
        <div className={`ext-input ${errors[key] ? "err" : ""}`}>
          <input
            id={`ext-${key}`}
            type="date"
            value={value.slice(0, 10)}
            min={min.slice(0, 10)}
            max={max.slice(0, 10)}
            disabled={locked || sending}
            onChange={(e) => changeDate(key, setValue, value, e.target.value)}
          />
          <ScheduleIcon name="calendar" size={16} />
        </div>
        <TimeBox
          label={label}
          hour={value.slice(11, 13) || "00"}
          minute={value.slice(14, 16) || "00"}
          disabled={locked || sending}
          invalid={Boolean(errors[key])}
          onChange={(hh, mm) => changeTime(key, setValue, value, hh, mm)}
        />
      </div>
      {errors[key] ? (
        <p className="ext-err">{errors[key]}</p>
      ) : (
        <p className="ext-hint">
          Maksimal {data?.limits.maxDays ?? 14} hari dari jadwal{" "}
          {data?.extended ? "awal" : "saat ini"}
        </p>
      )}
    </>
  );

  return (
    <div
      className="rp-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !sending && onClose()}
    >
      <div
        className="rp-dialog ext-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ext-title"
      >
        <div className="ext-head">
          <div>
            <h2 id="ext-title">Perpanjang jadwal</h2>
            <p>{name}</p>
          </div>
          <button
            type="button"
            className="ext-x"
            aria-label="Tutup"
            disabled={sending}
            onClick={onClose}
          >
            <ScheduleIcon name="x" size={18} />
          </button>
        </div>

        {error && <p className="ext-err center">{error}</p>}
        {!error && !data && <FormSkeleton />}

        {data && (
          <>
            {field(
              "close",
              "Jadwal pendaftaran ditutup",
              closeVal,
              setCloseVal,
              data.active.close,
              bounds.closeMin,
              bounds.closeMax,
            )}
            {field(
              "play",
              "Jadwal main",
              playVal,
              setPlayVal,
              data.active.play,
              bounds.playMin,
              bounds.playMax,
            )}

            <p className="ext-initial">
              Jadwal awal: {formatWibDateTime(data.initial.close)} (tutup) ·{" "}
              {formatWibDateTime(data.initial.play)} (main)
            </p>

            {!data.canExtend ? (
              <div className="ext-info warn">
                <ScheduleIcon name="warn" size={16} />
                <span>
                  {data.reason ||
                    "Jadwal turnamen ini tidak dapat diperpanjang."}
                </span>
              </div>
            ) : (
              <div className="ext-info">
                <ScheduleIcon name="info" size={16} />
                <span>
                  Peserta terdaftar akan menerima pemberitahuan perubahan
                  jadwal.
                </span>
              </div>
            )}
            {errors.form && <p className="ext-err center">{errors.form}</p>}
            {apiError && <p className="ext-err center">{apiError}</p>}
          </>
        )}

        <div className="ext-actions">
          <button
            type="button"
            className="ext-btn dim"
            disabled={sending}
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            className="ext-btn primary"
            disabled={locked || sending}
            onClick={askConfirm}
          >
            Perpanjang
          </button>
        </div>
      </div>

      {confirming && data && (
        <div
          className="rp-ov rp-ov-top"
          onMouseDown={(e) =>
            e.target === e.currentTarget && !sending && setConfirming(false)
          }
        >
          <div
            className="rp-dialog ext-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ext-confirm-title"
          >
            <span className="ext-confirm-ic">
              <ScheduleIcon name="warn" size={24} />
            </span>
            <h2 id="ext-confirm-title">Konfirmasi perpanjangan jadwal</h2>
            <dl className="ext-summary">
              {closeChanged && (
                <div>
                  <dt>Tutup pendaftaran</dt>
                  <dd>{formatWibDateTime(wibInputToDate(closeVal))}</dd>
                </div>
              )}
              {playChanged && (
                <div>
                  <dt>Jadwal main</dt>
                  <dd>{formatWibDateTime(wibInputToDate(playVal))}</dd>
                </div>
              )}
            </dl>
            <p className="ext-impact">
              <ScheduleIcon name="info" size={15} />
              <span>
                {impactText({
                  status: data.tournament.status,
                  registrationOpen: data.tournament.registrationOpen,
                  closeChanged,
                  playChanged,
                })}{" "}
                Pertimbangkan membuat pengumuman setelah memperpanjang.
              </span>
            </p>
            <div className="ext-actions split">
              <button
                type="button"
                className="ext-btn dim"
                disabled={sending}
                onClick={() => setConfirming(false)}
              >
                Kembali
              </button>
              <button
                type="button"
                className="ext-btn primary"
                disabled={sending}
                onClick={send}
              >
                {sending ? "Menyimpan..." : "Ya, perpanjang"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScheduleExtensionDialog;
