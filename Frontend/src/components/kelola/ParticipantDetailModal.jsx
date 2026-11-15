import { useEffect } from "react";
import Icon from "../icon";
import { CopyChip, KlAvatar } from "./KlParts";

// Modal detail peserta (penyelenggara & peserta).
// item     : baris peserta (squad, rep, gameNickname, gameUid)
// detail   : hasil detail { members, gameNickname, gameUid } atau { members: null } bila daftar anggota tidak tersedia
// loading  : sedang memuat detail
// error    : pesan gagal memuat detail
// mine     : squad milik user login -> badge "Squad kamu" dan anggota yang login diberi garis biru
function ParticipantDetailModal({
  item,
  detail,
  loading,
  error,
  mine = false,
  meUsername = "",
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const members = detail?.members ?? null;
  const nickname = detail?.gameNickname || item.gameNickname;
  const uid = detail?.gameUid || item.gameUid;

  // Daftar anggota tidak tersedia (peserta lain): tampilkan perwakilannya saja
  const repOnly = [
    { id: "rep", username: item.rep.username, avatar: item.rep.avatar },
  ];

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
          {mine && <span className="kl-pd-mine">Squad kamu</span>}
          <button
            type="button"
            className="kl-dr-x"
            aria-label="Tutup"
            onClick={onClose}
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        {loading ? (
          <div className="kl-dr-skel" aria-hidden="true">
            <i className="tall" />
            <i />
          </div>
        ) : (
          <>
            {error && <p className="kl-pd-empty">{error}</p>}
            {!error && (
              <>
                <h3 className="kl-dr-label">
                  {members
                    ? `Daftar Anggota (${members.length})`
                    : "Perwakilan"}
                </h3>
                <ul className="kl-pd-members">
                  {(members ?? repOnly).map((m) => (
                    <li
                      key={m.id ?? m.username}
                      className={
                        mine && meUsername && m.username === meUsername
                          ? "me"
                          : ""
                      }
                    >
                      <KlAvatar name={m.username} src={m.avatar} size={32} />
                      <span>{m.username}</span>
                      {(members === null ||
                        m.username === item.rep.username) && (
                        <em>Perwakilan</em>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h3 className="kl-dr-label kl-pd-gap">Akun In-Game Perwakilan</h3>
            <div className="kl-pd-acc">
              <div>
                <small>Nickname in-game</small>
                <b>{nickname || "-"}</b>
              </div>
              <div>
                <small>ID in-game</small>
                <CopyChip value={uid} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ParticipantDetailModal;
