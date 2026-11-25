import { useEffect, useRef, useState } from "react";
import { getPlayerAnnouncements } from "../../services/announcementApi";
import AnnouncementIcon from "./AnnouncementIcon";
import AnnouncementTimeline from "./AnnouncementTimeline";
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

// Tab Pengumuman untuk peserta (Ruang Turnamen). id = id turnamen.
// 403 dari BE (bukan anggota squad yang diterima) ditampilkan apa adanya.
function PlayerAnnouncementPanel({ id, organizerName = "", highlightId = 0 }) {
  const [state, setState] = useState({ items: null, error: "" });

  useEffect(() => {
    let off = false;
    setState({ items: null, error: "" });
    getPlayerAnnouncements(id)
      .then((items) => !off && setState({ items, error: "" }))
      .catch(
        (err) =>
          !off &&
          setState({
            items: null,
            error: err.message || "Pengumuman tidak dapat dimuat.",
          }),
      );
    return () => {
      off = true;
    };
  }, [id]);

  // Dari notifikasi (?pengumuman=id): gulir ke pengumuman itu, sekali saja
  const scrolled = useRef(false);
  useEffect(() => {
    if (!highlightId || !state.items || scrolled.current) return;
    scrolled.current = true;
    document
      .getElementById(`an-${highlightId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId, state.items]);

  if (state.error) return <p className="admin-message error">{state.error}</p>;
  if (!state.items) return <Skeleton />;

  return (
    <div className="an-panel">
      <div className="an-top player">
        <span className="an-top-title">
          <AnnouncementIcon name="megaphone" size={16} /> Pengumuman dari
          penyelenggara turnamen
        </span>
        <span className="an-top-lock">
          <AnnouncementIcon name="lock" size={13} /> Hanya penyelenggara yang
          dapat mengirim pengumuman
        </span>
      </div>

      {state.items.length === 0 ? (
        <div className="an-empty">
          <AnnouncementIcon name="megaphone" size={26} />
          <b>Belum ada pengumuman</b>
          <p>Pengumuman dari penyelenggara akan muncul di sini.</p>
        </div>
      ) : (
        <AnnouncementTimeline
          items={state.items}
          organizerName={organizerName}
          highlightId={highlightId}
        />
      )}
    </div>
  );
}

export default PlayerAnnouncementPanel;
