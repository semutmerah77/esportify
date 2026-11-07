import { useEffect, useState } from "react";
import Icon from "../../components/icon";
import Pagination from "../../components/admin/Pagination";
import SquadCard from "../../components/squad/SquadCard";
import { SEARCH_PAGE_SIZE, searchSquads } from "../../services/squadApi";
import "../../styles/squad.css";

function SearchSquad() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let off = false;
    searchSquads(query)
      .then((data) => !off && (setItems(data), setError(""), setReady(true)))
      .catch(
        (err) =>
          !off &&
          (setError(err.message || "Gagal memuat squad."), setReady(true)),
      );
    return () => {
      off = true;
    };
  }, [query]);

  const submit = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(input);
  };

  const totalPages = Math.max(1, Math.ceil(items.length / SEARCH_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * SEARCH_PAGE_SIZE;
  const visible = items.slice(start, start + SEARCH_PAGE_SIZE);

  return (
    <div className="sq-page">
      <h1 className="admin-title">Cari Squad</h1>

      <form className="sq-searchbar" onSubmit={submit} role="search">
        <div className="sq-search">
          <Icon name="search" size={18} />
          <input
            type="text"
            placeholder="Masukkan Id Squad atau Nama Squad"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <button type="submit" className="sq-btn primary">
          Cari
        </button>
      </form>

      <h2 className="sq-section">Daftar Squad</h2>

      {error && <p className="admin-message error">{error}</p>}

      {visible.length > 0 && (
        <div className="sq-grid">
          {visible.map((s) => (
            <SquadCard key={s.id} squad={s} />
          ))}
        </div>
      )}

      {ready && !error && items.length === 0 && (
        <p className="admin-message">Squad tidak ditemukan.</p>
      )}

      {items.length > SEARCH_PAGE_SIZE && (
        <Pagination
          page={safePage}
          totalItems={items.length}
          pageSize={SEARCH_PAGE_SIZE}
          onChange={setPage}
        />
      )}
    </div>
  );
}

export default SearchSquad;
