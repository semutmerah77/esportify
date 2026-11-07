import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../icon";
import SquadLogo from "./SquadLogo";

// Kartu hasil pencarian. Deskripsi dipotong 2 baris, "Lainnya..." membukanya.
function SquadCard({ squad }) {
  const [open, setOpen] = useState(false);
  const long = squad.description.length > 70;

  return (
    <article className="sq-card">
      <header className="sq-card-head">
        <SquadLogo squad={squad} />
        <div className="sq-card-id">
          <h3>{squad.name}</h3>
          <span>#{squad.id}</span>
        </div>
      </header>

      <p className={`sq-card-desc ${open ? "open" : ""}`}>
        {squad.description}
      </p>
      {long && (
        <button
          type="button"
          className="sq-more"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Sembunyikan" : "Lainnya..."}
        </button>
      )}

      <div className="sq-card-count">
        <span>Anggota:</span>
        <b className={squad.full ? "full" : ""}>
          {squad.members} / {squad.capacity}{" "}
          {squad.full ? "(Penuh)" : "Anggota"}
        </b>
      </div>

      <Link
        to={`/squad/${squad.squadId ?? squad.id}`}
        className="sq-detail-btn"
      >
        Lihat Detail <Icon name="chevron-right" size={14} />
      </Link>
    </article>
  );
}

export default SquadCard;
