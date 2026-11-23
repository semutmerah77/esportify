import "../../styles/squad-performance.css";

// Dropdown "Semua Game". games: [{ id, name }]. value: "all" atau id game (string).
function SquadGameFilter({ games, value, onChange }) {
  return (
    <label className="sp-select">
      <span className="sp-sr">Filter game</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">Semua Game</option>
        {games.map((g) => (
          <option key={g.id} value={String(g.id)}>
            {g.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default SquadGameFilter;
