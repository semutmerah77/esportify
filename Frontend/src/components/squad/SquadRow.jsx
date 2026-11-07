import { Link } from "react-router-dom";
import SquadLogo from "./SquadLogo";

// Baris daftar "Squad Saya".
function SquadRow({ squad }) {
  return (
    <Link to={`/squad/${squad.squadId ?? squad.id}`} className="sq-row">
      <SquadLogo squad={squad} />
      <div className="sq-row-main">
        <h3>{squad.name}</h3>
        <span>
          {squad.members}/{squad.capacity} Anggota
        </span>
      </div>
      <code className="sq-row-code">{squad.id}</code>
    </Link>
  );
}

export default SquadRow;
