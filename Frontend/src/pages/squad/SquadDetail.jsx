import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Icon from "../../components/icon";
import SquadLogo from "../../components/squad/SquadLogo";
import SquadPerformance from "../../components/squad/SquadPerformance";
import SquadMembers from "../../components/squad/SquadMembers";
import LeaveSquadDialog from "../../components/squad/LeaveSquadDialog";
import EditSquadModal from "../../components/squad/EditSquadModal";
import KickMemberDialog from "../../components/squad/KickMemberDialog";
import InvitePlayerModal from "../../components/squad/InvitePlayerModal";
import {
  getSquadDetail,
  isRosterLocked,
  kickMember,
  leaveSquad,
  requestJoin,
} from "../../services/squadApi";
import "../../styles/squad.css";

const createdText = (value) => {
  // BE: "YYYY-MM-DD HH:mm:ss" -> format ISO agar terbaca di semua browser
  const d = new Date(String(value ?? "").replace(" ", "T"));
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
};

function SquadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [squad, setSquad] = useState(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [requested, setRequested] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [kicking, setKicking] = useState(null);
  const [kickError, setKickError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let off = false;
    setSquad(null);
    setMissing(false);
    setLoadError("");
    getSquadDetail(id)
      .then((data) => !off && (data ? setSquad(data) : setMissing(true)))
      .catch(
        (err) =>
          !off && setLoadError(err.message || "Gagal memuat detail squad."),
      );
    return () => {
      off = true;
    };
  }, [id]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const back = (
    <button type="button" className="d-back" onClick={() => navigate(-1)}>
      <Icon name="chevron-left" size={26} /> Kembali
    </button>
  );

  if (missing) {
    return (
      <div className="sq-page">
        {back}
        <p className="admin-message">Squad tidak ditemukan.</p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="sq-page">
        {back}
        <p className="admin-message error">{loadError}</p>
      </div>
    );
  }
  if (!squad) return <div className="sq-page">{back}</div>;

  const handleJoin = async () => {
    setBusy(true);
    try {
      await requestJoin(squad.id);
      setRequested(true);
      setToast("Permintaan bergabung terkirim. Menunggu persetujuan Leader.");
    } catch (err) {
      setToast(err.message || "Gagal mengirim permintaan.");
    } finally {
      setBusy(false);
    }
  };

  // Setelah PUT berhasil: ambil ulang detail supaya data (termasuk logo_url baru) akurat
  const handleSaved = async () => {
    setEditing(false);
    try {
      const fresh = await getSquadDetail(id);
      if (fresh) setSquad(fresh);
      setToast("Perubahan squad berhasil disimpan.");
    } catch (err) {
      setToast(err.message || "Tersimpan, tetapi gagal memuat ulang data.");
    }
  };

  const apiId = squad.squadId ?? squad.id;

  const handleLeave = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await leaveSquad(apiId);
      navigate("/squad/saya", { replace: true, state: { toast: res.message } });
    } catch (err) {
      if (isRosterLocked(err)) setSquad((s) => ({ ...s, locked: true }));
      setError(err.message || "Gagal keluar dari squad.");
      setBusy(false);
    }
  };

  const closeKick = () => {
    setKicking(null);
    setKickError("");
  };

  const handleKick = async () => {
    if (!kicking) return;
    setBusy(true);
    setKickError("");
    try {
      const res = await kickMember(apiId, kicking.playerId);
      setSquad(res.squad);
      closeKick();
      setToast(res.message || "Anggota berhasil dikeluarkan.");
    } catch (err) {
      if (isRosterLocked(err)) setSquad((s) => ({ ...s, locked: true }));
      setKickError(err.message || "Gagal mengeluarkan anggota.");
    } finally {
      setBusy(false);
    }
  };

  const role = squad.viewerRole;
  // Tandai anggota yang sedang login (dicocokkan lewat username)
  const view = {
    ...squad,
    members: squad.members.map((m) => ({
      ...m,
      isMe: Boolean(user?.username) && m.username === user.username,
    })),
  };

  return (
    <div className="sq-page">
      {back}

      <section className="sqd-hero">
        <SquadLogo squad={squad} size={64} />
        <div className="sqd-hero-main">
          <h1>{squad.name}</h1>
          {squad.description && <p>{squad.description}</p>}
          <small>
            <Icon name="calendar" size={12} /> Dibuat:{" "}
            {createdText(squad.createdAt)}
          </small>
        </div>

        <div className="sqd-hero-side">
          <code className="sqd-id">ID: {squad.id}</code>
          {role === "guest" && (
            <button
              type="button"
              className="sq-btn primary sqd-hero-btn"
              onClick={handleJoin}
              disabled={busy || requested || squad.full}
            >
              {requested
                ? "Permintaan Terkirim"
                : squad.full
                  ? "Squad Penuh"
                  : "Gabung Squad"}
            </button>
          )}
          {role === "leader" && (
            <button
              type="button"
              className="sq-btn outline sqd-hero-btn blue"
              onClick={() => setEditing(true)}
            >
              <Icon name="edit" size={14} /> Edit
            </button>
          )}
        </div>
      </section>

      <h2 className="sqd-title">Performa Squad</h2>
      <SquadPerformance winrates={squad.winrates} badges={squad.badges} />

      <SquadMembers
        squad={view}
        onLeave={() => setLeaving(true)}
        onKick={setKicking}
        onInvite={() => setInviting(true)}
      />
      {editing && (
        <EditSquadModal
          squad={squad}
          onClose={() => setEditing(false)}
          onSaved={handleSaved}
        />
      )}

      {inviting && (
        <InvitePlayerModal squad={squad} onClose={() => setInviting(false)} />
      )}

      {kicking && (
        <KickMemberDialog
          member={kicking}
          locked={squad.locked}
          loading={busy}
          error={kickError}
          onConfirm={handleKick}
          onClose={closeKick}
        />
      )}

      {leaving && (
        <LeaveSquadDialog
          name={squad.name}
          isLeader={role === "leader"}
          loading={busy}
          error={error}
          onConfirm={handleLeave}
          onClose={() => {
            setLeaving(false);
            setError("");
          }}
        />
      )}
      {toast && (
        <div className="sq-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

export default SquadDetail;
