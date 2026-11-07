import Icon from "../icon";

const percent = (wins, total) => (total > 0 ? (wins / total) * 100 : 0); // R4.03

// Dua kartu: Winrate Squad dan Koleksi Badge Prestasi.
function SquadPerformance({ winrates, badges }) {
  return (
    <div className="sqd-perf">
      <section className="sqd-card">
        <header className="sqd-card-head">
          <h3>
            <i className="sqd-dot blue" /> WINRATE SQUAD
          </h3>
          <button type="button" className="sqd-link">
            Lihat Semua <Icon name="chevron-right" size={13} />
          </button>
        </header>

        {winrates.length === 0 ? (
          <p className="sqd-empty">Belum ada riwayat turnamen.</p>
        ) : (
          <div className="sqd-rates">
            {winrates.map((w, i) => {
              const pct = percent(w.wins, w.total);
              return (
                <div key={w.game} className={`sqd-rate c${i % 3}`}>
                  <div className="sqd-rate-top">
                    <span>
                      <i className="sqd-dot" /> {w.game}
                    </span>
                    <span className="sqd-rate-num">
                      <small>
                        ({w.wins}/{w.total})
                      </small>{" "}
                      <b>{pct.toFixed(1)}%</b>
                    </span>
                  </div>
                  <div className="sqd-bar">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="sqd-note">
          <Icon name="info" size={12} /> Metode: (Total Kemenangan / Total
          Pertandingan per Game) × 100%
        </p>
      </section>

      <section className="sqd-card">
        <header className="sqd-card-head">
          <h3>
            <i className="sqd-dot amber" /> KOLEKSI BADGE PRESTASI
            {badges.tier && (
              <span className="sqd-tier">Tier: {badges.tier}</span>
            )}
          </h3>
          <button type="button" className="sqd-link">
            Lihat Semua ({badges.items.reduce((n, b) => n + b.count, 0)}){" "}
            <Icon name="chevron-right" size={13} />
          </button>
        </header>

        {badges.items.length === 0 ? (
          <p className="sqd-empty">
            Belum ada badge. Raih juara 1, 2, atau 3 untuk mendapatkannya.
          </p>
        ) : (
          <div className="sqd-badges">
            {badges.items.map((b) => (
              <div key={b.type} className={`sqd-badge ${b.type}`}>
                <span className="sqd-badge-ic">
                  <Icon name="trophy" size={18} />
                </span>
                <strong>
                  {b.count}
                  <small>x</small>
                </strong>
                <b>{b.title}</b>
                <em>{b.label}</em>
              </div>
            ))}
          </div>
        )}

        <p className="sqd-note">
          <Icon name="sparkles" size={12} /> Badge dihitung dan ditampilkan
          berdasarkan akumulasi seluruh divisi game
          <span className="sqd-verified">{badges.verified} Terverifikasi</span>
        </p>
      </section>
    </div>
  );
}

export default SquadPerformance;
