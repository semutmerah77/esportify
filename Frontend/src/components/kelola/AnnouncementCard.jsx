import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { announcementTime } from "../../services/announcementApi";
import AnnouncementIcon from "./AnnouncementIcon";
import "../../styles/announcement.css";

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

// Isi pengumuman: link http(s) otomatis bisa diklik; baris baru dipertahankan (CSS pre-wrap)
function renderBody(text) {
  return text.split(URL_PATTERN).map((part, i) => {
    if (i % 2 === 0) return part;
    // buang tanda baca di ujung link, mis. "https://x.com)," -> link "https://x.com" + ")," teks biasa
    const [, url, tail] = part.match(/^(.*?)([.,;:!?)\]]*)$/);
    return (
      <Fragment key={i}>
        <a href={url} target="_blank" rel="noopener noreferrer nofollow">
          {url}
        </a>
        {tail}
      </Fragment>
    );
  });
}

// Menu titik tiga (khusus penyelenggara): Edit (kalau masih dalam batas 30 menit) dan Hapus
function CardMenu({ canEdit, editDeadline, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) =>
      box.current && !box.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="an-menu-wrap" ref={box}>
      <button
        type="button"
        className="an-more"
        aria-label="Menu pengumuman"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <AnnouncementIcon name="more" size={18} />
      </button>
      {open && (
        <div className="an-menu" role="menu">
          {canEdit && (
            <>
              <button
                type="button"
                role="menuitem"
                className="an-menu-item"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
              >
                <AnnouncementIcon name="pencil" size={15} /> Edit
              </button>
              {editDeadline && (
                <small className="an-menu-hint">
                  Dapat diedit hingga {editDeadline}
                </small>
              )}
              <i className="an-menu-line" />
            </>
          )}
          <button
            type="button"
            role="menuitem"
            className="an-menu-item danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <AnnouncementIcon name="trash" size={15} /> Hapus
          </button>
        </div>
      )}
    </div>
  );
}

// Satu kartu pengumuman.
// item: pengumuman terpetakan | organizerName: nama penyelenggara (cadangan kalau BE tidak mengirim penulis)
// menu: { canEdit, editDeadline, onEdit, onDelete } -> hanya diisi di tampilan penyelenggara
function AnnouncementCard({ item, organizerName = "", menu }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const bodyRef = useRef(null);
  const name = item.authorName || organizerName;

  // Teks panjang dipotong 4 baris; tombol "Selengkapnya" hanya muncul kalau memang terpotong
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) return undefined;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [expanded, item.body]);

  const stamp = item.edited
    ? `Diedit · ${announcementTime(item.updatedAt || item.createdAt)}`
    : announcementTime(item.createdAt);

  return (
    <article className="an-card">
      <header className="an-card-head">
        <span className="an-avatar" aria-hidden="true">
          {(name || "P").trim().charAt(0).toUpperCase()}
        </span>
        {name && <b className="an-author">{name}</b>}
        <span className="an-role">Penyelenggara</span>
        {menu && (
          <CardMenu
            canEdit={menu.canEdit}
            editDeadline={menu.editDeadline}
            onEdit={menu.onEdit}
            onDelete={menu.onDelete}
          />
        )}
      </header>
      <h3 className="an-title">{item.title}</h3>
      <p ref={bodyRef} className={`an-body ${expanded ? "" : "clamped"}`}>
        {renderBody(item.body)}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          className="an-more-text"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Lebih sedikit" : "Selengkapnya"}
          <AnnouncementIcon
            name={expanded ? "chevronUp" : "chevronDown"}
            size={13}
          />
        </button>
      )}
      <time className="an-time">{stamp}</time>
    </article>
  );
}

export default AnnouncementCard;
