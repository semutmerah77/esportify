import { Link } from "react-router-dom";
import Icon from "../icon";
import { longDate } from "../../utils/date";

const STATUS_LABEL = {
  pendaftaran: "Pendaftaran",
  berlangsung: "Berlangsung",
  selesai: "Selesai",
};
const TYPE_LABEL = { online: "Online", offline: "Offline" };

function ManagedTournamentCard({ tournament: t }) {
  const filled = t.filled ?? null; // peserta terdaftar (slot_terisi)
  const pending = t.pendingVerify ?? null; // pendaftar menunggu verifikasi

  return (
    <article className="t-card">
      <div className="t-card-head">
        <div>
          <h3>{t.name}</h3>
          <p>{t.game}</p>
        </div>
        <span className={`t-status ${t.status}`}>
          <i></i> {STATUS_LABEL[t.status] ?? t.status}
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
          <dd>{pending === null ? "-" : `${pending} Pendaftar`}</dd>
        </div>
      </dl>

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
