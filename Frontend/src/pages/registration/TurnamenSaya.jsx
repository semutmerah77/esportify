import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../../components/icon";
import Pagination from "../../components/admin/Pagination";
import { StatusPill } from "../../components/registration/RegParts";
import { getMySquads } from "../../services/squadApi";
import { getSquadRegistrations } from "../../services/tournamentRegApi";
import "../../styles/turnamen-daftar.css";

const PAGE = 5;
const dateText = (v) =>
  v
    ? new Date(v).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

function TurnamenSaya() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("diikuti"); // "diikuti" | "status"
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // Tidak ada endpoint daftar untuk player: gabungkan pendaftaran dari semua squad milik player
  useEffect(() => {
    let off = false;
    getMySquads()
      .then((squads) =>
        Promise.all(
          squads.map((s) =>
            getSquadRegistrations(s.squadId)
              .then((list) => list.map((r) => ({ ...r, squad: s })))
              .catch(() => []),
          ),
        ),
      )
      .then((all) => {
        if (off) return;
        setRows(
          all
            .flat()
            .sort((a, b) =>
              String(b.registeredAt).localeCompare(String(a.registeredAt)),
            ),
        );
      })
      .catch(
        (err) => !off && setError(err.message || "Gagal memuat turnamen."),
      );
    return () => {
      off = true;
    };
  }, []);

  const switchTab = (k) => {
    setTab(k);
    setPage(1);
  };

  const list = (rows ?? []).filter((r) => {
    if (tab === "diikuti" && r.status !== "diterima") return false;
    const k = q.trim().toLowerCase();
    return (
      tab !== "diikuti" || !k || r.tournament.name?.toLowerCase().includes(k)
    );
  });
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const visible = list.slice((safePage - 1) * PAGE, safePage * PAGE);

  return (
    <div className="sq-page tr-page">
      <h1 className="admin-title">Turnamen Saya</h1>

      <div className="tr-tabs">
        <button
          type="button"
          className={tab === "diikuti" ? "on" : ""}
          onClick={() => switchTab("diikuti")}
        >
          Turnamen Diikuti
        </button>
        <button
          type="button"
          className={tab === "status" ? "on" : ""}
          onClick={() => switchTab("status")}
        >
          Status Pendaftaran
        </button>
      </div>

      {tab === "diikuti" && (
        <div className="sq-search tr-mysearch">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Cari turnamen"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
      )}

      {error && <p className="admin-message error">{error}</p>}

      {rows && !error && list.length === 0 && (
        <div className="tr-empty">
          <b>
            {tab === "diikuti"
              ? "Belum ada pendaftaran turnamen"
              : "Belum ada status pendaftaran"}
          </b>
          <button
            type="button"
            className="sq-btn primary"
            onClick={() => navigate("/turnamen/cari")}
          >
            Cari Turnamen
          </button>
        </div>
      )}

      {tab === "diikuti" &&
        visible.map((r) => (
          <Link
            key={r.id}
            to={`/pendaftaran/${r.id}`}
            className="tr-card tr-mycard"
          >
            <div>
              <b>{r.tournament.name}</b>
              <small>Squad: {r.squad.name}</small>
              <small>
                <Icon name="calendar" size={12} /> {dateText(r.tournament.date)}
              </small>
            </div>
            <span>
              {r.rosterLocked && (
                <span className="tr-lock">
                  <Icon name="lock" size={12} /> Roster Terkunci
                </span>
              )}
              <StatusPill status={r.status} />
            </span>
          </Link>
        ))}

      {tab === "status" && visible.length > 0 && (
        <div className="tr-card tr-tablewrap">
          <table className="tr-table">
            <thead>
              <tr>
                <th>Nama Turnamen</th>
                <th>Squad</th>
                <th>Status Pendaftaran</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.tournament.name}</b>
                  </td>
                  <td>{r.squad.name}</td>
                  <td>
                    <StatusPill status={r.status} />
                    {r.status === "ditolak" && r.reason && (
                      <small className="tr-reason">{r.reason}</small>
                    )}
                  </td>
                  <td>
                    <Link
                      className="sq-btn outline"
                      to={`/turnamen/cari/${r.tournament.id}`}
                    >
                      Lihat Turnamen
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.length > PAGE && (
        <Pagination
          page={safePage}
          totalItems={list.length}
          pageSize={PAGE}
          onChange={setPage}
        />
      )}
    </div>
  );
}

export default TurnamenSaya;
