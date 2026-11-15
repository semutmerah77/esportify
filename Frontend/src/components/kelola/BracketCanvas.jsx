import { useMemo, useRef, useState } from "react";
import BracketIcon from "./BracketIcon";

// Ukuran kartu & kolom (px)
const COL_W = 250;
const OFF = 30; // jarak kartu dari tepi kiri kolom (tempat label #nomor)
const CARD_W = 190;
const ROW_H = 30;
const CARD_H = ROW_H * 2;
const PITCH = 80;
const PAD_Y = 18;
const HEAD_H = 64;

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.5;

// Jam babak: WIB, format 24 jam (backend kirim UTC ISO)
export function roundTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const t = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
  return `${t.replace(":", ".")} WIB`;
}

// Hitung posisi tiap pertandingan: babak pertama berurutan, babak berikutnya
// berada di tengah antara kartu sumbernya (pemenang / yang kalah).
function buildLayout(rounds) {
  const pos = new Map(); // id -> { col, y }
  const feeders = new Map(); // id target -> [{ from, slot, kind }]
  const label = new Map(); // `${id}:${slot}` -> teks slot TBD

  rounds.forEach((r) =>
    r.matches.forEach((m) => {
      if (m.nextId) {
        feeders.set(m.nextId, [...(feeders.get(m.nextId) ?? []), m]);
        label.set(`${m.nextId}:${m.nextSlot}`, `Pemenang #${m.number}`);
      }
      if (m.loserNextId) {
        feeders.set(m.loserNextId, [...(feeders.get(m.loserNextId) ?? []), m]);
        label.set(`${m.loserNextId}:${m.loserNextSlot}`, `Kalah #${m.number}`);
      }
    }),
  );

  let maxY = 0;
  rounds.forEach((r, col) => {
    let prev = -Infinity;
    r.matches.forEach((m, i) => {
      const src = (feeders.get(m.id) ?? [])
        .map((f) => pos.get(f.id))
        .filter(Boolean);
      let y = src.length
        ? src.reduce((s, p) => s + p.y, 0) / src.length
        : i * PITCH;
      if (y < prev + PITCH) y = prev + PITCH; // cegah kartu bertumpuk
      prev = y;
      pos.set(m.id, { col, y });
      maxY = Math.max(maxY, y);
    });
  });

  return {
    pos,
    label,
    height: maxY + CARD_H + PAD_Y * 2,
    width: rounds.length * COL_W,
  };
}

function SlotRow({ squad, bye, tbd, score, match, side }) {
  const won = squad && match.winnerRegId && match.winnerRegId === squad.regId;
  const lost = squad && match.winnerRegId && match.winnerRegId !== squad.regId;
  return (
    <div
      className={`kl-bk-slot ${tbd ? "tbd" : ""} ${bye ? "bye" : ""} ${won ? "won" : ""} ${lost ? "lost" : ""}`}
    >
      <span className="kl-bk-seed">{squad?.seed ?? ""}</span>
      <span className="kl-bk-name" title={squad?.name}>
        {squad ? squad.name : bye ? "BYE" : tbd}
      </span>
      <span className="kl-bk-score">{score ?? "-"}</span>
    </div>
  );
}

function MatchCard({ match, y, col, label }) {
  const aTbd = !match.a ? (label.get(`${match.id}:A`) ?? "TBD") : "";
  const bTbd =
    !match.b && !match.isBye ? (label.get(`${match.id}:B`) ?? "TBD") : "";
  const empty = !match.a && !match.b;
  return (
    <div
      className={`kl-bk-match ${empty ? "empty" : ""} ${match.mine ? "mine" : ""}`}
      style={{
        left: col * COL_W + OFF,
        top: y + PAD_Y,
        width: CARD_W,
        height: CARD_H,
      }}
    >
      <i className="kl-bk-no">#{match.number}</i>
      <SlotRow squad={match.a} tbd={aTbd} score={match.scoreA} match={match} />
      <SlotRow
        squad={match.b}
        bye={match.isBye}
        tbd={bTbd}
        score={match.scoreB}
        match={match}
      />
    </div>
  );
}

function Connectors({ rounds, layout }) {
  const paths = [];
  rounds.forEach((r) =>
    r.matches.forEach((m) => {
      const from = layout.pos.get(m.id);
      [
        [m.nextId, false],
        [m.loserNextId, true],
      ].forEach(([targetId, loser]) => {
        const to = targetId && layout.pos.get(targetId);
        if (!from || !to || to.col <= from.col) return;
        const sx = from.col * COL_W + OFF + CARD_W;
        const sy = from.y + PAD_Y + ROW_H;
        const tx = to.col * COL_W + OFF;
        const ty = to.y + PAD_Y + ROW_H;
        const mx = tx - OFF;
        paths.push(
          <path
            key={`${m.id}-${targetId}-${loser ? "l" : "w"}`}
            d={`M${sx} ${sy}H${mx}V${ty}H${tx}`}
            className={loser ? "loser" : ""}
          />,
        );
      });
    }),
  );
  return (
    <svg
      className="kl-bk-lines"
      width={layout.width}
      height={layout.height}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

// rounds   : daftar babak dari backend (sudah berurutan)
// editable : tampilkan ikon pensil di header babak
// onEdit   : (round) => void
function BracketCanvas({ rounds, editable, onEdit }) {
  const [zoom, setZoom] = useState(1);
  const wrapRef = useRef(null);
  const layout = useMemo(() => buildLayout(rounds), [rounds]);

  const clamp = (z) =>
    Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
  const fit = () => {
    const w = wrapRef.current?.clientWidth;
    // Sesuaikan hanya mengecilkan agar muat; tidak pernah di atas 100%
    if (w) setZoom(clamp(Math.min(1, (w - 12) / layout.width)));
  };

  return (
    <div className="kl-bk">
      <div className="kl-bk-scroll" ref={wrapRef}>
        <div className="kl-bk-zoom" style={{ zoom, width: layout.width }}>
          <div className="kl-bk-heads" style={{ height: HEAD_H }}>
            {rounds.map((r) => (
              <div className="kl-bk-head" key={r.id} style={{ width: COL_W }}>
                <div>
                  <b>{r.name}</b>
                  <span className={roundTime(r.startTime) ? "" : "unset"}>
                    {roundTime(r.startTime) || "Belum diatur"}
                  </span>
                </div>
                {editable && (
                  <button
                    type="button"
                    className="kl-bk-edit"
                    aria-label={`Edit jadwal ${r.name}`}
                    onClick={() => onEdit(r)}
                  >
                    <BracketIcon name="pencil" size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="kl-bk-body" style={{ height: layout.height }}>
            <Connectors rounds={rounds} layout={layout} />
            {rounds.map((r, col) =>
              r.matches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  col={col}
                  y={layout.pos.get(m.id)?.y ?? 0}
                  label={layout.label}
                />
              )),
            )}
          </div>
        </div>
      </div>

      <div className="kl-bk-zoombar">
        <button
          type="button"
          aria-label="Perkecil"
          onClick={() => setZoom((z) => clamp(z - 0.1))}
        >
          <BracketIcon name="minus" size={14} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          aria-label="Perbesar"
          onClick={() => setZoom((z) => clamp(z + 0.1))}
        >
          <BracketIcon name="plus" size={14} />
        </button>
        <i />
        <button type="button" className="fit" onClick={fit}>
          <BracketIcon name="fit" size={14} /> Sesuaikan
        </button>
      </div>
    </div>
  );
}

export default BracketCanvas;
