import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/icon";
import SquadGameFilter from "../../components/squad/SquadGameFilter";
import SquadPager from "../../components/squad/SquadPager";
import {
  formatPercent,
  getSquadWinRateDetail,
} from "../../services/squadPerformanceApi";
import "../../styles/squad.css";
import "../../styles/squad-performance.css";

const PAGE_SIZE = 4;
const toneOf = (pct) => (pct >= 100 ? "pink" : pct >= 80 ? "cyan" : "amber");
const ratioText = (pct) =>
  pct >= 100 ? "100% Sempurna" : `${Number(pct.toFixed(1))}% Rasio Juara`;

// Halaman "Lihat Semua" Winrate Squad: satu kartu per game yang pernah diikuti.
// Data dimuat SEKALI saat halaman dibuka; filter game dan paging dikerjakan di FE (tanpa request baru).
function SquadWinRateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [gameId, setGameId] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let off = false;
    setData(null);
    setError("");
    getSquadWinRateDetail(id)
      .then((res) => !off && setData(res))
      .catch(
        (err) =>
          !off && setError(err.message || "Gagal memuat daftar winrate."),
      );
    return () => {
      off = true;
    };
  }, [id]);

  const back = (
    <button
      type="button"
      className="d-back"
      onClick={() => navigate(`/squad/${id}`)}
    >
      <Icon name="chevron-left" size={26} /> Kembali
    </button>
  );

  const games = data?.games ?? [];
  const shown =
    gameId === "all" ? games : games.filter((g) => String(g.id) === gameId);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const changeGame = (value) => {
    setGameId(value);
    setPage(1);
  };

  return (
    <div className="sq-page">
      {back}

      <header className="sp-head">
        <div>
          <h1>Daftar Winrate</h1>
          <p>Riwayat performa winrate turnamen yang diikuti.</p>
        </div>
        {data && games.length > 0 && (
          <SquadGameFilter games={games} value={gameId} onChange={changeGame} />
        )}
      </header>

      {error && <p className="admin-message error">{error}</p>}

      {!data && !error && (
        <div className="swr-list">
          <div className="sp-skel card" />
          <div className="sp-skel card" />
          <div className="sp-skel card" />
        </div>
      )}

      {data && games.length === 0 && (
        <p className="sp-empty">Belum ada data.</p>
      )}

      {data && games.length > 0 && (
        <>
          <div className="swr-list">
            {visible.map((g) => {
              const pct = g.winRate ?? 0;
              return (
                <section key={g.id} className={`swr-card ${toneOf(pct)}`}>
                  <div className="swr-top">
                    <span className="swr-icon">
                      <i />
                      {g.avatar && (
                        <img
                          src={g.avatar}
                          alt=""
                          loading="lazy"
                          onError={(e) =>
                            (e.currentTarget.style.display = "none")
                          }
                        />
                      )}
                    </span>
                    <b className="swr-name">{g.name}</b>
                    <div className="swr-score">
                      <b>{formatPercent(pct)}</b>
                      <small>
                        ({g.totalFirst} Menang / {g.totalTournaments} Total
                        Match)
                      </small>
                    </div>
                  </div>

                  <div className="swr-bar">
                    <i style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="swr-meta">
                    <span>
                      Winrate Juara 1: {g.totalFirst} dari {g.totalTournaments}{" "}
                      Turnamen
                    </span>
                    <b>{ratioText(pct)}</b>
                  </div>

                  <div className="swr-tiles">
                    <div className="swr-tile">
                      <span>Total Turnamen Diikuti</span>
                      <b>{g.totalTournaments} Match</b>
                    </div>
                    <div className="swr-tile win">
                      <span>Total Juara 1 (Win)</span>
                      <b>{g.totalFirst}x Juara</b>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          <SquadPager page={current} pages={pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export default SquadWinRateDetail;
