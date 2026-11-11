import { useEffect, useState } from "react";
import Icon from "../icon";
import initials from "./initials";
import {
  getSentInvitations,
  invitePlayer,
  searchPlayers,
} from "../../services/squadApi";
import RosterLockNotice from "./RosterLockNotice";

const DEBOUNCE_MS = 400;

function InvitePlayerModal({ squad, locked = false, onClose }) {
  const [tab, setTab] = useState("cari"); // "cari" | "teman"
  const [input, setInput] = useState("");
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [sent, setSent] = useState(() => new Set()); // id player yang undangannya terkirim
  const [sending, setSending] = useState(null); // id player yang sedang diundang
  const [actionError, setActionError] = useState("");

  // Id player yang sudah menjadi anggota squad ini
  const memberIds = new Set(squad.members.map((m) => m.playerId));

  // Tandai player yang undangannya masih menunggu sebagai "Terkirim"
  useEffect(() => {
    let off = false;
    getSentInvitations(squad.squadId ?? squad.id)
      .then((ids) => !off && setSent(new Set(ids)))
      .catch(() => {}); // gagal dimuat: tombol Undang tetap bisa dipakai
    return () => {
      off = true;
    };
  }, [squad.squadId, squad.id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Cari otomatis saat mengetik (jeda singkat). Username kosong = tampilan awal.
  useEffect(() => {
    const q = input.trim();
    if (!q) {
      setItems([]);
      setSearched(false);
      setError("");
      return undefined;
    }
    let off = false;
    const t = setTimeout(() => {
      searchPlayers(q)
        .then((res) => {
          if (off) return;
          setItems(res.items);
          setMessage(res.message);
          setError("");
          setSearched(true);
        })
        .catch((err) => {
          if (off) return;
          setItems([]);
          setError(err.message || "Gagal mencari player.");
          setSearched(true);
        });
    }, DEBOUNCE_MS);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, [input]);

  const invite = async (player) => {
    setSending(player.id);
    setActionError("");
    try {
      await invitePlayer(squad.squadId ?? squad.id, player.id);
      setSent((prev) => new Set(prev).add(player.id));
    } catch (err) {
      // Sudah pernah diundang: anggap terkirim, tanpa pesan error
      if (/sudah diundang/i.test(err.message || "")) {
        setSent((prev) => new Set(prev).add(player.id));
      } else {
        setActionError(err.message || "Gagal mengirim undangan.");
      }
    } finally {
      setSending(null);
    }
  };

  if (locked) {
    return (
      <div
        className="sq-ov"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="sqp-modal" role="dialog" aria-modal="true">
          <div className="sqp-head">
            <h2>Tambah Anggota</h2>
            <button
              type="button"
              className="sqp-close"
              aria-label="Tutup"
              onClick={onClose}
            >
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="sqp-body lock">
            <RosterLockNotice />
          </div>
          <div className="sqp-foot" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="sq-ov"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="sqp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sqp-title"
      >
        <div className="sqp-head">
          <h2 id="sqp-title">Tambah Anggota</h2>
          <button
            type="button"
            className="sqp-close"
            aria-label="Tutup"
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="sqp-body">
          <div className="sqp-tabs">
            <button
              type="button"
              className={`sqp-tab ${tab === "cari" ? "active" : ""}`}
              onClick={() => setTab("cari")}
            >
              <Icon name="search" size={15} /> Cari Player
            </button>
            <button
              type="button"
              className={`sqp-tab ${tab === "teman" ? "active" : ""}`}
              onClick={() => setTab("teman")}
            >
              <Icon name="users" size={15} /> Teman Saya
            </button>
          </div>

          {tab === "teman" && (
            <div className="sqp-empty">
              <span className="sqp-empty-ic">
                <Icon name="users" size={26} />
              </span>
              <b>Belum ada teman</b>
              <p>
                Daftar teman belum tersedia. Gunakan tab Cari Player untuk
                mengundang anggota baru.
              </p>
            </div>
          )}

          {tab === "cari" && (
            <>
              <div className="sq-search sqp-search">
                <Icon name="search" size={16} />
                <input
                  type="text"
                  placeholder="Cari player dengan username"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  autoFocus
                />
              </div>

              {!searched && !error && (
                <div className="sqp-empty">
                  <span className="sqp-empty-ic">
                    <Icon name="search" size={26} />
                  </span>
                  <b>Temukan player</b>
                  <p>
                    Ketik username di kolom pencarian di atas untuk mulai
                    mengundang anggota baru.
                  </p>
                </div>
              )}

              {error && <p className="sq-err">{error}</p>}
              {actionError && <p className="sq-err">{actionError}</p>}

              {searched && !error && items.length === 0 && (
                <p className="sqp-note">
                  {message || "Hasil tidak ditemukan."}
                </p>
              )}

              {items.length > 0 && (
                <>
                  <h3 className="sqp-result-title">Hasil Pencarian</h3>
                  <ul className="sqp-list">
                    {items.map((p) => {
                      const isMember = memberIds.has(p.id);
                      const isSent = sent.has(p.id);
                      return (
                        <li key={p.id} className="sqp-row">
                          <span className="sqp-avatar">
                            {initials(p.username)}
                          </span>
                          <b>{p.username}</b>
                          {isMember ? (
                            <span className="sqp-state">
                              <Icon name="user-check" size={15} /> Sudah Anggota
                            </span>
                          ) : isSent ? (
                            <span className="sqp-state">
                              <Icon name="check" size={15} /> Terkirim
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="sq-btn primary sqp-invite"
                              disabled={sending === p.id || squad.full}
                              title={
                                squad.full ? "Squad sudah penuh" : undefined
                              }
                              onClick={() => invite(p)}
                            >
                              {sending === p.id ? "Mengirim..." : "Undang"}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>

        <div className="sqp-foot" />
      </div>
    </div>
  );
}

export default InvitePlayerModal;
