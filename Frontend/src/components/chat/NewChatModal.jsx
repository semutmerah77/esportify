import { useEffect, useState } from "react";
import Icon from "../icon";
import Avatar from "../user/Avatar";
import { searchPlayers } from "../../services/squadApi";
import { openChatWithPlayer } from "../../services/chatApi";

// Modal "Buat Obrolan Baru": cari player (debounce 400 ms) lalu Kirim Pesan
function NewChatModal({ onClose, onOpened }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ items: [], message: "", done: false });
  const [searching, setSearching] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResult({ items: [], message: "", done: false });
      setSearching(false);
      return undefined;
    }
    let off = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const r = await searchPlayers(q);
        if (!off) setResult({ ...r, done: true });
      } catch (err) {
        if (!off) setResult({ items: [], message: err.message, done: true });
      } finally {
        if (!off) setSearching(false);
      }
    }, 400);
    return () => {
      off = true;
      clearTimeout(timer);
    };
  }, [query]);

  const start = async (player) => {
    if (startingId) return;
    setStartingId(player.id);
    setError("");
    try {
      const page = await openChatWithPlayer(player.id);
      onOpened(page);
    } catch (err) {
      setError(err.message || "Tidak dapat membuka percakapan.");
      setStartingId(null);
    }
  };

  return (
    <div
      className="ch-ov"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="ch-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ch-new-title"
      >
        <div className="ch-modal-head">
          <h3 id="ch-new-title">Buat Obrolan Baru</h3>
          <button
            type="button"
            className="ch-modal-x"
            onClick={onClose}
            aria-label="Tutup"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="ch-modal-body">
          <label className="ch-search">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Cari player dengan username"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </label>

          <p className="ch-modal-label">Hasil Pencarian</p>

          <div className="ch-results">
            {error && <p className="ch-modal-msg error">{error}</p>}

            {searching && !result.done && (
              <div className="ch-skel-row" aria-hidden="true">
                <i className="ch-skel round" />
                <i className="ch-skel line" />
              </div>
            )}

            {!searching && result.done && result.items.length === 0 && (
              <p className="ch-modal-msg">
                {result.message || "Hasil tidak ditemukan."}
              </p>
            )}

            {!query.trim() && (
              <p className="ch-modal-msg">
                Ketik username untuk mencari player.
              </p>
            )}

            {query.trim() &&
              result.items.map((p) => (
                <div className="ch-result" key={p.id}>
                  <Avatar src={p.avatar} name={p.username} size={36} />
                  <b>{p.username}</b>
                  <button
                    type="button"
                    className="ch-result-btn"
                    onClick={() => start(p)}
                    disabled={startingId !== null}
                  >
                    Kirim Pesan
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewChatModal;
