import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../icon";
import { formatWibDate } from "../../services/scheduleExtensionApi";
import ScheduleIcon from "../kelola/ScheduleIcon";
import "../../styles/schedule-extension.css";
import "../../styles/tournament-cancellation.css";
import Avatar from "../user/Avatar";

const STATUS_LABEL = {
  pendaftaran: "Pendaftaran",
  ditutup: "Pendaftaran ditutup",
  berlangsung: "Berlangsung",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};
const PAYMENT_ITEMS = {
  qris: [{ icon: "qr", label: "QRIS" }],
  transfer: [{ icon: "bank", label: "Transfer Bank" }],
  qris_transfer: [
    { icon: "qr", label: "QRIS" },
    { icon: "bank", label: "Transfer Bank" },
  ],
};

const money = (v) =>
  v === null || v === undefined || v === ""
    ? "-"
    : `Rp${Number(v).toLocaleString("id-ID")}`;

// 08819835556 -> 0881-9835-556
const formatPhone = (v) =>
  String(v)
    .replace(/\D/g, "")
    .replace(/(\d{4})(?=\d)/g, "$1-");

function InfoCard({ title, icon, children, sub, extra }) {
  return (
    <section className="td-card">
      <h2>{title}</h2>
      <div className="td-item">
        <span className="td-icon">
          <Icon name={icon} size={20} />
        </span>
        <div>
          <p className="td-item-main">{children}</p>
          {sub && <p className="td-item-sub">{sub}</p>}
          {extra && <p className="td-item-sub">{extra}</p>}
        </div>
      </div>
    </section>
  );
}

// d = hasil getTournamentDetail. action = tombol opsional di kartu ringkasan.
function TournamentInfo({ d, action, registered = null }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  // "Pendaftaran Ditutup" hanya label tampilan (bukan status di database)
  const phase = d.status === "pendaftaran" && d.closed ? "ditutup" : d.status;

  const offline = d.type === "offline";
  const place = offline
    ? [d.city, d.province].filter(Boolean).join(", ")
    : "Online";
  const percent = d.slot
    ? Math.min(100, Math.round(((registered ?? 0) / Number(d.slot)) * 100))
    : 0;
  const payments = PAYMENT_ITEMS[d.paymentMethod] ?? [];
  const longText = d.description.length > 280;

  return (
    <>
      <div className="td-top">
        <div className="td-poster">
          {d.posterUrl ? (
            <img src={d.posterUrl} alt={`Poster ${d.name}`} />
          ) : (
            <p className="admin-message">Poster tidak tersedia.</p>
          )}
        </div>

        <section className="td-summary">
          <div className="td-summary-head">
            <span className="td-game">{d.game}</span>
            <div className="td-head-right">
              {d.extended && d.status !== "dibatalkan" && (
                <span className="ext-badge">
                  <ScheduleIcon name="calendar-clock" size={13} /> Jadwal
                  diperpanjang
                </span>
              )}
              <span className={`t-status ${phase}`}>
                <i></i> {STATUS_LABEL[phase] ?? phase}
              </span>
            </div>
          </div>
          <h2 className="td-title">{d.name}</h2>

          <div className="td-grid td-money">
            <div>
              <small>TOTAL HADIAH</small>
              <b className="green">{money(d.prize)}</b>
            </div>
            <div>
              <small>BIAYA PENDAFTARAN</small>
              <b>{d.feeType === "gratis" ? "Gratis" : money(d.fee)}</b>
            </div>
          </div>

          <div className="td-grid">
            <div>
              <small>
                <Icon name="monitor" size={13} /> Tipe
              </small>
              <b>{offline ? "Offline" : "Online"}</b>
            </div>
            <div>
              <small>
                <Icon name="users" size={13} /> Slot
              </small>
              <b>
                {registered ?? "-"} / {d.slot ?? "-"}
              </b>
              <div className="td-bar">
                <i style={{ width: `${percent}%` }}></i>
              </div>
            </div>
          </div>

          <div className="td-grid">
            <div>
              <small>
                <Icon name="calendar" size={13} /> Jadwal pendaftaran ditutup
              </small>
              <b>{formatWibDate(d.closeDate)}</b>
            </div>
            <div>
              <small>
                <Icon name="zap" size={13} /> Jadwal tanding
              </small>
              <b>{formatWibDate(d.matchDate)}</b>
            </div>
          </div>

          {action}
        </section>
      </div>

      <section className="td-card">
        <h2>Nama Penyelenggara</h2>
        <div className="td-item">
          <span className="td-icon">
            <Icon name="person" size={20} />
          </span>
          <div>
            <p className="td-item-main">{d.organizer}</p>
            {d.agencyName && (
              <p
                className="td-item-sub"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Icon name="building" size={14} /> Mewakili {d.agencyName}
              </p>
            )}
          </div>
        </div>
      </section>

      {d.organizerPhone && (
        <InfoCard title="Nomor Telepon Penyelenggara" icon="phone">
          {formatPhone(d.organizerPhone)}
        </InfoCard>
      )}

      <InfoCard title="Lokasi" icon="pin" sub={offline ? d.address : ""}>
        {place}
      </InfoCard>

      <section className="td-card">
        <h2>Deskripsi</h2>
        <p className={`td-desc ${expanded ? "open" : ""}`}>
          {d.description || "-"}
        </p>
        {longText && (
          <button
            type="button"
            className="td-more"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Sembunyikan" : "Lihat Selengkapnya"}
            <Icon name={expanded ? "chevron-up" : "chevron-down"} size={14} />
          </button>
        )}
      </section>

      {d.otherPrizes.length > 0 && (
        <section className="td-card">
          <h2>Hadiah Lainnya</h2>
          {d.otherPrizes.map((h, i) => (
            <div className="td-item" key={i}>
              <span className="td-icon">
                <Icon name="trophy" size={20} />
              </span>
              <div>
                <p className="td-item-main">{h.name}</p>
                {h.note && <p className="td-item-sub">{h.note}</p>}
              </div>
            </div>
          ))}
        </section>
      )}

      {d.sponsors.length > 0 && (
        <section className="td-card">
          <h2>Sponsor</h2>

          {d.sponsors.map((name, i) => (
            <div className="td-item" key={i}>
              <span className="td-icon">
                <Icon name="user-plus" size={20} />
              </span>
              <p className="td-item-main">{name}</p>
            </div>
          ))}
        </section>
      )}

      {payments.length > 0 && d.feeType !== "gratis" && (
        <section className="td-card">
          <h2>Metode Pembayaran</h2>
          {payments.map((m) => (
            <div className="td-item" key={m.label}>
              <span className="td-icon">
                <Icon name={m.icon} size={20} />
              </span>
              <p className="td-item-main">{m.label}</p>
            </div>
          ))}
        </section>
      )}

      {d.organizerUsername && (
        <div className="td-host">
          <small>PENYELENGGARA</small>
          {/* PB-23: avatar & username bisa diklik membuka profil (kalau id tersedia) */}
          {d.organizerPlayerId ? (
            <button
              type="button"
              className="td-host-link"
              title="Lihat profil penyelenggara"
              onClick={() =>
                navigate(`/player/${d.organizerPlayerId}`, {
                  state: { area: "turnamen" },
                })
              }
            >
              <Avatar
                src={d.organizerAvatar}
                name={d.organizerUsername}
                size={44}
              />
              <p>@{d.organizerUsername}</p>
            </button>
          ) : (
            <>
              <Avatar
                src={d.organizerAvatar}
                name={d.organizerUsername}
                size={44}
              />
              <p>@{d.organizerUsername}</p>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default TournamentInfo;
