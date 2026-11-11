import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/icon";
import { getMyTournaments } from "../../services/myTournamentsApi";
import "../../styles/turnamen-daftar.css";

const CARD_PAGE_SIZE = 4;
const TABLE_PAGE_SIZE = 6;

const dateText = (v) =>
  v
    ? new Date(v).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";

const FILTERS = [
  { value: "", label: "Semua" },
  { value: "pendaftaran", label: "Pendaftaran" },
  { value: "berlangsung", label: "Berlangsung" },
  { value: "selesai", label: "Selesai" },
];
const TOURNAMENT_STATUS = {
  pendaftaran: { label: "Pendaftaran", tone: "green" },
  berlangsung: { label: "Berlangsung", tone: "yellow" },
  selesai: { label: "Selesai", tone: "gray" },
};
const REGISTRATION_STATUS = {
  menunggu: { label: "Menunggu", tone: "yellow" },
  diterima: { label: "Diterima", tone: "green" },
  ditolak: { label: "Ditolak", tone: "red" },
};
const TYPE_INFO = {
  online: { label: "Online", icon: "globe" },
  offline: { label: "Offline", icon: "pin" },
};

function StatusPill({ status, map }) {
  const s = map[status];
  if (!s) return null;
  return (
    <span className={`mytour-pill ${s.tone}`}>
      <i></i> {s.label}
    </span>
  );
}

function SquadBadge({ name }) {
  return (
    <span className="mytour-squad">
      <span className="mytour-squad-ic">
        <Icon name="shield" size={12} />
      </span>
      {name}
    </span>
  );
}

// Kartu kosong: dipakai di kedua tab
function EmptyState({ title, text, withAction, compact }) {
  return (
    <div className={`mytour-empty ${compact ? "compact" : ""}`}>
      <span className="mytour-empty-ic">
        <Icon name="ticket" size={24} />
      </span>
      <b>{title}</b>
      <p>{text}</p>
      {withAction && (
        <Link to="/turnamen/cari" className="mytour-empty-btn">
          <Icon name="search" size={14} /> Cari Turnamen
        </Link>
      )}
    </div>
  );
}

// Nomor halaman + tombol sebelumnya/berikutnya
function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="mytour-pager" aria-label="Halaman">
      <button
        type="button"
        className="mytour-page arrow"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="Sebelumnya"
      >
        <Icon name="chevron-left" size={20} />
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={`mytour-page ${n === page ? "on" : ""}`}
          aria-current={n === page ? "page" : undefined}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className="mytour-page arrow next"
        disabled={page === pages}
        onClick={() => onChange(page + 1)}
        aria-label="Berikutnya"
      >
        <Icon name="chevron-left" size={20} />
      </button>
    </nav>
  );
}

function TurnamenSaya() {
  const [tab, setTab] = useState("diikuti"); // diikuti | status
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [cardPage, setCardPage] = useState(1);
  const [tablePage, setTablePage] = useState(1);

  useEffect(() => {
    let off = false;
    getMyTournaments()
      .then((list) => !off && setItems(list))
      .catch((err) => !off && setError(err.message || "Gagal memuat turnamen."))
      .finally(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, []);

  // Tab "Turnamen Diikuti": hanya pendaftaran yang sudah diterima
  const joined = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter(
      (t) =>
        t.status === "diterima" &&
        (!filter || t.tournamentStatus === filter) &&
        (!keyword ||
          t.name.toLowerCase().includes(keyword) ||
          t.game.toLowerCase().includes(keyword)),
    );
  }, [items, search, filter]);

  const cardPages = Math.max(1, Math.ceil(joined.length / CARD_PAGE_SIZE));
  const tablePages = Math.max(1, Math.ceil(items.length / TABLE_PAGE_SIZE));
  const cardRows = joined.slice(
    (cardPage - 1) * CARD_PAGE_SIZE,
    cardPage * CARD_PAGE_SIZE,
  );
  const tableRows = items.slice(
    (tablePage - 1) * TABLE_PAGE_SIZE,
    tablePage * TABLE_PAGE_SIZE,
  );

  const hasJoined = items.some((t) => t.status === "diterima");

  return (
    <div className="sq-page tr-page">
      <h1 className="admin-title">Turnamen Saya</h1>

      <div className="tr-tabs">
        <button
          type="button"
          className={tab === "diikuti" ? "on" : ""}
          onClick={() => setTab("diikuti")}
        >
          Turnamen Diikuti
        </button>
        <button
          type="button"
          className={tab === "status" ? "on" : ""}
          onClick={() => setTab("status")}
        >
          Status Pendaftaran
        </button>
      </div>

      {error && <p className="admin-message error">{error}</p>}

      {tab === "diikuti" && (
        <section>
          <h2 className="mytour-title">Turnamen Diikuti</h2>

          <div className="mytour-toolbar">
            <label className="mytour-search">
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Cari turnamen yang diikuti..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCardPage(1);
                }}
              />
            </label>
            <div
              className="mytour-filters"
              role="group"
              aria-label="Filter status turnamen"
            >
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`mytour-filter ${filter === f.value ? "on" : ""}`}
                  onClick={() => {
                    setFilter(f.value);
                    setCardPage(1);
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mytour-list">
            {cardRows.map((t) => {
              const type = TYPE_INFO[t.type];
              return (
                <Link
                  key={t.id}
                  to={`/pendaftaran/${t.id}`}
                  className="mytour-card"
                >
                  <div className="mytour-card-top">
                    <h3>{t.name}</h3>
                    <span className="mytour-card-side">
                      <StatusPill
                        status={t.tournamentStatus}
                        map={TOURNAMENT_STATUS}
                      />
                      <span className="mytour-chevron">
                        <Icon name="chevron-left" size={16} />
                      </span>
                    </span>
                  </div>
                  <p className="mytour-card-sub">
                    {t.game && <span>{t.game}</span>}
                    {t.game && <i></i>}
                    <span>Squad:</span>
                    <SquadBadge name={t.squadName} />
                  </p>
                  <div className="mytour-card-meta">
                    <span>
                      <Icon name="calendar" size={14} /> {dateText(t.matchDate)}
                    </span>
                    {type && (
                      <span>
                        <Icon name={type.icon} size={14} /> {type.label}
                      </span>
                    )}
                    {t.tournamentStatus === "pendaftaran" && t.slot != null && (
                      <span>
                        <Icon name="users" size={14} /> {t.filled ?? "-"}/
                        {t.slot} tim
                      </span>
                    )}
                    {t.rosterLocked && (
                      <span className="tr-lock">
                        <Icon name="lock" size={12} /> Roster Terkunci
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {ready && !error && joined.length === 0 && (
            <EmptyState
              title={
                hasJoined
                  ? "Turnamen tidak ditemukan"
                  : "Belum ada pendaftaran turnamen"
              }
              text={
                hasJoined
                  ? "Coba ubah kata kunci atau filter status."
                  : "Daftarkan squad kamu pada turnamen terbuka untuk mulai bertanding."
              }
              withAction={!hasJoined}
              compact={hasJoined}
            />
          )}

          <Pagination
            page={cardPage}
            pages={cardPages}
            onChange={setCardPage}
          />
        </section>
      )}

      {tab === "status" && (
        <section>
          <h2 className="mytour-title">Status Pendaftaran</h2>

          {ready && !error && items.length === 0 ? (
            <EmptyState
              title="Belum ada pendaftaran turnamen"
              text="Daftarkan squad kamu pada turnamen terbuka untuk mulai bertanding."
              withAction
            />
          ) : (
            items.length > 0 && (
              <div className="mytour-table-wrap">
                <table className="mytour-table">
                  <thead>
                    <tr>
                      <th>Nama Turnamen</th>
                      <th>Squad</th>
                      <th>Status Pendaftaran</th>
                      <th aria-label="Aksi"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <b>{t.name}</b>
                          {t.game && <small>{t.game}</small>}
                        </td>
                        <td>
                          <SquadBadge name={t.squadName} />
                        </td>
                        <td>
                          <StatusPill
                            status={t.status}
                            map={REGISTRATION_STATUS}
                          />
                          {t.status === "ditolak" && t.reason && (
                            <small className="tr-reason">{t.reason}</small>
                          )}
                        </td>
                        <td className="mytour-action">
                          <Link
                            to={`/turnamen/cari/${t.tournamentId}`}
                            className="mytour-view-btn"
                          >
                            Lihat Turnamen{" "}
                            <span className="mytour-chevron">
                              <Icon name="chevron-left" size={12} />
                            </span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          <Pagination
            page={tablePage}
            pages={tablePages}
            onChange={setTablePage}
          />
        </section>
      )}
    </div>
  );
}

export default TurnamenSaya;
