import Icon from "../icon";
import "../../styles/squad-performance.css";

// Nomor halaman (paging di FE). Tidak tampil kalau hanya 1 halaman.
function SquadPager({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="sp-pager" aria-label="Halaman">
      <button
        type="button"
        aria-label="Halaman sebelumnya"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        <Icon name="chevron-left" size={13} />
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={n === page ? "on" : ""}
          aria-current={n === page ? "page" : undefined}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        aria-label="Halaman berikutnya"
        disabled={page === pages}
        onClick={() => onChange(page + 1)}
      >
        <Icon name="chevron-right" size={13} />
      </button>
    </nav>
  );
}

export default SquadPager;
