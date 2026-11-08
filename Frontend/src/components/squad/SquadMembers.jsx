import Icon from "../icon";

// Daftar anggota. Tombol aksi menyesuaikan peran pengguna:
// leader  : undang, permintaan bergabung, keluar, keluarkan anggota (tombol di kartu anggota)
// anggota : keluar
// bukan anggota : tidak ada tombol
function SquadMembers({ squad, onLeave, onKick, onInvite, onRequests }) {
  const isLeader = squad.viewerRole === "leader";
  const isMember = squad.viewerRole === "member" || isLeader;

  return (
    <section>
      <div className="sqd-members-head">
        <h2>
          Anggota Squad{" "}
          <span className="sqd-count">
            {squad.members.length}/{squad.capacity}
          </span>
        </h2>

        {isMember && (
          <div className="sqd-actions">
            {isLeader && (
              <>
                <button
                  type="button"
                  className="sqd-iconbtn primary"
                  title="Undang player"
                  aria-label="Undang player"
                  onClick={onInvite}
                >
                  <Icon name="user-plus" size={16} />
                </button>
                <button
                  type="button"
                  className="sqd-iconbtn"
                  title="Permintaan bergabung"
                  aria-label="Permintaan bergabung"
                  onClick={onRequests}
                >
                  <Icon name="inbox" size={16} />
                  {squad.pendingRequests > 0 && <i className="sqd-badge-dot" />}
                </button>
              </>
            )}
            <button
              type="button"
              className="sqd-iconbtn danger"
              title={
                squad.locked
                  ? "Roster terkunci, tidak bisa keluar"
                  : "Keluar dari squad"
              }
              aria-label="Keluar dari squad"
              disabled={squad.locked}
              onClick={onLeave}
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="sqd-members">
        {squad.members.map((m) => (
          <div key={m.id} className={`sqd-member ${m.isMe ? "me" : ""}`}>
            <span className="sqd-avatar">
              <Icon name="user" size={18} />
              {m.avatar && (
                <img
                  src={m.avatar}
                  alt=""
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
            </span>
            <div>
              <b>{m.username}</b>
              <em className={m.role}>
                {m.role === "leader" ? "Leader" : "Anggota"}
              </em>
            </div>
            {isLeader && m.role !== "leader" && (
              <button
                type="button"
                className="sqd-kick-btn"
                title="Keluarkan anggota"
                aria-label={`Keluarkan ${m.username}`}
                onClick={() => onKick(m)}
              >
                <Icon name="user-minus" size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default SquadMembers;
