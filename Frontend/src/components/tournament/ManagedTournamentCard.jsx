import { Link } from "react-router-dom";
import Icon from "../icon";
import { longDate } from "../../utils/date";

const STATUS_LABEL = {
  pendaftaran: "Pendaftaran",
  ditutup: "Pendaftaran ditutup",
  tertunda: "Tertunda",
  berlangsung: "Berlangsung",
  selesai: "Selesai",
};
const TYPE_LABEL = { online: "Online", offline: "Offline" };

const DEFAULT_DELAY_TEXT =
  "Pertandingan tertunda, selesaikan verifikasi untuk memublikasikan bracket dan memulai pertandingan.";
const DEFAULT_H1_TEXT =
  "Segera selesaikan seluruh persiapan turnamen agar pertandingan dapat dimulai sesuai jadwal.";

// Ikon peringatan lokal (path lucide), tanpa mendaftarkan ke components/icon
function AlertIcon({ kind }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "danger" ? (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </>
      ) : (
        <>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </>
      )}
    </svg>
  );
}

function ManagedTournamentCard({ tournament: t }) {
  const filled = t.filled ?? null; // peserta terdaftar (slot_terisi)
  const pending = t.pendingVerify ?? null; // pendaftar menunggu verifikasi

  // Indikator tampilan dari BE (bukan nilai status): Tertunda menggantikan Berlangsung,
  // "Pendaftaran ditutup" hanya untuk status pendaftaran.
  const phase = t.delayed
    ? "tertunda"
    : t.status === "pendaftaran" && t.closed
      ? "ditutup"
      : t.status;

  const hasPending = pending !== null && pending > 0;
  const pendingText =
    pending === null
      ? "-"
      : phase === "berlangsung" && pending === 0
        ? "0"
        : phase === "tertunda" || phase === "ditutup"
          ? `${pending} pendaftar`
          : `${pending} Pendaftar`;
  const pendingTone = !hasPending
    ? ""
    : phase === "tertunda"
      ? "t-red"
      : t.reminder || phase === "ditutup"
        ? "t-yellow"
        : "";

  return (
    <article className="t-card">
      <div className="t-card-head">
        <div>
          <h3>{t.name}</h3>
          <p>{t.game}</p>
        </div>
        <span className={`t-status ${phase}`}>
          <i></i> {STATUS_LABEL[phase] ?? phase}
        </span>
      </div>

      <dl className="t-stats t-stats-5">
        <div>
          <dt>Jadwal pendaftaran ditutup</dt>
          <dd>{longDate(t.registrationCloses)}</dd>
        </div>
        <div>
          <dt>Jadwal tanding</dt>
          <dd>{longDate(t.matchDate)}</dd>
        </div>
        <div>
          <dt>Tipe</dt>
          <dd>{TYPE_LABEL[t.type] ?? "-"}</dd>
        </div>
        <div>
          <dt>Peserta terdaftar</dt>
          <dd>
            {filled ?? "-"}/{t.capacity ?? "-"} tim
          </dd>
        </div>
        <div>
          <dt>Perlu diverifikasi</dt>
          <dd className={pendingTone}>{pendingText}</dd>
        </div>
      </dl>

      {phase === "tertunda" && (
        <div className="t-alert danger" role="alert">
          <strong>
            <AlertIcon kind="danger" /> Jadwal pertandingan telah tiba!
          </strong>
          <b>Turnamen belum dapat dimulai.</b>
          <p>{t.delayReason || DEFAULT_DELAY_TEXT}</p>
        </div>
      )}

      {phase !== "tertunda" && t.reminder && (
        <div className="t-alert warn" role="status">
          <strong>
            <AlertIcon kind="warn" /> Persiapan turnamen - H-1
          </strong>
          <p>{t.reminder.message || DEFAULT_H1_TEXT}</p>
          {t.reminder.note && <p>{t.reminder.note}</p>}
        </div>
      )}

      <div className="t-card-actions">
        <Link to={`/turnamen/${t.id}/kelola`} className="t-btn-primary">
          <Icon name="manage" size={18} /> Kelola Turnamen
        </Link>
        <Link to={`/turnamen/detail/${t.id}`} className="t-btn-outline">
          Detail
        </Link>
      </div>
    </article>
  );
}

export default ManagedTournamentCard;