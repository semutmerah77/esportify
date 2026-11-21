import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CancellationIcon from "../../components/kelola/CancellationIcon";
import { CancellationContent } from "../../components/kelola/CancellationRequestView";
import RejectCancellationDialog from "../../components/admin/RejectCancellationDialog";
import ActionDonePopup from "../../components/kelola/ActionDonePopup";
import {
  approveCancellation,
  getAdminCancellationDetail,
  rejectCancellation,
} from "../../services/adminCancellationApi";
import { formatShortDate } from "../../services/tournamentCancellationApi";
import "../../styles/match-report.css";
import "../../styles/tournament-cancellation.css";

const FEE_LABEL = { berbayar: "Berbayar", gratis: "Gratis" };
const TYPE_LABEL = { online: "Online", offline: "Offline" };
const RESULT_BANNER = {
  disetujui: { tone: "danger", title: "Pembatalan disetujui", icon: "check" },
  ditolak: { tone: "plain", title: "Pembatalan ditolak", icon: "x-circle" },
};

// Jarak halaman dipaksa lewat inline style supaya tidak terpengaruh CSS global admin
const PAGE_STYLE = {
  display: "block",
  minHeight: 0,
  height: "auto",
  margin: "0 auto",
  paddingTop: 0,
};
const BACK_STYLE = {
  margin: "0 0 12px -8px",
  height: "auto",
  minHeight: 0,
};
const TITLE_STYLE = { margin: "0 0 18px", padding: 0 };

// Halaman detail pembatalan turnamen (admin): /admin/pengajuan/pembatalan/:id
function AdminCancellationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ data: null, error: "" });
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [done, setDone] = useState(null); // { title, text }

  useEffect(() => {
    let off = false;
    setState({ data: null, error: "" });
    getAdminCancellationDetail(id)
      .then((data) => !off && setState({ data, error: "" }))
      .catch(
        (err) =>
          !off &&
          setState({
            data: null,
            error: err.message || "Detail pembatalan tidak dapat dimuat.",
          }),
      );
    return () => {
      off = true;
    };
  }, [id]);

  const toList = () => navigate("/admin/pengajuan?tab=pembatalan");

  const approve = async () => {
    setBusy(true);
    setActionError("");
    try {
      await approveCancellation(id);
      setApproving(false);
      setDone({
        title: "Pembatalan disetujui",
        text: "Turnamen dibatalkan dan seluruh peserta akan diberi tahu.",
      });
    } catch (err) {
      setActionError(err.message || "Pembatalan gagal disetujui.");
    } finally {
      setBusy(false);
    }
  };

  const reject = async ({ reason, otherText }) => {
    await rejectCancellation(id, { reason, otherText }); // error ditangani dialog
    setRejecting(false);
    setDone({
      title: "Pengajuan ditolak",
      text: "Catatan admin sudah dikirim ke penyelenggara.",
    });
  };

  const back = (
    <button
      type="button"
      className="cancel-back admin"
      style={BACK_STYLE}
      onClick={toList}
    >
      <CancellationIcon name="chevron-left" size={26} /> Kembali
    </button>
  );

  const { data, error } = state;
  if (error) {
    return (
      <div className="cancel-page admin" style={PAGE_STYLE}>
        {back}
        <p className="admin-message error">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="cancel-page admin" style={PAGE_STYLE}>
        {back}
        <div className="cancel-skel w40" />
        <div className="cancel-skel block" />
      </div>
    );
  }

  const result = RESULT_BANNER[data.status];
  const isOnline = data.tournament.type === "online";

  return (
    <div className="cancel-page admin" style={PAGE_STYLE}>
      {back}
      <h1 className="cancel-admin-title" style={TITLE_STYLE}>
        Detail Pembatalan Turnamen
      </h1>

      <section className="cancel-card">
        <div
          className="cancel-tour-head"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 16,
            paddingBottom: 16,
            borderBottom: "1px solid #1f2a44",
          }}
        >
          <h2 style={{ margin: 0, padding: 0, border: "none" }}>
            {data.tournament.name}
          </h2>
          {/* Membuka halaman detail pengajuan pembuatan (arsip). Pengajuan itu sudah Disetujui,
              jadi statusnya tidak berubah dan tombol keputusan di sana nonaktif.
              KTP penyelenggara dilihat dari halaman itu. */}
          <button
            type="button"
            className="cancel-btn ghost"
            style={{ flexShrink: 0, borderColor: "#3a4558" }}
            disabled={!data.submissionId}
            onClick={() =>
              navigate(`/admin/pengajuan/${data.submissionId}`, {
                state: { from: `/admin/pengajuan/pembatalan/${id}` },
              })
            }
          >
            Lihat Detail Pengajuan
          </button>
        </div>
        <div className="cancel-tiles">
          <div>
            <small>PENYELENGGARA</small>
            <b>{data.tournament.organizer}</b>
          </div>
          <div>
            <small>TIPE TURNAMEN</small>
            <b>
              {data.tournament.type && (
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    marginRight: 8,
                    borderRadius: "50%",
                    background: isOnline ? "#3b82f6" : "#f59e0b",
                  }}
                />
              )}
              {TYPE_LABEL[data.tournament.type] ?? "-"}
            </b>
          </div>
          <div>
            <small>JENIS TURNAMEN</small>
            <b>{FEE_LABEL[data.tournament.feeType] ?? "-"}</b>
          </div>
        </div>
      </section>

      {result && (
        <div className={`cancel-banner ${result.tone}`}>
          <CancellationIcon name={result.icon} size={20} />
          <div>
            <b>{result.title}</b>
            <small>
              Diputuskan {formatShortDate(data.decidedAt)}
              {data.verifiedBy ? ` oleh ${data.verifiedBy}` : ""}
            </small>
          </div>
        </div>
      )}

      <CancellationContent request={data} feeType={data.tournament.feeType} />

      {data.status === "ditolak" && data.adminNote && (
        <section className="cancel-card cancel-note">
          <h2 className="cancel-h2">
            <CancellationIcon name="info" size={16} /> Catatan admin
          </h2>
          <p>{data.adminNote}</p>
        </section>
      )}

      {data.status === "menunggu" && (
        <>
          {!data.canVerify && data.cannotVerifyReason && (
            <p className="cancel-hint">{data.cannotVerifyReason}</p>
          )}
          {actionError && <p className="cancel-err">{actionError}</p>}
          <div className="cancel-actions end">
            <button
              type="button"
              className="cancel-btn danger"
              disabled={!data.canVerify || busy}
              onClick={() => setRejecting(true)}
            >
              Tolak
            </button>
            <button
              type="button"
              className="cancel-btn approve"
              disabled={!data.canVerify || busy}
              onClick={() => setApproving(true)}
            >
              Setujui
            </button>
          </div>
        </>
      )}

      {approving && (
        <div
          className="rp-ov"
          onMouseDown={(e) =>
            e.target === e.currentTarget && !busy && setApproving(false)
          }
        >
          <div
            className="rp-dialog rp-decision"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-approve-title"
          >
            <span className="rp-decision-ic ok">
              <CancellationIcon name="check" size={22} />
            </span>
            <h2 id="cancel-approve-title">
              Setujui pembatalan {data.tournament.name}?
            </h2>
            <p className="rp-decision-text">
              Turnamen akan berstatus dibatalkan dan tidak dapat dikembalikan.
              Seluruh peserta akan menerima pemberitahuan.
            </p>
            {actionError && <p className="rp-err">{actionError}</p>}
            <div className="cancel-confirm-actions">
              <button
                type="button"
                className="cancel-btn dim"
                disabled={busy}
                onClick={() => setApproving(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="cancel-btn approve"
                disabled={busy}
                onClick={approve}
              >
                {busy ? "Memproses..." : "Ya, setujui"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejecting && (
        <RejectCancellationDialog
          onConfirm={reject}
          onClose={() => setRejecting(false)}
        />
      )}

      {done && (
        <ActionDonePopup title={done.title} text={done.text} onClose={toList} />
      )}
    </div>
  );
}

export default AdminCancellationDetail;
