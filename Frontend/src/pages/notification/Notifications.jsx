import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Icon from "../../components/icon";
import NotificationCard from "../../components/notification/NotificationCard";
import {
  getNotifications,
  isAbort,
  markAllNotificationsRead,
  openNotification,
} from "../../services/notificationApi";
import "../../styles/notification.css";

const GROUPS = [
  ["hari_ini", "Hari ini"],
  ["7_hari_terakhir", "7 hari terakhir"],
  ["30_hari_terakhir", "30 hari terakhir"],
];
const GROUP_KEYS = GROUPS.map(([key]) => key);

// Gabung halaman baru tanpa duplikat (berdasarkan id)
const mergeById = (prev, incoming) => {
  const seen = new Set(prev.map((n) => n.id));
  return [...prev, ...incoming.filter((n) => !seen.has(n.id))];
};

// Hanya tautan internal yang boleh dipakai untuk navigasi
const safeLink = (l) =>
  typeof l === "string" && l.startsWith("/") && !l.startsWith("//") ? l : "";

function Skeleton() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div className="nt-card nt-skel-card" key={i}>
          <i className="nt-skel w30" />
          <i className="nt-skel w20" />
          <i className="nt-skel w60" />
        </div>
      ))}
    </div>
  );
}

function Notifications() {
  const navigate = useNavigate();
  const { notif } = useOutletContext();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all"); // all | unread
  const [loadingMore, setLoadingMore] = useState(false);
  const [marking, setMarking] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");
  const [info, setInfo] = useState(null); // { message, link } popup keterangan dari /buka

  // Daftar dimuat hanya saat halaman ini dibuka (halaman 1)
  useEffect(() => {
    let off = false;
    const ctrl = new AbortController();
    getNotifications(1, { signal: ctrl.signal })
      .then((r) => {
        if (off) return;
        setItems(r.items);
        setPage(r.page);
        setHasMore(r.hasMore);
        setStatus("ok");
      })
      .catch((e) => {
        if (off || isAbort(e)) return;
        setError(e.message || "Notifikasi tidak dapat dimuat.");
        setStatus("error");
      });
    return () => {
      off = true;
      ctrl.abort();
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const r = await getNotifications(page + 1);
      setItems((prev) => mergeById(prev, r.items));
      setPage(r.page);
      setHasMore(r.hasMore);
    } catch (e) {
      setNotice(e.message || "Gagal memuat notifikasi.");
    } finally {
      setLoadingMore(false);
    }
  };

  // Buka notifikasi: tandai dibaca di state lokal lalu pindah ke tautan (tanpa memuat ulang daftar).
  // Notifikasi yang sudah dibaca langsung pindah, kecuali pengumuman (perlu cek keterangan "sudah dihapus").
  const open = async (n) => {
    if (busyId) return;
    if (n.read && n.kind !== "pengumuman_baru") {
      const to = safeLink(n.link);
      if (to) navigate(to);
      return;
    }
    setBusyId(n.id);
    try {
      const r = await openNotification(n.id);
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id
            ? { ...x, read: true, response: r.item?.response ?? x.response }
            : x,
        ),
      );
      if (!n.read) notif.refresh(); // titik biru: cek ulang sekali
      const target = safeLink(r.link || n.link);
      if (r.note) setInfo({ message: r.note, link: target });
      else if (target) navigate(target);
    } catch (e) {
      if (e.status === 404) {
        setItems((prev) => prev.filter((x) => x.id !== n.id));
        setNotice("Notifikasi tidak ditemukan.");
      } else {
        setNotice(e.message || "Notifikasi tidak dapat dibuka.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const closeInfo = () => {
    const to = info?.link;
    setInfo(null);
    if (to) navigate(to);
  };

  const markAll = async () => {
    if (marking) return;
    setMarking(true);
    try {
      const r = await markAllNotificationsRead();
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
      notif.setUnread(r.hasUnread); // matikan titik biru dari respons, tanpa memanggil /penanda
    } catch (e) {
      setNotice(e.message || "Gagal menandai semua dibaca.");
    } finally {
      setMarking(false);
    }
  };

  const hasUnread = items.some((n) => !n.read) || notif.unread;
  const shown = tab === "unread" ? items.filter((n) => !n.read) : items;

  const grouped = GROUPS.map(([key, label]) => ({
    key,
    label,
    list: shown.filter(
      (n) =>
        (GROUP_KEYS.includes(n.group) ? n.group : "30_hari_terakhir") === key,
    ),
  })).filter((g) => g.list.length > 0);

  return (
    <div className="nt-page">
      <button type="button" className="nt-back" onClick={() => navigate(-1)}>
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Kembali
      </button>

      <h1 className="nt-title-page">Notifikasi</h1>

      <div className="nt-toolbar">
        <div className="nt-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "all"}
            className={`nt-tab ${tab === "all" ? "active" : ""}`}
            onClick={() => setTab("all")}
          >
            Semua
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "unread"}
            className={`nt-tab ${tab === "unread" ? "active" : ""}`}
            onClick={() => setTab("unread")}
          >
            Belum dibaca
          </button>
        </div>

        <button
          type="button"
          className="nt-markall"
          onClick={markAll}
          disabled={!hasUnread || marking}
        >
          <Icon name="check" size={14} /> Tandai semua dibaca
        </button>
      </div>

      {notice && <p className="admin-message error">{notice}</p>}

      <section className="nt-panel">
        {status === "loading" && <Skeleton />}

        {status === "error" && <p className="nt-empty error">{error}</p>}

        {status === "ok" && grouped.length === 0 && (
          <p className="nt-empty">
            {tab === "unread"
              ? "Tidak ada notifikasi yang belum dibaca."
              : "Belum ada notifikasi."}
          </p>
        )}

        {status === "ok" &&
          grouped.map((g) => (
            <div className="nt-group" key={g.key}>
              <h2>{g.label}</h2>
              {g.list.map((n) => (
                <NotificationCard
                  key={n.id}
                  item={n}
                  busy={busyId === n.id}
                  onOpen={open}
                />
              ))}
            </div>
          ))}

        {status === "ok" && hasMore && (
          <div className="nt-more">
            <button
              type="button"
              className="nt-tab"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Memuat..." : "Muat lainnya"}
            </button>
          </div>
        )}
      </section>

      {info && (
        <div className="nt-overlay" role="dialog" aria-modal="true">
          <div className="nt-dialog">
            <p>{info.message}</p>
            <button type="button" className="nt-dialog-btn" onClick={closeInfo}>
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Notifications;
