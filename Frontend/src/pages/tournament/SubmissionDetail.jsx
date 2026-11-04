import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/icon";
import TournamentForm from "../../components/tournament/TournamentForm";
import SubmissionView from "../../components/tournament/SubmissionView";
import {
  getSubmissionDetail,
  detailToForm,
  startEdit,
  updateSubmission,
} from "../../services/tournamentApi";
import SuccessDialog from "../../components/tournament/SuccessDialog";
import { clock, longDate, parseDeadline } from "../../utils/date";

// Label khusus halaman ini. Nilai asli backend tidak diubah.
const STATUS_LABEL = {
  "menunggu verifikasi": "Menunggu Verifikasi Admin",
  "sedang diedit": "Sedang Diedit",
  "sedang ditinjau": "Sedang Ditinjau",
  revisi: "Revisi",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
};
// Tombol Edit tampil untuk status ini. Boleh tidaknya tetap diputuskan backend.
const CAN_EDIT = ["menunggu verifikasi", "revisi", "sedang diedit"];

function Countdown({ deadline }) {
  const target = parseDeadline(deadline);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (target == null) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);

  if (target == null) return null;
  const left = target - now;
  return (
    <>
      <p className="d-label">Batas waktu edit</p>
      <div className={`d-box ${left <= 0 ? "expired" : ""}`}>
        {left > 0
          ? `Sisa waktu ${clock(left)}`
          : "Batas waktu edit sudah lewat. Penyimpanan mungkin ditolak."}
      </div>
    </>
  );
}

function SubmissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [mode, setMode] = useState("view"); // "view" | "edit"
  const [editInfo, setEditInfo] = useState(null);
  const [starting, setStarting] = useState(false);
  const [success, setSuccess] = useState(null); // { title, text }

  const load = useCallback(async () => {
    try {
      setD(await getSubmissionDetail(id));
      setError("");
    } catch (err) {
      setError(err.status === 404 ? "Pengajuan tidak ditemukan." : err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const initialValues = useMemo(() => (d ? detailToForm(d) : null), [d]);
  const key = String(d?.status ?? "")
    .trim()
    .toLowerCase();
  const isRevision = key === "revisi" || Boolean(editInfo?.isRevision);
  const showReason =
    key === "revisi" ||
    key === "ditolak" ||
    (key === "sedang diedit" && isRevision);

  const handleStart = async () => {
    setStarting(true);
    setMessage({ text: "", type: "" });
    try {
      setEditInfo(await startEdit(id));
      await load(); // status sekarang "Sedang diedit"
      setMode("edit");
      window.scrollTo(0, 0);
    } catch (err) {
      setMessage({ text: err.message || "Gagal memulai edit.", type: "error" });
    } finally {
      setStarting(false);
    }
  };

  // Belum ada endpoint untuk keluar dari mode edit: status berubah sendiri saat tenggat habis
  const handleCancel = async () => {
    setMode("view");
    setMessage({
      text: "Edit dibatalkan. Pengajuan tetap berstatus Sedang Diedit sampai batas waktu habis.",
      type: "",
    });
    await load();
  };

  const handleSave = async (values) => {
    const wasRevision = isRevision; // simpan sebelum state direset
    await updateSubmission(id, values, initialValues, d.fundingIds);
    await load();
    setMode("view");
    setEditInfo(null);
    setMessage({ text: "", type: "" });
    setSuccess(
      wasRevision
        ? {
            title: "Revisi Berhasil Diajukan",
            text: "Revisi kamu sudah dikirim ulang dan kembali menunggu verifikasi admin.",
          }
        : {
            title: "Pengajuan Berhasil Diperbarui",
            text: "Perubahan tersimpan dan pengajuan kembali menunggu verifikasi admin.",
          },
    );
    window.scrollTo(0, 0);
  };

  const back = (
    <button
      type="button"
      className="d-back"
      onClick={() => navigate("/turnamen/status-pengajuan")}
    >
      <Icon name="chevron-left" size={26} /> Kembali
    </button>
  );

  if (loading)
    return (
      <div className="d-page">
        <p className="admin-message">Memuat...</p>
      </div>
    );
  if (error) {
    return (
      <div className="d-page">
        {back}
        <p className="admin-message error">{error}</p>
      </div>
    );
  }

  const header = (
    <>
      <section className="d-card">
        <p className="d-label">Status Pengajuan</p>
        <div className="d-box">{STATUS_LABEL[key] ?? d.status}</div>
        <p className="d-label">Tanggal Diajukan</p>
        <div className="d-box">{longDate(d.createdAt)}</div>

        {showReason && d.reason && (
          <>
            <p className="d-label">Alasan</p>
            <div className="d-box">{d.reason}</div>
          </>
        )}
        {(showReason || key === "menunggu verifikasi") && (
          <>
            <p className="d-label">Catatan Admin</p>
            <div className="d-box note">{showReason ? d.note : ""}</div>
          </>
        )}
        {mode === "edit" && editInfo?.deadline && (
          <Countdown deadline={editInfo.deadline} />
        )}
      </section>

      {message.text && (
        <p className={`admin-message ${message.type}`}>{message.text}</p>
      )}
    </>
  );

  if (mode === "edit") {
    return (
      <div className="d-page">
        <div className="d-head">
          {back}
          <h1 className="admin-title">Detail Pengajuan Turnamen</h1>
        </div>
        <TournamentForm
          key={`${d.id}-${d.status}`}
          mode="edit"
          initial={initialValues}
          existing={{
            id: d.id,
            posterUrl: d.posterUrl,
            qrisName: d.qrisName,
            qrisUrl: d.qrisUrl,
          }}
          submitLabel={isRevision ? "Ajukan Ulang" : "Simpan"}
          onSubmit={handleSave}
          header={
            <>
              {header}
              <div className="t-edit-row">
                <button
                  type="button"
                  className="t-cancel"
                  onClick={handleCancel}
                >
                  <Icon name="undo" size={16} /> Cancel
                </button>
              </div>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="d-page">
      <div className="d-head">
        {back}
        <h1 className="admin-title">Detail Pengajuan Turnamen</h1>
      </div>
      <div className="t-form d-stack">
        {header}

        {CAN_EDIT.includes(key) && (
          <div className="t-edit-row">
            <button
              type="button"
              className={`t-edit-btn ${key === "revisi" ? "revision" : ""}`}
              onClick={handleStart}
              disabled={starting}
            >
              <Icon name="edit" size={16} />
              {starting
                ? " Memproses..."
                : key === "revisi"
                  ? " Revisi"
                  : key === "sedang diedit"
                    ? " Lanjutkan edit"
                    : " Edit"}
            </button>
          </div>
        )}

        <SubmissionView d={d} />
      </div>

      {success && (
        <SuccessDialog
          title={success.title}
          text={success.text}
          onClose={() => setSuccess(null)}
        />
      )}
    </div>
  );
}

export default SubmissionDetail;
