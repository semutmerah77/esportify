import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Icon from "../../components/icon";
import ParticipantDetailModal from "../../components/kelola/ParticipantDetailModal";
import ParticipantsPanel from "../../components/kelola/ParticipantsPanel";
import { longDate } from "../../utils/date";
import { getManageHeader } from "../../services/tournamentManageApi";
import { getTournamentParticipants } from "../../services/tournamentParticipantsApi";
import { getRegistration } from "../../services/tournamentRegApi";
import "../../styles/kelola.css";

// Judul halaman untuk peserta (desain memakai tampilan Kelola Turnamen yang sama)
const PAGE_TITLE = "Turnamen Saya";

const STATUS_LABEL = {
  pendaftaran: "Pendaftaran",
  berlangsung: "Berlangsung",
  selesai: "Selesai",
};

// Halaman turnamen untuk peserta (anggota roster pendaftaran diterima): tab Peserta, Bracket, Pengumuman.
function PesertaTurnamen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [head, setHead] = useState(null);
  const [headError, setHeadError] = useState("");
  const [tab, setTab] = useState("peserta");
  const [part, setPart] = useState({ items: [], ready: false, error: "" });
  // Detail peserta: { item, data, loading, error }
  const [detailOf, setDetailOf] = useState(null);

  useEffect(() => {
    let off = false;
    setHead(null);
    setHeadError("");
    getManageHeader(id)
      .then((h) => !off && setHead(h))
      .catch(
        (err) => !off && setHeadError(err.message || "Gagal memuat turnamen."),
      );
    getTournamentParticipants(id)
      .then(
        (res) => !off && setPart({ items: res.items, ready: true, error: "" }),
      )
      .catch(
        (err) =>
          !off &&
          setPart({
            items: [],
            ready: true,
            // 403: pesan BE "Daftar peserta hanya dapat dilihat oleh peserta turnamen ini."
            error: err.message || "Gagal memuat peserta.",
          }),
      );
    return () => {
      off = true;
    };
  }, [id]);

  // Daftar anggota hanya tersedia untuk squad sendiri (lewat detail pendaftaran).
  // Peserta lain: modal menampilkan perwakilan dan akun in-game saja.
  const openDetail = (item) => {
    if (!item.mine) {
      setDetailOf({ item, data: { members: null }, loading: false, error: "" });
      return;
    }
    setDetailOf({ item, data: null, loading: true, error: "" });
    getRegistration(item.id)
      .then((reg) =>
        setDetailOf((d) =>
          d?.item.id === item.id
            ? {
                ...d,
                loading: false,
                data: reg
                  ? {
                      members: reg.members,
                      gameNickname: reg.gameNickname,
                      gameUid: reg.gameUid,
                    }
                  : { members: null },
              }
            : d,
        ),
      )
      .catch(() =>
        // Gagal memuat anggota: tetap tampilkan perwakilan dan akun in-game dari daftar
        setDetailOf((d) =>
          d?.item.id === item.id
            ? { ...d, loading: false, data: { members: null } }
            : d,
        ),
      );
  };

  const back = (
    <button type="button" className="kl-back" onClick={() => navigate(-1)}>
      <Icon name="chevron-left" size={26} /> Kembali
    </button>
  );

  if (headError) {
    return (
      <div className="kl-page">
        {back}
        <p className="admin-message error">{headError}</p>
      </div>
    );
  }
  if (!head) return <div className="kl-page">{back}</div>;

  const percent = head.slot
    ? Math.min(100, Math.round(((head.filled ?? 0) / head.slot) * 100))
    : 0;
  const place =
    head.type === "online"
      ? "Online"
      : [head.city, head.province].filter(Boolean).join(", ") || "-";

  const tabs = [
    { key: "peserta", label: "Peserta" },
    { key: "bracket", label: "Bracket" },
    { key: "pengumuman", label: "Pengumuman" },
  ];

  return (
    <div className="kl-page">
      {back}
      <h1 className="admin-title kl-title">{PAGE_TITLE}</h1>

      <section className="kl-head">
        <div className="kl-head-top">
          <div>
            <h2>{head.name}</h2>
            <p>{head.game}</p>
          </div>
          <span className={`kl-pill ${head.status}`}>
            <i></i> {STATUS_LABEL[head.status] ?? head.status}
          </span>
        </div>

        <div className="kl-head-meta">
          <span>
            <Icon name="calendar" size={14} /> Pendaftaran tutup:{" "}
            {longDate(head.closeDate)}
          </span>
          <span>
            <Icon name="calendar" size={14} /> Jadwal main:{" "}
            {longDate(head.matchDate)}
          </span>
          <span>{place}</span>
          <span className="kl-slot">
            <Icon name="users" size={15} />
            <span>
              {head.filled ?? "-"}/{head.slot ?? "-"} tim
              <i className="kl-bar">
                <b style={{ width: `${percent}%` }} />
              </i>
            </span>
          </span>
          <div className="kl-head-actions">
            <Link to={`/turnamen/cari/${head.id}`} className="kl-detail-btn">
              Detail
            </Link>
          </div>
        </div>
      </section>

      <nav className="kl-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`kl-tab ${tab === t.key ? "on" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="kl-panel">
        {tab === "peserta" && (
          <ParticipantsPanel
            items={part.items}
            ready={part.ready}
            error={part.error}
            emptyText="Squad yang diterima akan muncul di sini."
            onDetail={openDetail}
          />
        )}

        {(tab === "bracket" || tab === "pengumuman") && (
          <p className="kl-empty">
            Fitur {tab === "bracket" ? "Bracket" : "Pengumuman"} akan segera
            tersedia.
          </p>
        )}
      </section>

      {detailOf && (
        <ParticipantDetailModal
          item={detailOf.item}
          detail={detailOf.data}
          loading={detailOf.loading}
          error={detailOf.error}
          mine={detailOf.item.mine}
          meUsername={user?.username ?? ""}
          onClose={() => setDetailOf(null)}
        />
      )}
    </div>
  );
}

export default PesertaTurnamen;
