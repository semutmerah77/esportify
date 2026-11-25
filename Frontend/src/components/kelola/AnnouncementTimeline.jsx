import {
  announcementDayKey,
  announcementDayLabel,
} from "../../services/announcementApi";
import AnnouncementCard from "./AnnouncementCard";
import "../../styles/announcement.css";

// true  = terbaru di atas (sesuai kontrak BE: "Urutan daftar: terbaru di atas")
// false = terlama di atas, seperti urutan pada gambar desain
const NEWEST_FIRST = true;

// Daftar pengumuman dikelompokkan per tanggal (WIB) dengan pil tanggal di tengah ("Hari ini", "11 Nov 2026").
// renderMenu(item): menu titik tiga per kartu (khusus penyelenggara); kosong = tanpa menu
// highlightId: pengumuman yang disorot (dari tautan notifikasi)
function AnnouncementTimeline({
  items,
  organizerName,
  renderMenu,
  highlightId = 0,
}) {
  const ordered = NEWEST_FIRST ? items : [...items].reverse();
  const groups = [];
  ordered.forEach((item) => {
    const key = announcementDayKey(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else
      groups.push({
        key,
        label: announcementDayLabel(item.createdAt),
        items: [item],
      });
  });

  return (
    <div className="an-timeline">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="an-day">
            <span>{group.label}</span>
          </div>
          {group.items.map((item) => (
            <div
              key={item.id}
              id={`an-${item.id}`}
              className={item.id === highlightId ? "an-anchor hl" : "an-anchor"}
            >
              <AnnouncementCard
                item={item}
                organizerName={organizerName}
                menu={renderMenu ? renderMenu(item) : undefined}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export default AnnouncementTimeline;
