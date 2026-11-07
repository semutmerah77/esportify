import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/icon";
import SquadLogo from "../../components/squad/SquadLogo";
import SquadPerformance from "../../components/squad/SquadPerformance";
import SquadMembers from "../../components/squad/SquadMembers";
import LeaveSquadDialog from "../../components/squad/LeaveSquadDialog";
import {
  getSquadDetail,
  leaveSquad,
  requestJoin,
} from "../../services/squadApi";
import "../../styles/squad.css";

const createdText = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
};

function SquadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [squad, setSquad] = useState(null);
  const [missing, setMissing] = useState(false);
  const [requested, setRequested] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let off = false;
    setSquad(null);
    setMissing(false);
    getSquadDetail(id)
      .then((data) => !off && (data ? setSquad(data) : setMissing(true)))
      .catch(() => !off && setMissing(true));
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

  const handleLeave = async () => {
    setBusy(true);
    setError("");
    try {
      await leaveSquad(squad.id);
      navigate("/squad/saya", { replace: true });
    } catch (err) {
      setError(err.message || "Gagal keluar dari squad.");
      setBusy(false);
    }
  };

  const role = squad.viewerRole;

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
          <code className="sqd-id">ID: #{squad.id}</code>
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
            <button type="button" className="sq-btn outline sqd-hero-btn blue">
              <Icon name="edit" size={14} /> Edit
            </button>
          )}
        </div>
      </section>

      <h2 className="sqd-title">Performa Squad</h2>
      <SquadPerformance winrates={squad.winrates} badges={squad.badges} />

      <SquadMembers squad={squad} onLeave={() => setLeaving(true)} />

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
