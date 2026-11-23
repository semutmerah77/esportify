import { useEffect, useRef, useState } from "react";
import Icon from "../icon";
import { formatRupiah } from "../../services/tournamentSearchApi";
import "../../styles/search-featured.css";

// Ukuran kartu dan jarak antar kartu (px). Dipakai untuk menghitung posisi
// kartu tengah, jadi jangan diubah lewat CSS.
const CARD_W = 200;
const GAP = 16;
const STEP = CARD_W + GAP;

const AUTO_MS = 4000; // jeda geser otomatis
const DRAG_THRESHOLD = 6; // geseran di bawah ini dianggap klik
const SWIPE_MIN = 40; // geseran minimal supaya pindah satu kartu

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function FeaturedCard({ item, state, onOpen, onFocus }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <button
      type="button"
      className={`ct-feat-card ${state}`}
      style={{ width: CARD_W }}
      onClick={() => onOpen?.(item)}
      onFocus={onFocus}
    >
      {item.poster && !imgFailed ? (
        <img
          className="ct-feat-img"
          src={item.poster}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="ct-feat-fb">
          <Icon name="trophy" size={44} />
        </span>
      )}
      <span className="ct-feat-shade" aria-hidden="true" />

      {item.game && <span className="ct-tag ct-tag-game">{item.game}</span>}
      {item.type && (
        <span
          className={`ct-tag ct-tag-type ${item.type === "Online" ? "online" : ""}`}
        >
          {item.type}
        </span>
      )}

      <span className="ct-feat-info">
        <span className="ct-feat-name">{item.name}</span>
        {item.prize != null && (
          <span className="ct-feat-prize">
            Total Hadiah <b>{formatRupiah(item.prize)}</b>
          </span>
        )}
      </span>
    </button>
  );
}

// items: daftar turnamen (bentuk hasil mapTournament). onOpen(item): buka detail.
function FeaturedCarousel({ items = [], onOpen }) {
  const count = items.length;
  const viewportRef = useRef(null);
  const drag = useRef({ id: null, startX: 0, moved: false });

  const [vw, setVw] = useState(0); // lebar area geser
  const [index, setIndex] = useState(0); // kartu yang sedang di tengah
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const [kbFocus, setKbFocus] = useState(false);

  // Ukur lebar area geser, dan ikuti kalau ukuran layar berubah
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const update = () => setVw(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);

  // Daftar berubah: jaga supaya index tidak melewati batas
  useEffect(() => {
    setIndex((i) => clamp(i, 0, Math.max(0, count - 1)));
  }, [count]);

  // Geser otomatis. Berhenti saat kursor di atas carousel, saat fokus
  // keyboard, saat sedang digeser, dan kalau pengguna memilih mengurangi gerakan.
  const paused = hover || kbFocus || dragging;
  useEffect(() => {
    if (count < 2 || paused) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), AUTO_MS);
    return () => clearTimeout(t); // index ikut deps: timer diulang tiap pindah
  }, [count, paused, index]);

  if (count === 0) return null;

  /* ---------- Geser dengan mouse / jari ---------- */

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { id: e.pointerId, startX: e.clientX, moved: false };
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      d.moved = true;
      setDragging(true);
      // Pointer baru "ditangkap" setelah benar-benar menggeser, supaya
      // klik biasa pada kartu tetap sampai ke tombolnya.
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDragX(dx);
  };

  const endDrag = (e) => {
    const d = drag.current;
    if (d.id !== e.pointerId) return;
    d.id = null;
    if (!d.moved) return;

    const dx = e.clientX - d.startX;
    let shift = Math.round(-dx / STEP);
    if (shift === 0 && Math.abs(dx) > SWIPE_MIN) shift = dx < 0 ? 1 : -1;
    setIndex((i) => clamp(i + shift, 0, count - 1));
    setDragX(0);
    setDragging(false);
  };

  // Setelah menggeser, klik yang ikut terkirim tidak boleh membuka detail
  const swallowClickAfterDrag = (e) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  // Fokus keyboard (Tab) memusatkan kartu yang difokus
  const onCardFocus = (i) => (e) => {
    if (e.target.matches(":focus-visible")) setKbFocus(true);
    setIndex(i);
  };

  const x = vw / 2 - CARD_W / 2 - index * STEP + dragX;

  return (
    <section
      className="ct-feat"
      aria-roledescription="carousel"
      aria-label="Turnamen unggulan"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onBlur={() => setKbFocus(false)}
    >
      {/* Latar: poster kartu tengah, diburamkan jadi cahaya berwarna */}
      <div className="ct-feat-glow" aria-hidden="true">
        {items.map((item, i) =>
          item.poster ? (
            <img
              key={item.id}
              className={`ct-feat-glow-img ${i === index ? "on" : ""}`}
              src={item.poster}
              alt=""
              draggable={false}
            />
          ) : null,
        )}
      </div>

      <div
        ref={viewportRef}
        className="ct-feat-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={swallowClickAfterDrag}
      >
        <div
          className="ct-feat-track"
          style={{
            gap: GAP,
            visibility: vw ? "visible" : "hidden",
            transform: `translate3d(${x}px, 0, 0)`,
            transition: dragging
              ? "none"
              : "transform 0.45s cubic-bezier(0.22, 0.8, 0.3, 1)",
          }}
        >
          {items.map((item, i) => {
            const dist = Math.abs(i - index);
            const state =
              dist === 0 ? "is-active" : dist === 1 ? "is-near" : "is-far";
            return (
              <FeaturedCard
                key={item.id}
                item={item}
                state={state}
                onOpen={onOpen}
                onFocus={onCardFocus(i)}
              />
            );
          })}
        </div>
      </div>

      {count > 1 && (
        <div className="ct-feat-dots">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`ct-feat-dot ${i === index ? "on" : ""}`}
              aria-label={`Turnamen ${i + 1} dari ${count}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default FeaturedCarousel;
