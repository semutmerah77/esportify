import { useEffect } from "react";
import Icon from "../icon";
import { CopyChip, KlAvatar } from "./KlParts";

// Modal detail peserta: daftar anggota + akun in-game perwakilan.
// account = detail pendaftaran dari getParticipantAccounts (boleh null).
function ParticipantDetailModal({ item, account, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const members = account?.members ?? [];

  return (
    <div
      className="kl-ov"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="kl-pd"
        role="dialog"
        aria-modal="true"
        aria-label={`Detail ${item.squad.name}`}
      >
        <header className="kl-pd-head">
          <KlAvatar
            name={item.squad.name}
            src={item.squad.logo}
            seed={item.squad.code || item.squad.name}
            size={56}
          />
          <h2>{item.squad.name}</h2>
          <button
            type="button"
            className="kl-dr-x"
            aria-label="Tutup"
            onClick={onClose}
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        {!account ? (
          <p className="kl-pd-empty">Detail peserta tidak dapat dimuat.</p>
        ) : (
          <>
            <h3 className="kl-dr-label">Daftar Anggota ({members.length})</h3>
            <ul className="kl-pd-members">
              {members.map((m) => (
                <li key={m.id ?? m.username}>
                  <KlAvatar name={m.username} src={m.avatar} size={32} />
                  <span>{m.username}</span>
                  {m.id === item.rep.id && <em>Perwakilan</em>}
                </li>
              ))}
            </ul>

            <h3 className="kl-dr-label kl-pd-gap">Akun In-Game Perwakilan</h3>
            <div className="kl-pd-acc">
              <div>
                <small>Nickname in-game</small>
                <b>{account.gameNickname || "-"}</b>
              </div>
              <div>
                <small>ID in-game</small>
                <CopyChip value={account.gameUid} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ParticipantDetailModal;
