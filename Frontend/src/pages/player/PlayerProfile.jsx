import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/icon";
import Avatar from "../../components/user/Avatar";
import TrophyCards from "../../components/player/TrophyCards";
import { getPlayerProfile } from "../../services/profileApi";
import "../../styles/player-profile.css";

const GENDER_LABEL = {
  "laki-laki": "Laki-laki",
  perempuan: "Perempuan",
  rahasia: "Rahasia",
};

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

function Skeleton() {
  return (
    <div aria-hidden="true">
      <div className="pr-card pp-skel-card">
        <i className="pp-skel round" />
        <div className="pp-skel-lines">
          <i className="pp-skel w40" />
          <i className="pp-skel w60" />
        </div>
      </div>
      <div className="pr-card pp-skel-card block">
        <i className="pp-skel w20" />
        <div className="pp-skel-row">
          <i className="pp-skel box" />
          <i className="pp-skel box" />
          <i className="pp-skel box" />
        </div>
      </div>
      <div className="pr-card pp-skel-card block">
        <i className="pp-skel w20" />
        <i className="pp-skel box wide" />
      </div>
    </div>
  );
}

// Profil Player lain (PB-23). Hanya 1 request: GET /players/{id}/profil
// (squad dan piala sudah termasuk). Hasil di-cache per id di profileApi.
function PlayerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ data: null, error: "", missing: false });

  useEffect(() => {
    let off = false;
    setState({ data: null, error: "", missing: false });
    getPlayerProfile(id)
      .then((data) => !off && setState({ data, error: "", missing: false }))
      .catch((err) => {
        if (off) return;
        if (err.status === 404)
          setState({ data: null, error: "", missing: true });
        else
          setState({
            data: null,
            error: err.message || "Profil tidak dapat dimuat.",
            missing: false,
          });
      });
    return () => {
      off = true;
    };
  }, [id]);

  const { data, error, missing } = state;

  return (
    <div className="pr-page">
      <button type="button" className="pr-back" onClick={() => navigate(-1)}>
        <svg
          width="25"
          height="25"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Kembali
      </button>

      <h1 className="pr-title">Profil</h1>
      <p className="pr-sub">Informasi pemain</p>

      {missing && <p className="admin-message">Player tidak ditemukan.</p>}
      {error && <p className="admin-message error">{error}</p>}
      {!data && !missing && !error && <Skeleton />}

      {data && (
        <>
          <section className="pr-card pp-hero">
            <div className="pp-hero-ring">
              <Avatar src={data.avatar} name={data.username} size={72} />
            </div>
            <div className="pp-hero-main">
              <div className="pp-hero-name">
                <h2>{data.username}</h2>
                {GENDER_LABEL[data.gender] && (
                  <span className="pp-gender">{GENDER_LABEL[data.gender]}</span>
                )}
              </div>
              {data.bio && <p>{data.bio}</p>}
            </div>
            {!data.isSelf && (
              // PB-27 (Chat): aksi tombol ini dipasang di PB-27
              <button type="button" className="pp-msg-btn">
                <Icon name="mail" size={16} /> Kirim Pesan
              </button>
            )}
          </section>

          <section className="pr-card">
            <div className="pr-head">
              <h3>Prestasi</h3>
              <p>Piala kemenangan Pemain.</p>
            </div>
            <TrophyCards trophies={data.trophies} />
          </section>

          <section className="pr-card">
            <div className="pr-head">
              <h3>Squad</h3>
              <p>Squad yang diikuti.</p>
            </div>
            {data.squads.length === 0 ? (
              <p className="pp-empty">Belum bergabung di squad mana pun.</p>
            ) : (
              <div className="pp-squads">
                {data.squads.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="pp-squad"
                    onClick={() => navigate(`/squad/${s.id}`)}
                  >
                    <span className="pp-squad-logo">
                      {initials(s.name)}
                      {s.logo && (
                        <img
                          src={s.logo}
                          alt=""
                          width="44"
                          height="44"
                          loading="lazy"
                          onError={(e) =>
                            (e.currentTarget.style.display = "none")
                          }
                        />
                      )}
                    </span>
                    <span className="pp-squad-name">{s.name}</span>
                    <code>ID: {s.code}</code>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default PlayerProfile;
