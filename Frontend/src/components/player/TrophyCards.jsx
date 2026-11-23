import Icon from "../icon";
import "../../styles/player-profile.css";

const ITEMS = [
  { key: "gold", label: "Juara 1" },
  { key: "silver", label: "Juara 2" },
  { key: "bronze", label: "Juara 3" },
];

// 3 kartu piala individu (PB-23). trophies: { gold, silver, bronze }.
// Kartu tetap tampil walau 0 (redup).
function TrophyCards({ trophies }) {
  return (
    <div className="pp-trophies">
      {ITEMS.map(({ key, label }) => {
        const n = Number(trophies?.[key] ?? 0);
        return (
          <div key={key} className={`pp-trophy ${key} ${n > 0 ? "on" : ""}`}>
            <span className="pp-trophy-ic">
              <Icon name="trophy" size={18} />
            </span>
            <div>
              <b>{n}</b>
              <small>{label}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default TrophyCards;
