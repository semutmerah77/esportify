import { useState } from "react";
import Icon from "../icon";
import { ParticipantRow, PesertaEmpty } from "./KlParts";

// Isi tab Peserta (dipakai penyelenggara dan peserta): pencarian + daftar squad + keadaan kosong.
// items: { id, mine, squad{name,code,logo}, rep{username}, gameNickname, gameUid }
function ParticipantsPanel({ items, ready, error, emptyText, onDetail }) {
  const [q, setQ] = useState("");
  const keyword = q.trim().toLowerCase().replace(/^#/, "");
  const shown = items.filter(
    (it) =>
      !keyword ||
      it.squad.name.toLowerCase().includes(keyword) ||
      String(it.squad.code).toLowerCase().includes(keyword) ||
      String(it.rep.username).toLowerCase().includes(keyword),
  );

  return (
    <>
      <div className="kl-panel-head kl-panel-bar">
        <span>
          {keyword
            ? `${shown.length} squad ditemukan`
            : `${items.length} squad peserta`}
        </span>
        <label className="kl-search">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Cari Nama Squad atau ID Squad"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              type="button"
              className="kl-search-x"
              aria-label="Hapus pencarian"
              onClick={() => setQ("")}
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </label>
      </div>

      {error && <p className="admin-message error">{error}</p>}

      {ready && !error && items.length === 0 && (
        <PesertaEmpty icon="users" title="Belum ada peserta" text={emptyText} />
      )}
      {ready && !error && items.length > 0 && shown.length === 0 && (
        <PesertaEmpty
          ring
          icon="search"
          title="Squad tidak ditemukan"
          text="Coba kata kunci lain: nama squad, ID, atau perwakilan."
        />
      )}

      {shown.length > 0 && (
        <ul className="kl-list kl-plist">
          {shown.map((item) => (
            <ParticipantRow
              key={item.id}
              item={item}
              mine={item.mine}
              onDetail={onDetail}
            />
          ))}
        </ul>
      )}
    </>
  );
}

export default ParticipantsPanel;
