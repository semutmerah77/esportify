import "../../styles/bracket-final.css";

const SLOTS = [
  { rank: 2, tone: "silver" },
  { rank: 1, tone: "gold" },
  { rank: 3, tone: "bronze" },
];

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

// "14 Nov 2026, 12.42 WIB"
function settledText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const time = d
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    })
    .replace(":", ".");
  return `${date}, ${time} WIB`;
}

function TrophyIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

// Podium Juara 1-3. champions: [{ rank, squad: { name, logo } }].
// Turnamen kurang dari 4 squad hanya punya Juara 1 dan 2: slot yang kosong dilewati.
export function ChampionsPodium({ champions }) {
  return (
    <div className="fin-podium">
      {SLOTS.map(({ rank, tone }) => {
        const c = champions.find((x) => x.rank === rank);
        if (!c) return null;
        return (
          <div key={rank} className={`fin-place ${tone} r${rank}`}>
            <span className="fin-place-label">
              <TrophyIcon /> Juara {rank}
            </span>
            <span className="fin-avatar">
              {initials(c.squad.name)}
              {c.squad.logo && (
                <img
                  src={c.squad.logo}
                  alt=""
                  loading="lazy"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
            </span>
            <b className="fin-name" title={c.squad.name}>
              {c.squad.name}
            </b>
            <div className="fin-step">
              <span>{rank}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Kartu "JUARA TURNAMEN" di tab Bracket (turnamen selesai).
// decidedAt: waktu penetapan (opsional; tampil bila BE mengirimnya).
export function ChampionsCard({ champions, decidedAt }) {
  const when = decidedAt ? settledText(decidedAt) : "";
  return (
    <section className="fin-card">
      <div className="fin-card-top">
        <h4>Juara Turnamen</h4>
        {when && <span>Ditetapkan {when}</span>}
      </div>
      <ChampionsPodium champions={champions} />
    </section>
  );
}

export default ChampionsPodium;
