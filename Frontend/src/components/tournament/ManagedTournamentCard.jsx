import { Link } from "react-router-dom";
import Icon from "../icon";
import { formatWibDate } from "../../services/scheduleExtensionApi";
import ScheduleIcon from "../kelola/ScheduleIcon";
import "../../styles/schedule-extension.css";
import CancellationIcon from "../kelola/CancellationIcon";
import ManagedTournamentMenu from "./ManagedTournamentMenu";
import { formatShortDate } from "../../services/tournamentCancellationApi";
import "../../styles/tournament-cancellation.css";

const STATUS_LABEL = {
  pendaftaran: "Pendaftaran",
  ditutup: "Pendaftaran ditutup",
  tertunda: "Tertunda",
  berlangsung: "Berlangsung",
  selesai: "Selesai",
  pembatalan: "Pembatalan Diajukan",
  dibatalkan: "Dibatalkan",
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

function ManagedTournamentCard({ tournament: t, onChanged }) {
  const filled = t.filled ?? null; // peserta terdaftar (slot_terisi)
  const pending = t.pendingVerify ?? null; // pendaftar menunggu verifikasi

  // Indikator tampilan dari BE (bukan nilai status): Tertunda menggantikan Berlangsung,
  // "Pendaftaran ditutup" hanya untuk status pendaftaran.
  const cancelRequest = t.cancellation ?? null; // pengajuan pembatalan terakhir (kalau BE mengirim)
  const cancelled = t.status === "dibatalkan";
  const cancelPending = !cancelled && cancelRequest?.status === "menunggu";
  const cancelRejected = !cancelled && cancelRequest?.status === "ditolak";

  const phase = cancelled
    ? "dibatalkan"
    : cancelPending
      ? "pembatalan"
      : t.delayed
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
          {t.extended && !cancelled && (
            <span className="ext-badge">
              <ScheduleIcon name="calendar-clock" size={13} /> Jadwal
              diperpanjang
            </span>
          )}
        </div>
        <span className={`t-status ${phase}`}>
          <i></i> {STATUS_LABEL[phase] ?? phase}
        </span>
      </div>

      <dl className="t-stats t-stats-5">
        <div>
          <dt>Jadwal pendaftaran ditutup</dt>
          <dd>{formatWibDate(t.registrationCloses)}</dd>
        </div>
        <div>
          <dt>Jadwal tanding</dt>
          <dd>{formatWibDate(t.matchDate)}</dd>
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

      {cancelPending && (
        <div className="t-strip purple" role="status">
          <CancellationIcon name="send" size={18} />
          <div>
            <b>
              Pembatalan diajukan
              {cancelRequest.submittedAt
                ? ` · ${formatShortDate(cancelRequest.submittedAt)}`
                : ""}
            </b>
            {cancelRequest.reasonLabel && (
              <p>Alasan: {cancelRequest.reasonLabel}</p>
            )}
          </div>
        </div>
      )}

      {cancelRejected && (
        <div className="t-strip plain" role="status">
          <CancellationIcon name="x-circle" size={18} />
          <div>
            <b>
              Pembatalan ditolak
              {cancelRequest.decidedAt
                ? ` · ${formatShortDate(cancelRequest.decidedAt)}`
                : ""}
            </b>
            {cancelRequest.adminNote && (
              <p>Catatan admin: {cancelRequest.adminNote}</p>
            )}
          </div>
        </div>
      )}

      {cancelled && (
        <div className="t-strip danger" role="status">
          <CancellationIcon name="stamp" size={18} />
          <div>
            <b>
              Turnamen dibatalkan
              {cancelRequest?.decidedAt
                ? ` · ${formatShortDate(cancelRequest.decidedAt)}`
                : ""}
            </b>
            <p>
              Pembatalan disetujui admin Esportify. Seluruh peserta telah
              menerima notifikasi resmi via aplikasi.
            </p>
          </div>
        </div>
      )}

      {phase === "tertunda" && (
        <div className="t-alert danger" role="alert">
          <strong>
            <AlertIcon kind="danger" /> Jadwal pertandingan telah tiba!
          </strong>
          <b>Turnamen belum dapat dimulai.</b>
          <p>{t.delayReason || DEFAULT_DELAY_TEXT}</p>
        </div>
      )}

      {phase !== "tertunda" && !cancelled && !cancelPending && t.reminder && (
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
        <ManagedTournamentMenu
          id={t.id}
          name={t.name}
          status={t.status}
          cancellation={cancelRequest}
          pendingVerify={pending}
          onChanged={onChanged}
        />
      </div>
    </article>
  );
}

export default ManagedTournamentCard;
