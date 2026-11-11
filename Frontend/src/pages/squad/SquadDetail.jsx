import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Icon from "../../components/icon";
import SquadLogo from "../../components/squad/SquadLogo";
import SquadPerformance from "../../components/squad/SquadPerformance";
import SquadMembers from "../../components/squad/SquadMembers";
import LeaveSquadDialog from "../../components/squad/LeaveSquadDialog";
import EditSquadModal from "../../components/squad/EditSquadModal";
import KickMemberDialog from "../../components/squad/KickMemberDialog";
import TransferLeaderDialog from "../../components/squad/TransferLeaderDialog";
import InvitePlayerModal from "../../components/squad/InvitePlayerModal";
import JoinRequestsModal from "../../components/squad/JoinRequestsModal";
import JoinSquadDialog from "../../components/squad/JoinSquadDialog";
import SuccessDialog from "../../components/squad/SuccessDialog";
import { getRegistrationState } from "../../services/tournamentRegApi";
import { isSquadRosterLocked } from "../../services/tournamentManageApi";
import {
  getSquadDetail,
  isRosterLocked,
  kickMember,
  leaveSquad,
  requestJoin,
  respondInvitation,
  transferLeader,
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
  const location = useLocation();
  const { user } = useAuth();
  const [squad, setSquad] = useState(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [joining, setJoining] = useState(false); // dialog konfirmasi gabung
  const [joinError, setJoinError] = useState("");
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [kicking, setKicking] = useState(null); // anggota yang akan dikeluarkan
  const [kickError, setKickError] = useState("");
  const [promoting, setPromoting] = useState(null); // anggota yang akan dijadikan Leader
  const [promoteError, setPromoteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(""); // pesan gagal
  const [rosterLocked, setRosterLocked] = useState(false);
  // Popup berhasil. Bisa dibawa dari halaman lain lewat navigate(..., { state: { notice } })
  const [notice, setNotice] = useState(location.state?.notice || "");

  // Hapus state navigasi supaya popup tidak muncul lagi saat halaman dimuat ulang
  useEffect(() => {
    if (location.state?.notice)
      navigate(location.pathname, { replace: true, state: null });
  }, []);

  useEffect(() => {
    let off = false;
    setSquad(null);
    setMissing(false);
    setLoadError("");
    getSquadDetail(id)
      .then(async (data) => {
        if (off) return;
        if (!data) return setMissing(true);
        // Anggota squad: cek pendaftaran turnamen untuk status roster terkunci
        if (data.viewerRole !== "guest") {
          try {
            const regs = await getSquadRegistrations(data.squadId ?? data.id);
            data.locked = regs.some((r) => r.rosterLocked);
          } catch {
            /* biarkan, tetap bisa terdeteksi dari error 422 */
          }
        }
        if (!off) setSquad(data);
      })
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

  useEffect(() => {
    if (!squad || squad.viewerRole !== "leader") return undefined;
    let off = false;
    isSquadRosterLocked(squad.squadId ?? squad.id)
      .then((l) => !off && setRosterLocked(l))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [squad?.squadId, squad?.id, squad?.viewerRole]);

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

  const apiId = squad.squadId ?? squad.id;

  // Muat ulang detail (anggota, jumlah, permintaan_saya, undangan_saya, badge permintaan)
  const reload = async () => {
    try {
      const fresh = await getSquadDetail(id);
      if (fresh) setSquad(fresh);
    } catch {
      /* biarkan data lama */
    }
  };

  // Kirim permintaan bergabung (setelah konfirmasi)
  const handleJoin = async () => {
    setBusy(true);
    setJoinError("");
    try {
      const res = await requestJoin(apiId);
      setJoining(false);
      setNotice(res.message || "Permintaan bergabung berhasil dikirim.");
      await reload();
    } catch (err) {
      if (isRosterLocked(err)) setSquad((s) => ({ ...s, locked: true }));
      else if (err.status === 422) reload(); // status berubah (mis. sudah diundang / sudah mengajukan)
      setJoinError(err.message || "Gagal mengirim permintaan.");
    } finally {
      setBusy(false);
    }
  };

  // Terima / tolak undangan dari halaman detail squad
  const handleInviteAnswer = async (accept) => {
    if (!squad.myInvite) return;
    setBusy(true);
    try {
      const res = await respondInvitation(squad.myInvite.id, accept);
      setNotice(res.message);
      await reload();
    } catch (err) {
      setToast(err.message || "Gagal menanggapi undangan.");
      if (err.removed || err.status === 422) reload();
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
      setNotice("Perubahan squad berhasil disimpan.");
    } catch (err) {
      setToast(err.message || "Tersimpan, tetapi gagal memuat ulang data.");
    }
  };

  const handleLeave = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await leaveSquad(apiId);
      navigate("/squad/saya", {
        replace: true,
        state: { notice: res.message },
      });
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
      setSquad(res.squad); // detail terbaru dari BE (anggota & jumlah sudah ter-update)
      closeKick();
      setNotice(res.message || "Anggota berhasil dikeluarkan.");
    } catch (err) {
      if (isRosterLocked(err)) setSquad((s) => ({ ...s, locked: true }));
      setKickError(err.message || "Gagal mengeluarkan anggota.");
    } finally {
      setBusy(false);
    }
  };

  const closePromote = () => {
    setPromoting(null);
    setPromoteError("");
  };

  // Alihkan kepemimpinan: Leader lama menjadi anggota biasa, tampilan dirender ulang dari data BE
  const handlePromote = async () => {
    if (!promoting) return;
    setBusy(true);
    setPromoteError("");
    try {
      const res = await transferLeader(apiId, promoting.playerId);
      setSquad(res.squad); // is_leader sudah false -> tombol Leader hilang
      closePromote();
      setNotice(res.message || "Anggota berhasil dijadikan Leader.");
    } catch (err) {
      setPromoteError(err.message || "Gagal mengalihkan kepemimpinan.");
      if (err.status === 404 || err.status === 403) reload();
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
    locked: Boolean(squad.locked) || rosterLocked,
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
          <code className="sqd-id">ID: #{squad.id}</code>
          {squad.locked && (
            <span className="tr-lock">
              <Icon name="lock" size={12} /> Roster Terkunci
            </span>
          )}
          {role === "guest" && squad.myInvite && (
            <div className="sqd-invite-box">
              <span>Kamu diundang</span>
              <div className="sqd-invite-actions">
                <button
                  type="button"
                  className="sqi-btn reject"
                  disabled={busy}
                  onClick={() => handleInviteAnswer(false)}
                >
                  Tolak
                </button>
                <button
                  type="button"
                  className="sqi-btn accept"
                  disabled={busy}
                  onClick={() => handleInviteAnswer(true)}
                >
                  Terima
                </button>
              </div>
            </div>
          )}
          {role === "guest" && !squad.myInvite && (
            <button
              type="button"
              className="sq-btn primary sqd-hero-btn"
              onClick={() => {
                setJoinError("");
                setJoining(true);
              }}
              disabled={busy || Boolean(squad.myRequest) || squad.full}
            >
              {squad.myRequest
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
        onPromote={setPromoting}
        onInvite={() => setInviting(true)}
        onRequests={() => setRequestsOpen(true)}
      />

      {editing && (
        <EditSquadModal
          squad={squad}
          onClose={() => setEditing(false)}
          onSaved={handleSaved}
        />
      )}

      {inviting && (
        <InvitePlayerModal
          squad={squad}
          locked={view.locked}
          onClose={() => setInviting(false)}
        />
      )}

      {requestsOpen && (
        <JoinRequestsModal
          squad={squad}
          locked={view.locked}
          onClose={() => setRequestsOpen(false)}
          onChanged={reload}
        />
      )}

      {joining && (
        <JoinSquadDialog
          name={squad.name}
          loading={busy}
          error={joinError}
          onConfirm={handleJoin}
          onClose={() => setJoining(false)}
        />
      )}

      {promoting && (
        <TransferLeaderDialog
          member={promoting}
          loading={busy}
          error={promoteError}
          onConfirm={handlePromote}
          onClose={closePromote}
        />
      )}

      {kicking && (
        <KickMemberDialog
          member={kicking}
          locked={view.locked}
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

      {notice && (
        <SuccessDialog message={notice} onClose={() => setNotice("")} />
      )}
    </div>
  );
}

export default SquadDetail;
