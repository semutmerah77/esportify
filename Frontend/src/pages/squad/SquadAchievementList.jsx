import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/icon";
import SquadGameFilter from "../../components/squad/SquadGameFilter";
import SquadPager from "../../components/squad/SquadPager";
import {
  getSquadAchievements,
  getSquadBadge,
} from "../../services/squadPerformanceApi";
import "../../styles/squad.css";
import "../../styles/squad-performance.css";

const PAGE_SIZE = 5;
const TONE_BY_RANK = { 1: "gold", 2: "silver", 3: "bronze" };

const STATS = [
  {
    tone: "gold",
    key: "first",
    label: "JUARA 1 TURNAMEN",
    text: "Trofi Emas",
    mark: "#1",
  },
  {
    tone: "silver",
    key: "second",
    label: "RUNNER-UP TURNAMEN",
    text: "Trofi Perak",
    mark: "#2",
  },
  {
    tone: "bronze",
    key: "third",
    label: "PERINGKAT 3 TURNAMEN",
    text: "Trofi Perunggu",
    mark: "#3",
  },
];

function GameIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="15" y1="13" x2="15.01" y2="13" />
      <line x1="18" y1="11" x2="18.01" y2="11" />
      <rect x="2" y="6" width="20" height="12" rx="4" />
    </svg>
  );
}

// Halaman "Lihat Semua" badge: jumlah Juara 1-3 dan riwayat turnamen selesai yang diikuti Squad.
// Dua request paralel saat halaman dibuka; filter game dan paging dikerjakan di FE.
function SquadAchievementList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [badge, setBadge] = useState(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [gameId, setGameId] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let off = false;
    setBadge(null);
    setItems(null);
    setError("");
    Promise.all([getSquadBadge(id), getSquadAchievements(id)])
      .then(([b, list]) => {
        if (off) return;
        setBadge(b);
        setItems(list);
      })
      .catch(
        (err) =>
          !off && setError(err.message || "Gagal memuat riwayat pencapaian."),
      );
    return () => {
      off = true;
    };
  }, [id]);

  // Pilihan dropdown: game yang pernah diikuti (diambil dari riwayat yang sudah dimuat)
  const games = useMemo(() => {
    const map = new Map();
    (items ?? []).forEach((a) => map.set(a.game.id, a.game));
    return [...map.values()];
  }, [items]);

  const shown =
    gameId === "all"
      ? (items ?? [])
      : (items ?? []).filter((a) => String(a.game.id) === gameId);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const loading = !error && (!badge || !items);

  const changeGame = (value) => {
    setGameId(value);
    setPage(1);
  };

  return (
    <div className="sq-page">
      <button
        type="button"
        className="d-back"
        onClick={() => navigate(`/squad/${id}`)}
      >
        <Icon name="chevron-left" size={26} /> Kembali ke detail squad
      </button>

      {error && <p className="admin-message error">{error}</p>}

      {loading && (
        <>
          <div className="sac-stats">
            <div className="sp-skel stat" />
            <div className="sp-skel stat" />
            <div className="sp-skel stat" />
          </div>
          <div className="sp-skel card" />
        </>
      )}

      {badge && items && (
        <>
          <div className="sac-stats">
            {STATS.map((s) => (
              <div key={s.tone} className={`sac-stat ${s.tone}`}>
                <span className="sac-stat-ic">
                  <Icon name="trophy" size={22} />
                </span>
                <div>
                  <small>{s.label}</small>
                  <p>
                    <b>{badge[s.key]}</b> {s.text}
                  </p>
                </div>
                <em>{s.mark}</em>
              </div>
            ))}
          </div>

          <section className="sac-card">
            <header className="sac-card-head">
              <h2>Daftar Lencana Kemenangan</h2>
              {games.length > 0 && (
                <SquadGameFilter
                  games={games}
                  value={gameId}
                  onChange={changeGame}
                />
              )}
            </header>

            {items.length === 0 ? (
              <p className="sqd-empty">Belum ada data.</p>
            ) : (
              <>
                <ul className="sac-list">
                  {visible.map((a) => (
                    <li
                      key={a.id}
                      className={`sac-row ${TONE_BY_RANK[a.rank] ?? "none"}`}
                    >
                      <span className="sac-trophy">
                        <Icon name="trophy" size={22} />
                      </span>
                      <div className="sac-main">
                        <b title={a.name}>{a.name}</b>
                        <span>
                          <GameIcon /> {a.game.name}
                        </span>
                      </div>
                      <span className="sac-pill">
                        <i /> {a.rankLabel}
                      </span>
                    </li>
                  ))}
                </ul>
                <SquadPager page={current} pages={pages} onChange={setPage} />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default SquadAchievementList;
