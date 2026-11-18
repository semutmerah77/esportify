import { useCallback, useEffect, useState } from "react";
import {
  announcementTime,
  cancelAnnouncementEdit,
  createAnnouncement,
  deleteAnnouncement,
  getOrganizerAnnouncements,
  saveAnnouncement,
  startAnnouncementEdit,
} from "../../services/announcementApi";
import ActionDonePopup from "./ActionDonePopup";
import AnnouncementFormDialog from "./AnnouncementFormDialog";
import AnnouncementIcon from "./AnnouncementIcon";
import AnnouncementTimeline from "./AnnouncementTimeline";
import DeleteAnnouncementDialog from "./DeleteAnnouncementDialog";
import "../../styles/announcement.css";

function Skeleton() {
  return (
    <div aria-hidden="true">
      {[0, 1].map((i) => (
        <div className="an-skel" key={i}>
          <i className="w30" />
          <i className="w50" />
          <i className="w90" />
        </div>
      ))}
    </div>
  );
}

// Tab Pengumuman di Kelola Turnamen (penyelenggara). id = id turnamen.
// Edit 3 langkah: mulai-edit (dapat token) -> simpan (PUT + token) atau batal (batal-edit + token).
function AnnouncementPanel({ id, organizerName = "" }) {
  const [state, setState] = useState({
    items: null,
    canCreate: false,
    reason: "",
    error: "",
  });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null); // { item, token }
  const [deleting, setDeleting] = useState(null); // item
  const [popup, setPopup] = useState(null); // { title, text }
  const [notice, setNotice] = useState("");
  const [tick, bump] = useState(0);

  const load = useCallback(
    () =>
      getOrganizerAnnouncements(id)
        .then((d) =>
          setState({
            items: d.items,
            canCreate: d.canCreate,
            reason: d.cannotCreateReason,
            error: "",
          }),
        )
        .catch((err) =>
          setState((s) => ({
            ...s,
            error: err.message || "Pengumuman tidak dapat dimuat.",
          })),
        ),
    [id],
  );

  useEffect(() => {
    let off = false;
    setState({ items: null, canCreate: false, reason: "", error: "" });
    getOrganizerAnnouncements(id)
      .then(
        (d) =>
          !off &&
          setState({
            items: d.items,
            canCreate: d.canCreate,
            reason: d.cannotCreateReason,
            error: "",
          }),
      )
      .catch(
        (err) =>
          !off &&
          setState((s) => ({
            ...s,
            error: err.message || "Pengumuman tidak dapat dimuat.",
          })),
      );
    return () => {
      off = true;
    };
  }, [id]);

  // Tombol Edit hilang tepat saat batas 30 menit habis: satu timer ke batas terdekat (tanpa polling)
  const items = state.items;
  useEffect(() => {
    if (!items) return undefined;
    const now = Date.now();
    const upcoming = items
      .filter((i) => i.canEdit && i.editUntil > now)
      .map((i) => i.editUntil);
    if (!upcoming.length) return undefined;
    const timer = setTimeout(
      () => bump((n) => n + 1),
      Math.min(...upcoming) - now + 50,
    );
    return () => clearTimeout(timer);
  }, [items, tick]);

  const replaceItem = (updated) =>
    setState((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === updated.id ? updated : i)),
    }));
  const removeItem = (itemId) =>
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== itemId) }));

  // --- buat ---
  const submitCreate = async (values) => {
    const res = await createAnnouncement(id, values);
    setState((s) => ({ ...s, items: [res.announcement, ...(s.items ?? [])] }));
    setCreating(false);
    setPopup({ title: "Pengumuman terkirim", text: res.message });
  };

  // --- edit langkah (a): mulai sesi edit ---
  const startEdit = async (item) => {
    setNotice("");
    try {
      const res = await startAnnouncementEdit(id, item.id);
      replaceItem(res.announcement);
      setEditing({ item: res.announcement, token: res.token });
    } catch (err) {
      setNotice(err.message || "Sesi edit tidak dapat dimulai.");
      // batas waktu habis: sembunyikan tombol Edit
      if (/batas waktu edit/i.test(err.message || ""))
        replaceItem({ ...item, canEdit: false, editUntil: 0 });
    }
  };

  // --- edit langkah (b): simpan ---
  const submitEdit = async (values) => {
    const res = await saveAnnouncement(id, editing.item.id, {
      ...values,
      token: editing.token,
    });
    replaceItem(res.announcement);
    setEditing(null);
    setPopup({ title: "Pengumuman diperbarui", text: res.message });
  };

  // --- edit langkah (c): batal / tutup form ---
  const cancelEdit = useCallback(() => {
    const current = editing;
    setEditing(null);
    if (!current) return;
    cancelAnnouncementEdit(id, current.item.id, current.token)
      .then(replaceItem)
      .catch(() => load()); // token sudah tidak berlaku / sesi habis: ambil data terbaru
  }, [editing, id, load]);

  // --- hapus ---
  const confirmDelete = async () => {
    try {
      const res = await deleteAnnouncement(id, deleting.id);
      removeItem(deleting.id);
      setDeleting(null);
      setPopup({ title: "Pengumuman dihapus", text: res.message });
    } catch (err) {
      // 404: sudah terhapus (mis. dari tab lain) -> anggap selesai
      if (/tidak ditemukan/i.test(err.message || "")) {
        removeItem(deleting.id);
        setDeleting(null);
        return;
      }
      throw err;
    }
  };

  if (state.error && !state.items)
    return <p className="admin-message error">{state.error}</p>;
  if (!state.items) return <Skeleton />;

  return (
    <div className="an-panel">
      <div className="an-top">
        <span>Hanya terlihat oleh peserta yang diterima</span>
        {state.canCreate && (
          <button
            type="button"
            className="an-btn-new"
            onClick={() => setCreating(true)}
          >
            <AnnouncementIcon name="plus" size={15} /> Buat Pengumuman
          </button>
        )}
      </div>

      {!state.canCreate && state.reason && (
        <div className="an-notice warn">
          <AnnouncementIcon name="warn" size={15} />
          <span>{state.reason}</span>
        </div>
      )}
      {notice && (
        <div className="an-notice bad" role="alert">
          <AnnouncementIcon name="warn" size={15} />
          <span>{notice}</span>
        </div>
      )}

      {state.items.length === 0 ? (
        <div className="an-empty">
          <AnnouncementIcon name="megaphone" size={26} />
          <b>Belum ada pengumuman</b>
          <p>
            Pengumuman yang kamu kirim akan muncul di sini dan dilihat oleh
            peserta yang diterima.
          </p>
        </div>
      ) : (
        <AnnouncementTimeline
          items={state.items}
          organizerName={organizerName}
          renderMenu={(item) => ({
            canEdit: item.canEdit && item.editUntil > Date.now(),
            editDeadline: item.editDeadline
              ? announcementTime(item.editDeadline)
              : "",
            onEdit: () => startEdit(item),
            onDelete: () => setDeleting(item),
          })}
        />
      )}

      {creating && (
        <AnnouncementFormDialog
          mode="create"
          onSubmit={submitCreate}
          onCancel={() => setCreating(false)}
        />
      )}
      {editing && (
        <AnnouncementFormDialog
          key={editing.item.id}
          mode="edit"
          initial={{ title: editing.item.title, body: editing.item.body }}
          onSubmit={submitEdit}
          onCancel={cancelEdit}
        />
      )}
      {deleting && (
        <DeleteAnnouncementDialog
          title={deleting.title}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
      {popup && (
        <ActionDonePopup
          title={popup.title}
          text={popup.text}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}

export default AnnouncementPanel;
