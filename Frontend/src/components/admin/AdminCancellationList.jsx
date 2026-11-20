import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Pagination from "./Pagination";
import CancellationIcon from "../kelola/CancellationIcon";
import Icon from "../icon";
import { getAdminCancellations } from "../../services/adminCancellationApi";
import { formatShortDate } from "../../services/tournamentCancellationApi";
import "../../styles/tournament-cancellation.css";

const PAGE_SIZE = 7;
const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "menunggu", label: "Menunggu" },
  { value: "disetujui", label: "Disetujui" },
  { value: "ditolak", label: "Ditolak" },
];
const BADGE = { menunggu: "blue", disetujui: "green", ditolak: "red" };
const BADGE_TEXT = {
  menunggu: "Menunggu",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
};

// Lama menunggu dalam hari penuh, dihitung di browser dari tanggal pengajuan (tanpa polling).
function waitingDays(request, now) {
  const start = new Date(request.submittedAt ?? "").getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 86400000));
}

// Isi tab "Pembatalan Turnamen" di halaman Pengajuan Turnamen (admin).
// 2 request paralel saat dibuka: status=menunggu dan status=riwayat.
function AdminCancellationList() {
  const [state, setState] = useState({
    waiting: null,
    history: null,
    error: "",
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let off = false;
    Promise.all([
      getAdminCancellations("menunggu"),
      getAdminCancellations("riwayat"),
    ])
      .then(
        ([waiting, history]) =>
          !off && setState({ waiting, history, error: "" }),
      )
      .catch(
        (err) =>
          !off &&
          setState({
            waiting: null,
            history: null,
            error: err.message || "Daftar pembatalan tidak dapat dimuat.",
          }),
      );
    return () => {
      off = true;
    };
  }, []);

  const loading = !state.waiting && !state.error;
  const items = useMemo(
    () => [...(state.waiting?.items ?? []), ...(state.history?.items ?? [])],
    [state.waiting, state.history],
  );
  const overdueCount = state.waiting?.overdue ?? 0;
  const waitingCount = state.waiting?.waiting ?? 0;
  const deadlineDays = state.waiting?.deadlineDays ?? 3;

  const keyword = search.trim().toLowerCase();
  const filtered = items.filter(
    (r) =>
      (!status || r.status === status) &&
      (r.tournament.name.toLowerCase().includes(keyword) ||
        r.tournament.organizer.toLowerCase().includes(keyword)),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <>
      {overdueCount > 0 ? (
        <div className="sub-banner priority">
          <span className="sub-banner-icon">
            <CancellationIcon name="clock" size={20} />
          </span>
          <div className="sub-banner-text">
            <strong>
              {overdueCount} pengajuan pembatalan belum diverifikasi lebih dari{" "}
              {deadlineDays} hari
              <span className="sub-pri-tag">HIGH PRIORITY</span>
            </strong>
            <p>
              Halaman admin lain terkunci sampai semua pengajuan terlambat
              selesai diverifikasi.
            </p>
          </div>
          <div className="sub-banner-actions">
            <span className="sub-remaining">
              <i></i> Sisa {overdueCount}
            </span>
          </div>
        </div>
      ) : (
        waitingCount > 0 && (
          <div className="sub-banner">
            <span className="sub-banner-icon">
              <CancellationIcon name="hourglass" size={20} />
            </span>
            <div className="sub-banner-text">
              <strong>
                {waitingCount} pengajuan pembatalan menunggu verifikasi
              </strong>
              <p>Segera tinjau pengajuan pembatalan</p>
            </div>
          </div>
        )
      )}

      <section className="admin-panel">
        <div className="sub-toolbar">
          <div className="admin-search">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Cari nama turnamen, penyelenggara..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="admin-filter-select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {state.error && <p className="admin-message error">{state.error}</p>}

        <div className="s-table-wrap">
          <table className="s-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Turnamen</th>
                <th>Nama Penyelenggara</th>
                <th>Tanggal Pengajuan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, index) => (
                <tr
                  key={r.id}
                  className={
                    r.overdue && r.status === "menunggu" ? "priority" : ""
                  }
                >
                  <td>{startIndex + index + 1}</td>
                  <td>
                    <span className="sub-name">{r.tournament.name}</span>
                    {r.overdue && r.status === "menunggu" && (
                      <span className="sub-warn" title="Prioritas verifikasi">
                        <CancellationIcon name="warn" size={14} />
                      </span>
                    )}
                  </td>
                  <td>{r.tournament.organizer}</td>
                  <td>
                    <span className="sub-date">
                      {formatShortDate(r.submittedAt)}
                    </span>
                    {r.status === "menunggu" && (
                      <small className={`sub-wait ${r.overdue ? "late" : ""}`}>
                        Menunggu {waitingDays(r, now)} hari
                      </small>
                    )}
                  </td>
                  <td>
                    <span className={`s-badge ${BADGE[r.status] ?? "gray"}`}>
                      <i></i> {BADGE_TEXT[r.status] ?? r.status}
                    </span>
                  </td>
                  <td>
                    <Link
                      to={`/admin/pengajuan/pembatalan/${r.id}`}
                      className="s-detail-btn"
                    >
                      Detail <CancellationIcon name="chevron-right" size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
              {loading &&
                [0, 1, 2].map((n) => (
                  <tr key={`skel-${n}`} aria-hidden="true">
                    <td colSpan={6}>
                      <div className="cancel-skel row" />
                    </td>
                  </tr>
                ))}
              {!loading && !state.error && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="admin-empty">
                    {items.length === 0
                      ? "Belum ada pengajuan pembatalan."
                      : "Pengajuan tidak ditemukan."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Pagination
        page={safePage}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />
    </>
  );
}

export default AdminCancellationList;
