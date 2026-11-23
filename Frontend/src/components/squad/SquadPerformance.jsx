import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../icon";
import {
  formatPercent,
  getSquadBadge,
  getSquadWinRate,
} from "../../services/squadPerformanceApi";
import "../../styles/squad-performance.css";

const BADGES = [
  { type: "gold", key: "first", title: "Gold Trophy", label: "Juara 1" },
  { type: "silver", key: "second", title: "Silver Trophy", label: "Runner Up" },
  {
    type: "bronze",
    key: "third",
    title: "Bronze Trophy",
    label: "Peringkat 3",
  },
];

// Warna bar mengikuti persentase (sama dengan halaman Daftar Winrate)
const rateTone = (pct) => (pct >= 100 ? "c2" : pct >= 80 ? "c0" : "c1");

// Dua kartu: Winrate Squad dan Koleksi Badge Prestasi.
// Hanya 2 endpoint ringan (paralel). Rincian per game dimuat di halaman "Lihat Semua".
function SquadPerformance({ squadId }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let off = false;
    setState({ status: "loading" });
    Promise.all([getSquadWinRate(squadId), getSquadBadge(squadId)])
      .then(
        ([winRate, badge]) =>
          !off && setState({ status: "ok", winRate, badge }),
      )
      .catch(
        (err) =>
          !off &&
          setState({
            status: "error",
            message: err.message || "Gagal memuat performa squad.",
          }),
      );
    return () => {
      off = true;
    };
  }, [squadId]);

  const { status, winRate, badge } = state;
  const totalBadge = badge ? badge.first + badge.second + badge.third : 0;
  const pct = winRate?.winRate ?? 0;

  return (
    <div className="sqd-perf">
      <section className="sqd-card">
        <header className="sqd-card-head">
          <h3>
            <i className="sqd-dot blue" /> WINRATE SQUAD
          </h3>
          <button
            type="button"
            className="sqd-link"
            onClick={() => navigate(`/squad/${squadId}/winrate`)}
          >
            Lihat Semua <Icon name="chevron-right" size={13} />
          </button>
        </header>

        {status === "loading" && <div className="sp-skel block" />}
        {status === "error" && <p className="sqd-empty">{state.message}</p>}
        {status === "ok" && !winRate.hasData && (
          <p className="sqd-empty">Belum ada data.</p>
        )}
        {status === "ok" && winRate.hasData && (
          <div className="sqd-rates">
            <div className={`sqd-rate ${rateTone(pct)}`}>
              <div className="sqd-rate-top">
                <span>
                  <i className="sqd-dot" /> Semua Game
                </span>
                <span className="sqd-rate-num">
                  <small>
                    ({winRate.totalFirst}/{winRate.totalTournaments})
                  </small>{" "}
                  <b>{formatPercent(pct)}</b>
                </span>
              </div>
              <div className="sqd-bar">
                <i style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        <p className="sqd-note">
          <Icon name="info" size={12} /> Metode: (Total Kemenangan / Total
          Pertandingan per Game) × 100%
        </p>
      </section>

      <section className="sqd-card">
        <header className="sqd-card-head">
          <h3>
            <i className="sqd-dot amber" /> KOLEKSI BADGE PRESTASI
          </h3>
          <button
            type="button"
            className="sqd-link"
            onClick={() => navigate(`/squad/${squadId}/lencana`)}
          >
            Lihat Semua
            <Icon name="chevron-right" size={13} />
          </button>
        </header>

        {status === "loading" && <div className="sp-skel block" />}
        {status === "error" && <p className="sqd-empty">{state.message}</p>}
        {status === "ok" && totalBadge === 0 && (
          <p className="sqd-empty">
            Belum ada badge. Raih juara 1, 2, atau 3 untuk mendapatkannya.
          </p>
        )}
        {status === "ok" && totalBadge > 0 && (
          <div className="sqd-badges">
            {BADGES.map((b) => (
              <div key={b.type} className={`sqd-badge ${b.type}`}>
                <span className="sqd-badge-ic">
                  <Icon name="trophy" size={18} />
                </span>
                <strong>
                  {badge[b.key]}
                  <small>x</small>
                </strong>
                <b>{b.title}</b>
                <em>{b.label}</em>
              </div>
            ))}
          </div>
        )}

        <p className="sqd-note">
          <Icon name="sparkles" size={12} /> Badge dihitung dan ditampilkan
          berdasarkan akumulasi seluruh divisi game
        </p>
      </section>
    </div>
  );
}

export default SquadPerformance;
