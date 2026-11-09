import { useState } from "react";
import Icon from "../icon";
import MemberProfileModal from "./MemberProfileModal";

// Daftar anggota. Tombol aksi menyesuaikan peran pengguna:
// leader  : undang, permintaan bergabung, keluar; jadikan leader & keluarkan anggota lewat profil anggota
// anggota : keluar
// bukan anggota : tidak ada tombol
function SquadMembers({
  squad,
  onLeave,
  onKick,
  onPromote,
  onInvite,
  onRequests,
}) {
  const isLeader = squad.viewerRole === "leader";
  const isMember = squad.viewerRole === "member" || isLeader;
  const [selected, setSelected] = useState(null); // anggota yang profilnya dibuka

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
        {squad.members.map((m) => {
          // Klik kartu anggota lain untuk membuka profil + aksi (kartu sendiri tidak punya aksi)
          const clickable = isMember && !m.isMe;
          return (
            <div
              key={m.id}
              className={`sqd-member ${m.isMe ? "me" : ""} ${clickable ? "clickable" : ""}`}
              {...(clickable
                ? {
                    role: "button",
                    tabIndex: 0,
                    onClick: () => setSelected(m),
                    onKeyDown: (e) =>
                      (e.key === "Enter" || e.key === " ") &&
                      (e.preventDefault(), setSelected(m)),
                  }
                : {})}
            >
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
            </div>
          );
        })}
      </div>

      {selected && (
        <MemberProfileModal
          member={selected}
          canManage={isLeader}
          onClose={() => setSelected(null)}
          onPromote={(m) => {
            setSelected(null);
            onPromote(m);
          }}
          onKick={(m) => {
            setSelected(null);
            onKick(m);
          }}
        />
      )}
    </section>
  );
}

export default SquadMembers;
