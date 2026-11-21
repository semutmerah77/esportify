import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/icon";
import TournamentForm from "../../components/tournament/TournamentForm";
import SubmissionView from "../../components/tournament/SubmissionView";
import {
  getSubmissionDetail,
  detailToForm,
  startEdit,
  cancelEdit,
  updateSubmission,
} from "../../services/tournamentApi";
import SuccessDialog from "../../components/tournament/SuccessDialog";
import { longDate, parseDeadline } from "../../utils/date";

// Label khusus halaman ini. Nilai asli backend tidak diubah.
const STATUS_LABEL = {
  "menunggu verifikasi": "Menunggu Verifikasi Admin",
  "sedang diedit": "Sedang Diedit",
  "sedang ditinjau": "Sedang Ditinjau",
  revisi: "Revisi",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
};

const pad = (n) => String(n).padStart(2, "0");

// Sisa waktu: "2 hari 03:15:09" atau "04:59" kalau kurang dari 1 jam
const formatSisa = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hari = Math.floor(total / 86400);
  const jam = Math.floor((total % 86400) / 3600);
  const menit = Math.floor((total % 3600) / 60);
  const detik = total % 60;
  if (hari > 0) return `${hari} hari ${pad(jam)}:${pad(menit)}:${pad(detik)}`;
  if (jam > 0) return `${pad(jam)}:${pad(menit)}:${pad(detik)}`;
  return `${pad(menit)}:${pad(detik)}`;
};

// Hitung mundur. onExpire dipanggil sekali saat waktu habis.
function Countdown({ deadline, label, onExpire }) {
  const target = parseDeadline(deadline);
  const [now, setNow] = useState(Date.now());
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    expiredRef.current = false;
    if (target == null) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);

  const left = target == null ? null : target - now;

  useEffect(() => {
    if (left != null && left <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpireRef.current?.();
    }
  }, [left]);

  if (target == null) return null;
  return (
    <>
      <p className="d-label">{label}</p>
      <div className={`d-box ${left <= 0 ? "expired" : ""}`}>
        {left > 0
          ? `Sisa waktu ${formatSisa(left)}`
          : "Batas waktu sudah habis."}
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
  const [starting, setStarting] = useState(false);
  const [success, setSuccess] = useState(null); // { title, text }

  // true selama Player berada di mode edit. Dipakai saat keluar halaman.
  const editingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const detail = await getSubmissionDetail(id);
      setD(detail);
      setError("");
      return detail;
    } catch (err) {
      setError(err.status === 404 ? "Pengajuan tidak ditemukan." : err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Keluar halaman saat masih edit (tutup tab, refresh, atau pindah halaman di aplikasi):
  // lepas status "Sedang diedit" supaya Admin tidak tertahan.
  useEffect(() => {
    const release = () => {
      if (!editingRef.current) return;
      editingRef.current = false;
      cancelEdit(id, { keepalive: true }).catch(() => {});
    };
    window.addEventListener("pagehide", release);
    return () => {
      window.removeEventListener("pagehide", release);
      release(); // komponen ditutup (pindah halaman)
    };
  }, [id]);

  const initialValues = useMemo(() => (d ? detailToForm(d) : null), [d]);
  const key = String(d?.status ?? "")
    .trim()
    .toLowerCase();
  const isRevision = Boolean(d?.isRevision);
  const showReason =
    key === "revisi" ||
    key === "ditolak" ||
    (key === "sedang diedit" && isRevision);
  const showButton = Boolean(d?.canEdit || d?.canRevise);
  const deadlineLabel = isRevision ? "Batas waktu revisi" : "Batas waktu edit";

  const handleStart = async () => {
    setStarting(true);
    setMessage({ text: "", type: "" });
    try {
      await startEdit(id);
      editingRef.current = true;
      await load(); // status sekarang "Sedang diedit"
      setMode("edit");
      window.scrollTo(0, 0);
    } catch (err) {
      setMessage({ text: err.message || "Gagal memulai edit.", type: "error" });
      await load(); // status bisa berubah (misalnya ditolak otomatis)
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async () => {
    editingRef.current = false;
    try {
      await cancelEdit(id);
    } catch {
      // Abaikan: backend tetap melepas status saat batas waktu habis
    }
    setMode("view");
    setMessage({ text: "", type: "" });
    await load();
  };

  const handleBack = async () => {
    if (editingRef.current) {
      editingRef.current = false;
      try {
        await cancelEdit(id);
      } catch {
        // Abaikan, tetap kembali ke daftar
      }
    }
    navigate("/turnamen/status-pengajuan");
  };

  // Waktu habis saat form edit masih terbuka
  const handleEditExpired = async () => {
    editingRef.current = false;
    try {
      await cancelEdit(id);
    } catch {
      // Abaikan
    }
    setMode("view");
    const fresh = await load();
    const ditolak =
      String(fresh?.status ?? "")
        .trim()
        .toLowerCase() === "ditolak";
    setMessage({
      text: ditolak
        ? "Batas waktu revisi habis. Pengajuan ditolak otomatis."
        : "Batas waktu edit habis. Perubahan yang belum disimpan tidak tersimpan.",
      type: "error",
    });
    window.scrollTo(0, 0);
  };

  const handleSave = async (values) => {
    const wasRevision = isRevision; // simpan sebelum data dimuat ulang
    try {
      await updateSubmission(id, values, initialValues, d.fundingIds);
    } catch (err) {
      // Kalau gagal karena batas waktu, status sudah diubah backend: keluar dari mode edit
      const fresh = await load();
      const masihEdit =
        String(fresh?.status ?? "")
          .trim()
          .toLowerCase() === "sedang diedit";
      if (fresh && !masihEdit) {
        editingRef.current = false;
        setMode("view");
        setMessage({ text: err.message, type: "error" });
        window.scrollTo(0, 0);
        return;
      }
      throw err; // error validasi biasa: tampil di form
    }

    editingRef.current = false;
    await load();
    setMode("view");
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
    <button type="button" className="d-back" onClick={handleBack}>
      <Icon name="chevron-left" size={26} /> Kembali
    </button>
  );

  if (loading) return <div className="d-page" />;
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
        {d.resubmittedAt && (
          <>
            <p className="d-label">Tanggal Diajukan Ulang</p>
            <div className="d-box">{longDate(d.resubmittedAt)}</div>
          </>
        )}

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

        {mode === "edit" && d.deadline && (
          <Countdown
            deadline={d.deadline}
            label={deadlineLabel}
            onExpire={handleEditExpired}
          />
        )}
        {mode === "view" && showButton && d.deadline && (
          <Countdown
            deadline={d.deadline}
            label={deadlineLabel}
            onExpire={load}
          />
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

        {showButton && (
          <div className="t-edit-row">
            <button
              type="button"
              className={`t-edit-btn ${d.canRevise ? "revision" : ""}`}
              onClick={handleStart}
              disabled={starting}
            >
              <Icon name="edit" size={16} />
              {starting ? " Memproses..." : d.canRevise ? " Revisi" : " Edit"}
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
