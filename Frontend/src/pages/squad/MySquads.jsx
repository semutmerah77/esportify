import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/icon";
import Pagination from "../../components/admin/Pagination";
import SquadRow from "../../components/squad/SquadRow";
import CreateSquadModal from "../../components/squad/CreateSquadModal";
import InviteInboxModal from "../../components/squad/InviteInboxModal";
import {
  MY_PAGE_SIZE,
  getInvitations,
  getMySquads,
} from "../../services/squadApi";
import "../../styles/squad.css";

function MySquads() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [invites, setInvites] = useState([]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let off = false;
    getMySquads()
      .then((data) => !off && (setItems(data), setReady(true)))
      .catch(
        (err) =>
          !off &&
          (setError(err.message || "Gagal memuat squad."), setReady(true)),
      );
    return () => {
      off = true;
    };
  }, []);

  useEffect(() => {
    let off = false;
    getInvitations()
      .then((data) => !off && setInvites(data))
      .catch(() => {}); // inbox gagal dimuat: tombol tetap tampil tanpa angka
    return () => {
      off = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q),
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / MY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * MY_PAGE_SIZE;
  const visible = filtered.slice(start, start + MY_PAGE_SIZE);

  const handleCreated = (squad) => {
    setItems((prev) => [squad, ...prev]);
    setSearch("");
    setPage(1);
    setCreating(false);
    setToast(`Squad "${squad.name}" berhasil dibuat. Kamu menjadi Leader.`);
  };

  const handleAccepted = (squad) => {
    setItems((prev) => [squad, ...prev]);
    setToast(`Kamu bergabung ke squad "${squad.name}".`);
  };

  return (
    <div className="sq-page">
      <h1 className="admin-title">Squad Saya</h1>

      <div className="sq-searchbar">
        <div className="sq-search">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Cari squad Anda"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="sq-toolbar-actions">
          <button
            type="button"
            className="sq-btn outline inbox"
            onClick={() => setInboxOpen(true)}
          >
            <Icon name="mail" size={16} /> Inbox Undangan
            {invites.length > 0 && (
              <span className="sq-count">{invites.length}</span>
            )}
          </button>
          <button
            type="button"
            className="sq-btn outline"
            onClick={() => setCreating(true)}
          >
            <Icon name="plus" size={16} /> Buat Squad Kamu
          </button>
        </div>
      </div>

      <h2 className="sq-section">Daftar Squad Saya</h2>

      {error && <p className="admin-message error">{error}</p>}

      <div className="sq-list">
        {visible.map((s) => (
          <SquadRow key={s.id} squad={s} />
        ))}
      </div>

      {ready && !error && filtered.length === 0 && (
        <p className="admin-message">
          {items.length === 0
            ? "Kamu belum bergabung ke squad mana pun."
            : "Squad tidak ditemukan."}
        </p>
      )}

      {filtered.length > MY_PAGE_SIZE && (
        <Pagination
          page={safePage}
          totalItems={filtered.length}
          pageSize={MY_PAGE_SIZE}
          onChange={setPage}
        />
      )}

      {inboxOpen && (
        <InviteInboxModal
          invites={invites}
          onChange={setInvites}
          onAccepted={handleAccepted}
          onClose={() => setInboxOpen(false)}
        />
      )}
      {creating && (
        <CreateSquadModal
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}
      {toast && (
        <div className="sq-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

export default MySquads;
