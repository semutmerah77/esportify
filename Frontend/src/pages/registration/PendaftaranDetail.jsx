import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Icon from "../../components/icon";
import initials from "../../components/squad/initials";
import { MemberGrid, StatusPill } from "../../components/registration/RegParts";
import { getTournamentDetail } from "../../services/tournamentApi";
import { getRegistration, rupiah } from "../../services/tournamentRegApi";
import "../../styles/turnamen-daftar.css";

function PendaftaranDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reg, setReg] = useState(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [game, setGame] = useState("");

  useEffect(() => {
    let off = false;
    getRegistration(id)
      .then((r) => !off && (r ? setReg(r) : setMissing(true)))
      .catch(
        (err) => !off && setError(err.message || "Gagal memuat pendaftaran."),
      );
    return () => {
      off = true;
    };
  }, [id]);

  // Nama game tidak ada di detail pendaftaran: ambil dari detail turnamen
  useEffect(() => {
    if (!reg?.tournament?.id) return undefined;
    let off = false;
    getTournamentDetail(reg.tournament.id)
      .then((d) => !off && setGame(d.game || ""))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [reg]);

  const back = (
    <button type="button" className="d-back" onClick={() => navigate(-1)}>
      <Icon name="chevron-left" size={26} /> Kembali
    </button>
  );

  if (missing)
    return (
      <div className="sq-page">
        {back}
        <p className="admin-message">Pendaftaran tidak ditemukan.</p>
      </div>
    );
  if (error)
    return (
      <div className="sq-page">
        {back}
        <p className="admin-message error">{error}</p>
      </div>
    );
  if (!reg) return <div className="sq-page">{back}</div>;

  const date = reg.registeredAt
    ? new Date(reg.registeredAt).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";

  return (
    <div className="sq-page tr-page">
      {back}
      <h1 className="admin-title">Detail Pendaftaran</h1>

      <section className="tr-card tr-head">
        <h2>{reg.tournament.name}</h2>
        {game && <small>{game}</small>}
        <div className="tr-fee">
          <span>Biaya Pendaftaran:</span>
          <b>{reg.tournament.paid ? rupiah(reg.tournament.fee) : "Gratis"}</b>
        </div>
      </section>

      <section className="tr-card tr-info">
        <div className="tr-statusline">
          Status pendaftaran: <StatusPill status={reg.status} full />
          {reg.rosterLocked && (
            <span className="tr-lock">
              <Icon name="lock" size={12} /> Roster Terkunci
            </span>
          )}
        </div>
        {reg.status === "ditolak" && reg.reason && (
          <p className="tr-warn">Alasan penolakan: {reg.reason}</p>
        )}
        <small className="tr-muted">
          Didaftarkan{" "}
          {reg.byMe ? "oleh kamu" : `oleh ${reg.registrant.username}`} • {date}
        </small>

        <b className="tr-label">Squad:</b>
        <div className="tr-squadrow">
          <span className="tr-squad-ic">{initials(reg.squad.name)}</span>
          <b>{reg.squad.name}</b>
          <code>ID: {reg.squad.code}</code>
        </div>

        <b className="tr-label">Daftar Anggota (saat mendaftar):</b>
        <MemberGrid members={reg.members} meName={user?.username} />

        <b className="tr-label">Akun in-game perwakilan:</b>
        <div className="tr-ingame-view">
          <div>
            <small>Nickname in-game</small>
            <b>{reg.gameNickname || "-"}</b>
          </div>
          <div>
            <small>ID in-game</small>
            <b>{reg.gameUid || "-"}</b>
          </div>
        </div>
      </section>
    </div>
  );
}

export default PendaftaranDetail;
