import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/icon";
import TournamentTabs from "../../components/tournament/TournamentTabs";
import ManagedTournamentCard from "../../components/tournament/ManagedTournamentCard";
import { getManagedTournaments } from "../../services/tournamentApi";

const FILTERS = [
  { value: "", label: "Semua" },
  { value: "pendaftaran", label: "Pendaftaran" },
  { value: "berlangsung", label: "Berlangsung" },
  { value: "selesai", label: "Selesai" },
];

function CardSkeleton() {
  return (
    <div className="t-card t-skel" aria-hidden="true">
      <i className="w30" />
      <i className="w15" />
      <div className="t-skel-grid">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <i className="bar" />
    </div>
  );
}

function ManageTournaments() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let off = false;
    getManagedTournaments()
      .then((list) => !off && setItems(list))
      .catch((err) => !off && setError(err.message))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, []);

  // Pencarian dan filter dikerjakan di klien, sementara.
  // Filter memakai status asli turnamen (Tertunda & Pendaftaran ditutup tetap termasuk "Pendaftaran").
  const keyword = search.trim().toLowerCase();
  const visible = items.filter(
    (t) =>
      (!filter || t.status === filter) &&
      (t.name.toLowerCase().includes(keyword) ||
        t.game.toLowerCase().includes(keyword)),
  );

  return (
    <>
      <h1 className="admin-title">Kelola Turnamen</h1>
      <TournamentTabs />

      <section className="admin-panel">
        <h2 className="t-section-title">Turnamen Kelolaan</h2>

        <div className="admin-filters">
          <div className="admin-search">
            <Icon name="search" size={18} />
            <input
              type="text"
              placeholder="Cari turnamen yang dikelola"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Halaman buat turnamen belum ada */}
          <Link to="/turnamen/buat" className="admin-outline-btn">
            <Icon name="plus" size={16} /> Buat Turnamen
          </Link>
        </div>

        <div className="t-filters" role="group" aria-label="Filter status">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={`t-filter ${filter === f.value ? "active" : ""}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && <p className="admin-message error">{error}</p>}

        {loading && (
          <div className="t-list">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        <div className="t-list">
          {visible.map((t) => (
            <ManagedTournamentCard key={t.id} tournament={t} />
          ))}
        </div>

        {!loading && !error && visible.length === 0 && (
          <p className="admin-message">
            {items.length === 0
              ? "Belum ada turnamen yang kamu kelola."
              : "Turnamen tidak ditemukan."}
          </p>
        )}
      </section>
    </>
  );
}

export default ManageTournaments;
