import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../../components/icon";
import Pagination from "../../components/admin/Pagination";
import SubmissionKindTabs from "../../components/admin/SubmissionKindTabs";
import AdminCancellationList from "../../components/admin/AdminCancellationList";
import SubmissionStatusBadge from "../../components/tournament/SubmissionStatusBadge";
import { useAdminPriority } from "../../context/AdminPriorityContext";
import {
  priorityLimitText,
  waitingSince,
  waitingText,
} from "../../utils/priority";
import "../../styles/user.css";

const PAGE_SIZE = 7;
const STATUSES = [
  "Menunggu Verifikasi",
  "Sedang diedit",
  "Sedang ditinjau",
  "Revisi",
  "Disetujui",
  "Ditolak",
];
const STATUS_LABEL = {
  Revisi: "Perlu Revisi",
  "Sedang diedit": "Sedang Diedit",
  "Sedang ditinjau": "Sedang Ditinjau",
};

const same = (a, b) =>
  String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

const formatDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
};

function AdminSubmissions() {
  const { items, priority, loading, error, now } = useAdminPriority();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const tableRef = useRef(null);
  const [searchParams] = useSearchParams();
  const tab =
    searchParams.get("tab") === "pembatalan" ? "pembatalan" : "pembuatan";

  const priorityIds = useMemo(
    () => new Set(priority.map((s) => s.id)),
    [priority],
  );
  const pendingCount = items.filter((s) =>
    same(s.status, "Menunggu Verifikasi"),
  ).length;

  // Prioritas di atas (paling lama dulu), sisanya mengikuti urutan backend
  const sorted = useMemo(
    () => [...priority, ...items.filter((s) => !priorityIds.has(s.id))],
    [items, priority, priorityIds],
  );

  const keyword = search.trim().toLowerCase();
  const filtered = sorted.filter(
    (s) =>
      (!status || same(s.status, status)) &&
      (s.name.toLowerCase().includes(keyword) ||
        s.organizer.toLowerCase().includes(keyword)),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const scrollToTable = () => {
    setSearch("");
    setStatus("");
    setPage(1);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Semua hook sudah dipanggil di atas, jadi aman return lebih awal di sini
  if (tab === "pembatalan") {
    return (
      <>
        <h1 className="admin-title">Pengajuan Turnamen</h1>
        <SubmissionKindTabs active="pembatalan" />
        <AdminCancellationList />
      </>
    );
  }

  return (
    <>
      <h1 className="admin-title">Pengajuan Turnamen</h1>
      <SubmissionKindTabs active="pembuatan" />

      {priority.length > 0 ? (
        <div className="sub-banner priority">
          <span className="sub-banner-icon">
            <Icon name="clock" size={20} />
          </span>
          <div className="sub-banner-text">
            <strong>
              {priority.length} pengajuan belum diverifikasi lebih dari{" "}
              {priorityLimitText()}
              <span className="sub-pri-tag">HIGH PRIORITY</span>
            </strong>
            <p>
              Halaman admin lain terkunci sampai semua pengajuan terlambat
              selesai diverifikasi.
            </p>
          </div>
          <div className="sub-banner-actions">
            <span className="sub-remaining">
              <i></i> Sisa {priority.length}
            </span>
            <button type="button" className="sub-go" onClick={scrollToTable}>
              Tinjau Sekarang <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </div>
      ) : (
        pendingCount > 0 && (
          <div className="sub-banner">
            <span className="sub-banner-icon">
              <Icon name="hourglass" size={20} />
            </span>
            <div className="sub-banner-text">
              <strong>{pendingCount} pengajuan menunggu verifikasi</strong>
              <p>
                Segera lakukan verifikasi untuk menghindari keterlambatan kepada
                penyelenggara.
              </p>
            </div>
          </div>
        )
      )}

      <section className="admin-panel" ref={tableRef}>
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
            <option value="">Semua Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="admin-message error">{error}</p>}

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
              {visible.map((s, index) => {
                const late = priorityIds.has(s.id);
                const locked = same(s.status, "Sedang diedit");
                return (
                  <tr key={s.id} className={late ? "priority" : ""}>
                    <td>{startIndex + index + 1}</td>
                    <td>
                      <span className="sub-name">{s.name}</span>
                      {late && (
                        <span className="sub-warn" title="Prioritas verifikasi">
                          <Icon name="alert" size={14} />
                        </span>
                      )}
                      {!late && s.tag && (
                        <span className="sub-tag">{s.tag}</span>
                      )}
                    </td>
                    <td>{s.organizer}</td>
                    <td>
                      <span className="sub-date">
                        {formatDate(s.createdAt)}
                      </span>
                      {late && (
                        <small className="sub-wait late">
                          {waitingText(waitingSince(s), now)}
                        </small>
                      )}
                    </td>
                    <td>
                      <SubmissionStatusBadge status={s.status} />
                    </td>
                    <td>
                      {locked ? (
                        <span
                          className="s-detail-btn locked"
                          title="Sedang diedit player, belum bisa ditinjau"
                        >
                          <Icon name="lock" size={13} /> Detail
                        </span>
                      ) : (
                        <Link
                          to={`/admin/pengajuan/${s.id}`}
                          className="s-detail-btn"
                        >
                          Detail <Icon name="chevron-right" size={14} />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              {loading && (
                <tr>
                  <td colSpan={6} className="admin-empty">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && !error && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="admin-empty">
                    {items.length === 0
                      ? "Belum ada pengajuan."
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

export default AdminSubmissions;
