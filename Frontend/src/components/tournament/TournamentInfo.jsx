import { useState } from "react";
import Icon from "../icon";
import { longDate } from "../../utils/date";

// Belum ada fitur pendaftaran: jumlah terdaftar berupa teks tetap.
// Hapus saat backend menyediakan jumlah peserta.
const REGISTERED_PLACEHOLDER = 32;

const STATUS_LABEL = {
  pendaftaran: "Pendaftaran",
  berlangsung: "Berlangsung",
  selesai: "Selesai",
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

function InfoCard({ title, icon, children, sub }) {
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
        </div>
      </div>
    </section>
  );
}

// d = hasil getTournamentDetail. action = tombol opsional di kartu ringkasan.
function TournamentInfo({ d, action }) {
  const [expanded, setExpanded] = useState(false);

  const offline = d.type === "offline";
  const place = offline
    ? [d.city, d.province].filter(Boolean).join(", ")
    : "Online";
  const percent = d.slot
    ? Math.min(100, Math.round((REGISTERED_PLACEHOLDER / Number(d.slot)) * 100))
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
            <span className={`t-status ${d.status}`}>
              <i></i> {STATUS_LABEL[d.status] ?? d.status}
            </span>
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
                {REGISTERED_PLACEHOLDER} / {d.slot ?? "-"}
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
              <b>{longDate(d.closeDate)}</b>
            </div>
            <div>
              <small>
                <Icon name="zap" size={13} /> Jadwal tanding
              </small>
              <b>{longDate(d.matchDate)}</b>
            </div>
          </div>

          {action}
        </section>
      </div>

      <InfoCard title="Nama Penyelenggara" icon="person">
        {d.organizer}
      </InfoCard>
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
    </>
  );
}

export default TournamentInfo;
