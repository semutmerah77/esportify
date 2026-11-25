import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Icon from "../components/icon";
import { useAuth } from "../context/AuthContext";
import { getCachedHome, getHome } from "../services/homeApi";
import "../styles/home.css";

const TOURNAMENT_STATUS = {
  pendaftaran: { label: "Pendaftaran", tone: "green" },
  berlangsung: { label: "Berlangsung", tone: "amber" },
  selesai: { label: "Selesai", tone: "gray" },
  dibatalkan: { label: "Dibatalkan", tone: "red" },
};

const dateText = (iso, options) => {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    ...options,
    timeZone: "Asia/Jakarta",
  });
};
const shortDate = (iso) =>
  dateText(iso, { day: "numeric", month: "short", year: "numeric" });
const longDate = (iso) =>
  dateText(iso, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
const rupiah = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

function Badge({ tone, children }) {
  return <span className={`hm-badge ${tone}`}>{children}</span>;
}

// Tombol Secondary Outline ("Detail"): small 32px / medium 40px
function DetailButton({ children, onClick, size = "sm" }) {
  return (
    <button
      type="button"
      className={`hm-btn ${size}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children} <Icon name="chevron-right" size={14} />
    </button>
  );
}

function Section({ title, showAll, onAll, children }) {
  return (
    <section className="hm-section">
      <div className="hm-head">
        <h2>{title}</h2>
        {showAll && (
          <button type="button" className="hm-all" onClick={onAll}>
            Lihat semua <Icon name="chevron-right" size={14} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function SkeletonCards({ count = 3, tall = false }) {
  return (
    <div className={`hm-grid ${tall ? "latest" : "joined"}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className={`hm-card hm-skel-card ${tall ? "tall" : ""}`} key={i}>
          <i className="hm-skel w60" />
          <i className="hm-skel w40" />
          <i className="hm-skel w80" />
          <i className="hm-skel w50" />
        </div>
      ))}
    </div>
  );
}

function TypeIcon({ type }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  return type === "online" ? (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
    </svg>
  ) : (
    <svg {...common}>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function PosterStar() {
  return (
    <svg
      className="hm-poster-star"
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2l3 6.3 6.9.9-5 4.8 1.2 6.9L12 17.6 5.9 20.9 7.1 14 2.1 9.2 9 8.3 12 2z" />
    </svg>
  );
}

function UserHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ctx = useOutletContext();
  const name = ctx?.profile?.username ?? user?.username ?? "";

  const [home, setHome] = useState(() => getCachedHome());
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  // Satu request saat Home dibuka. Kalau cache masih segar (<45 detik) tidak ada request.
  useEffect(() => {
    if (attempt === 0 && getCachedHome()) return undefined;
    let off = false;
    const ctrl = new AbortController();
    setError("");
    getHome({ signal: ctrl.signal })
      .then((data) => !off && setHome(data))
      .catch((err) => {
        if (off || err?.name === "AbortError") return;
        setError(
          err.status === 403
            ? "Kamu tidak punya akses ke halaman Home."
            : err.message || "Halaman Home tidak dapat dimuat.",
        );
      });
    return () => {
      off = true;
      ctrl.abort();
    };
  }, [attempt]);

  // state.area = "home": sidebar tetap menyalakan menu Home di halaman tujuan
  const go = (to) => navigate(to, { state: { area: "home" } });
  const loading = !home && !error;

  return (
    <div className="hm-page">
      <h1 className="admin-title">
        Hallo{name ? `, ${name}` : ""}! Selamat datang kembali di Esportify.
      </h1>

      {error && (
        <p className="admin-message error">
          {error}{" "}
          <button
            type="button"
            className="hm-retry"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Coba lagi
          </button>
        </p>
      )}

      {/* ---------- Turnamen diikuti ---------- */}
      {!error && (
        <Section
          title="Turnamen diikuti"
          showAll={home && home.joined.total > home.joined.items.length}
          onAll={() => navigate("/turnamen/saya")}
        >
          {loading && <SkeletonCards />}
          {home && home.joined.items.length === 0 && (
            <p className="hm-empty">Belum mengikuti turnamen</p>
          )}
          {home && home.joined.items.length > 0 && (
            <div className="hm-grid joined">
              {home.joined.items.map((t) => {
                const st = TOURNAMENT_STATUS[t.status];
                return (
                  <article
                    key={t.registrationId}
                    className="hm-card"
                    onClick={() => go(`/turnamen/cari/${t.id}`)}
                  >
                    <div className="hm-card-top">
                      <h3 title={t.name}>{t.name}</h3>
                      {st && <Badge tone={st.tone}>{st.label}</Badge>}
                    </div>
                    <p className="hm-game">{t.game}</p>
                    <ul className="hm-meta">
                      <li>
                        <Icon name="calendar" size={14} /> {shortDate(t.playAt)}
                      </li>
                      {t.type && (
                        <li>
                          <TypeIcon type={t.type} />{" "}
                          {t.type === "online" ? "Online" : "Offline"}
                        </li>
                      )}
                      {t.squad && (
                        <li>
                          <Icon name="shield" size={14} /> Squad: {t.squad.name}
                        </li>
                      )}
                    </ul>
                    <div className="hm-card-foot">
                      <DetailButton
                        onClick={() => go(`/turnamen/cari/${t.id}`)}
                      >
                        Detail
                      </DetailButton>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* ---------- Komunitas diikuti (selalu kosong sampai Fase 3) ---------- */}
      {!error && (
        <Section title="Komunitas diikuti">
          {loading ? (
            <SkeletonCards count={1} />
          ) : (
            <p className="hm-empty">Belum ada komunitas</p>
          )}
        </Section>
      )}

      {/* ---------- Squad kamu ---------- */}
      {!error && (
        <Section
          title="Squad kamu"
          showAll={home && home.squads.total > home.squads.items.length}
          onAll={() => navigate("/squad/saya")}
        >
          {loading && <SkeletonCards count={1} />}
          {home && home.squads.items.length === 0 && (
            <div className="hm-card hm-squad-empty">
              <p>Belum bergabung dengan squad</p>
              <div className="hm-actions">
                <DetailButton
                  size="md"
                  onClick={() =>
                    navigate("/squad/saya", { state: { openCreate: true } })
                  }
                >
                  Buat Squad
                </DetailButton>
                <DetailButton size="md" onClick={() => navigate("/squad/cari")}>
                  Cari Squad
                </DetailButton>
              </div>
            </div>
          )}
          {home && home.squads.items.length > 0 && (
            <div className="hm-card hm-squad-box">
              <p className="hm-squad-lead">Daftar Squad yang kamu ikuti.</p>
              {home.squads.items.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="hm-squad-row"
                  onClick={() =>
                    navigate(`/squad/${s.code}`, {
                      state: { area: "home", from: "saya" },
                    })
                  }
                >
                  <span className="hm-squad-logo">
                    {initials(s.name)}
                    {s.logo && (
                      <img
                        src={s.logo}
                        alt=""
                        width="40"
                        height="40"
                        loading="lazy"
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                    )}
                  </span>
                  <span className="hm-squad-name">
                    <b>{s.name}</b>
                    {s.members != null && <small>{s.members} Anggota</small>}
                  </span>
                  <code>ID: {s.code}</code>
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ---------- Turnamen terbaru ---------- */}
      {!error && (
        <Section
          title="Turnamen terbaru"
          showAll={home && home.latest.total > home.latest.items.length}
          onAll={() => navigate("/turnamen/cari")}
        >
          {loading && <SkeletonCards count={4} tall />}
          {home && home.latest.items.length === 0 && (
            <p className="hm-empty">Belum ada turnamen terbaru</p>
          )}
          {home && home.latest.items.length > 0 && (
            <div className="hm-grid latest">
              {home.latest.items.map((t) => (
                <article
                  key={t.id}
                  className="hm-card hm-new"
                  onClick={() => go(`/turnamen/cari/${t.id}`)}
                >
                  <div className="hm-poster">
                    <PosterStar />
                    {t.poster && (
                      <img
                        src={t.poster}
                        alt=""
                        width="240"
                        height="150"
                        loading="lazy"
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                    )}
                    <span className="hm-chip game">{t.game}</span>
                    {t.type && (
                      <span className={`hm-chip type ${t.type}`}>
                        {t.type === "online" ? "Online" : "Offline"}
                      </span>
                    )}
                  </div>

                  <p className="hm-new-date">
                    <Icon name="calendar" size={14} /> {longDate(t.playAt)}
                  </p>
                  <h3 title={t.name}>{t.name}</h3>

                  <dl className="hm-money">
                    <div>
                      <dt>Total Hadiah</dt>
                      <dd className="prize">{rupiah(t.prize)}</dd>
                    </div>
                    <div>
                      <dt>Biaya Pendaftaran</dt>
                      <dd>{t.fee > 0 ? rupiah(t.fee) : "Gratis"}</dd>
                    </div>
                  </dl>
                  <div className="hm-slot">
                    <span>Slot Terisi</span>
                    <b>
                      {t.slotFilled} / {t.slot}
                    </b>
                  </div>
                  <div
                    className="hm-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={t.slot}
                    aria-valuenow={Math.min(t.slotFilled, t.slot)}
                  >
                    <i
                      style={{
                        width: `${Math.round(Math.min(t.slotFilled / (t.slot || 1), 1) * 100)}%`,
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    className="hm-btn md block"
                    onClick={(e) => {
                      e.stopPropagation();
                      go(`/turnamen/cari/${t.id}`);
                    }}
                  >
                    Lihat Detail <Icon name="chevron-right" size={14} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

export default UserHome;
