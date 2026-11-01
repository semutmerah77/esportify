import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/icon";
import DecisionModal from "../../components/admin/DecisionModal";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import {
  getAdminSubmissionDetail,
  approveSubmission,
  rejectSubmission,
  requestRevision,
  releaseSubmission,
} from "../../services/adminApi";
import "../../styles/user.css";
import useKtpPreview from "../../hooks/useKtpPreview";

const REVISION_OPTIONS = [
  "Informasi turnamen belum lengkap",
  "Informasi sponsor belum lengkap",
  "File KTP bermasalah",
  "Lainnya",
];
const REJECT_OPTIONS = [
  "Informasi turnamen tidak valid",
  "Ditemukan informasi atau dokumen palsu",
  "Pengajuan melanggar ketentuan platform",
  "Lainnya",
];
const STATUS_LABEL = {
  revisi: "Perlu Revisi",
  "sedang diedit": "Sedang Diedit",
  "sedang ditinjau": "Sedang Ditinjau",
};
const METHOD_LABEL = {
  qris: "QRIS",
  transfer: "Transfer Bank",
  qris_transfer: "QRIS dan Transfer Bank",
};

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const longDate = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ""));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : v || "-";
};
const rupiah = (v) =>
  v === null || v === undefined || v === ""
    ? "-"
    : `Rp. ${Number(v).toLocaleString("id-ID")}`;

const errorText = (err) => {
  if (err.status === 403)
    return err.message || "Kamu tidak punya izin untuk pengajuan ini.";
  return err.message;
};

function Field({ label, children }) {
  return (
    <section className="d-card">
      <p className="d-label">{label}</p>
      <div className="d-value">{children ?? "-"}</div>
    </section>
  );
}

// Baris file. disabled = file tidak bisa dilihat. onOpen dipanggil saat tombol Lihat ditekan.
function FileRow({ name, note, onOpen, disabled, loading }) {
  return (
    <div className="t-file-row">
      <span className="t-file-icon">
        <Icon name="file-image" size={26} />
      </span>
      <span className="t-file-name" title={name}>
        {name || "-"}
      </span>
      <div className="t-file-actions">
        <button
          type="button"
          className="t-pill"
          disabled={disabled || loading}
          title={disabled ? note : "Lihat file"}
          onClick={onOpen}
        >
          {loading ? "Memuat..." : "Lihat"}
        </button>
      </div>
    </div>
  );
}

const isPdf = (file) => /\.pdf($|\?)/i.test(file.name || file.url || "");

// Modal pratinjau sederhana. file: { url, name }. url bisa blob: (KTP privat) atau URL biasa.
const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 300,
  display: "grid",
  placeItems: "center",
  padding: 16,
  background: "rgba(5, 8, 14, 0.8)",
};
const boxStyle = {
  display: "flex",
  flexDirection: "column",
  width: "min(900px, 100%)",
  maxHeight: "90vh",
  padding: 16,
  border: "1px solid #243049",
  borderRadius: 12,
  background: "#121826",
  color: "#f1f5f9",
};
const barStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
};
const closeBtnStyle = {
  height: 34,
  padding: "0 14px",
  border: "1px solid #243049",
  borderRadius: 8,
  background: "#182033",
  color: "#f1f5f9",
  cursor: "pointer",
};

function ViewerModal({ file, onClose }) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau ${file.name}`}
      style={overlayStyle}
      onClick={onClose}
    >
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={barStyle}>
          <b>{file.name}</b>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#60a5fa", fontSize: 14 }}
            >
              Buka di tab baru
            </a>
            <button type="button" style={closeBtnStyle} onClick={onClose}>
              Tutup
            </button>
          </div>
        </div>

        {isPdf(file) ? (
          <iframe
            src={file.url}
            title={file.name}
            style={{
              width: "100%",
              height: "70vh",
              border: 0,
              borderRadius: 8,
            }}
          />
        ) : broken ? (
          <p style={{ color: "#94a3b8" }}>
            Pratinjau tidak tersedia. Coba "Buka di tab baru".
          </p>
        ) : (
          <img
            src={file.url}
            alt={file.name}
            onError={() => setBroken(true)}
            style={{
              maxWidth: "100%",
              maxHeight: "75vh",
              objectFit: "contain",
              margin: "0 auto",
              borderRadius: 8,
            }}
          />
        )}
      </div>
    </div>
  );
}

function AdminSubmissionDetail() {
  const { id } = useParams();
  const ktp = useKtpPreview(id, "admin");
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // "revision" | "reject"
  const [approving, setApproving] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [preview, setPreview] = useState(null); // { url, name } untuk file publik (QRIS)

  // Membuka halaman ini memanggil endpoint yang mengubah status menjadi "Sedang ditinjau"
  useEffect(() => {
    getAdminSubmissionDetail(id)
      .then(setData)
      .catch((err) => setError(errorText(err)))
      .finally(() => setLoading(false));
  }, [id]);

  // Dipakai setelah keputusan (setujui/tolak/revisi): TIDAK memanggil release
  const back = () => navigate("/admin/pengajuan");

  // Dipakai tombol Kembali: lepaskan pengajuan kalau masih "Sedang ditinjau"
  const handleBack = async () => {
    if (leaving) return;
    if (!reviewing) {
      back();
      return;
    }
    setLeaving(true);
    setMessage("");
    try {
      await releaseSubmission(id);
      back();
    } catch (err) {
      setMessage(errorText(err) || "Gagal mengembalikan status pengajuan.");
      setLeaving(false);
    }
  };

  const reviewing =
    String(data?.status ?? "").toLowerCase() === "sedang ditinjau";

  const handleApprove = async () => {
    setWorking(true);
    try {
      await approveSubmission(id);
      back();
    } catch (err) {
      setMessage(errorText(err));
      setApproving(false);
    } finally {
      setWorking(false);
    }
  };

  const statusKey = String(data?.status ?? "").toLowerCase();

  // Yang sedang dilihat: KTP (blob dari backend, privat) atau file publik (QRIS)
  const viewing = ktp.preview ?? preview;
  const closeViewer = () => {
    ktp.close();
    setPreview(null);
  };

  return (
    <div className="d-page">
      <button
        type="button"
        className="d-back"
        onClick={handleBack}
        disabled={leaving}
      >
        <Icon name="chevron-left" size={26} />{" "}
        {leaving ? "Mengembalikan..." : "Kembali"}
      </button>
      <h1 className="admin-title">Detail Pengajuan Turnamen</h1>

      {loading && <p className="admin-message">Memuat...</p>}
      {error && <p className="admin-message error">{error}</p>}

      {data && (
        <div className="d-wrap">
          <section className="d-card">
            <p className="d-label">Status Pengajuan saat ini</p>
            <div className="d-box">
              {STATUS_LABEL[statusKey] ?? data.status}
            </div>
            <p className="d-label">Tanggal Diajukan</p>
            <div className="d-box">{longDate(data.createdAt)}</div>
          </section>

          <section className="d-card d-center">
            <p className="d-label">Poster Turnamen</p>
            {data.posterUrl ? (
              <img
                className="d-poster"
                src={data.posterUrl}
                alt={`Poster ${data.name}`}
              />
            ) : (
              <p className="admin-message">Poster tidak tersedia.</p>
            )}
          </section>

          <Field label="Nama Turnamen">{data.name}</Field>
          <Field label="Nama Lengkap">{data.organizer}</Field>
          <Field label="Game">{data.game}</Field>
          <Field label="Tipe">
            {data.type === "offline" ? "Offline" : "Online"}
          </Field>

          {data.type === "offline" && (
            <section className="d-card">
              <p className="d-label">Lokasi</p>
              <p className="d-row">
                <span>Provinsi</span> <b>{data.province || "-"}</b>
              </p>
              <p className="d-row">
                <span>Kota</span> <b>{data.city || "-"}</b>
              </p>
              <div className="d-value">{data.address || "-"}</div>
            </section>
          )}

          <Field label="Slot">{data.slot}</Field>

          <section className="d-card">
            <p className="d-label">Pendaftaran</p>
            <div className="d-value">{longDate(data.closeDate)}</div>
            <p className="d-label">Hari Pertandingan</p>
            <div className="d-value">{longDate(data.matchDate)}</div>
          </section>

          <Field label="Deskripsi">{data.description}</Field>
          <Field label="Total Hadiah">{rupiah(data.prize)}</Field>

          <section className="d-card">
            <p className="d-label">Sumber Pendanaan</p>
            <div className="d-value">
              {data.funding.length ? data.funding.join(", ") : "-"}
            </div>
            {data.sponsors.map((s, i) => (
              <div key={i} className="d-sponsor">
                <p className="d-sponsor-title">Sponsor {i + 1}</p>
                <p className="d-label">Nama Sponsor</p>
                <div className="d-value">{s.name || "-"}</div>
                <p className="d-label">Contact Person Sponsor</p>
                <div className="d-value">{s.contact || "-"}</div>
              </div>
            ))}
          </section>

          <Field label="Rincian Pendanaan">{data.fundingDetail}</Field>

          <section className="d-card">
            <p className="d-label">Biaya Pendaftaran</p>
            <div className="d-value">
              {data.feeType === "berbayar" ? "Berbayar" : "Gratis"}
            </div>

            {data.feeType === "berbayar" && (
              <>
                <p className="d-label">Nominal Pendaftaran</p>
                <div className="d-value">{rupiah(data.fee)}</div>
                <p className="d-label">Metode Pembayaran</p>
                <div className="d-value">
                  {METHOD_LABEL[data.paymentMethod] ??
                    data.paymentMethod ??
                    "-"}
                </div>

                {["qris", "qris_transfer"].includes(data.paymentMethod) && (
                  <FileRow
                    name={data.qrisName}
                    note="File QRIS tidak tersedia"
                    disabled={!data.qrisUrl}
                    onOpen={() =>
                      setPreview({
                        url: data.qrisUrl,
                        name: data.qrisName || "QRIS",
                      })
                    }
                  />
                )}
                {["transfer", "qris_transfer"].includes(data.paymentMethod) && (
                  <>
                    <p className="d-label">Nomor Rekening</p>
                    <div className="d-value">{data.account || "-"}</div>
                  </>
                )}
              </>
            )}
          </section>

          <section className="d-card">
            <p className="d-label">KTP</p>
            {/* KTP privat: diambil lewat endpoint /admin/pengajuan-turnamen/{id}/ktp dengan token */}
            <FileRow
              name={data.ktpName}
              note="File KTP tidak tersedia"
              loading={ktp.loading}
              onOpen={ktp.open}
            />
            {ktp.error && <p className="admin-message error">{ktp.error}</p>}
          </section>

          {message && <p className="admin-message error">{message}</p>}

          <div className="d-actions">
            <button
              className="d-btn reject"
              disabled={!reviewing}
              onClick={() => setModal("reject")}
            >
              Tolak Pengajuan
            </button>
            <button
              className="d-btn revision"
              disabled={!reviewing}
              onClick={() => setModal("revision")}
            >
              Revisi Pengajuan
            </button>
            <button
              className="d-btn approve"
              disabled={!reviewing}
              onClick={() => setApproving(true)}
            >
              Setujui Pengajuan
            </button>
          </div>
          {!reviewing && (
            <p className="admin-message">
              Keputusan hanya bisa diberikan saat status "Sedang Ditinjau".
            </p>
          )}
        </div>
      )}

      {viewing && <ViewerModal file={viewing} onClose={closeViewer} />}

      {modal === "revision" && (
        <DecisionModal
          tone="revision"
          title="Konfirmasi alasan Revisi"
          options={REVISION_OPTIONS}
          confirmLabel="Kirim Revisi"
          onSubmit={async (reason) => {
            await requestRevision(id, reason);
            back();
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "reject" && (
        <DecisionModal
          tone="reject"
          title="Konfirmasi Penolakan"
          options={REJECT_OPTIONS}
          confirmLabel="Konfirmasi Penolakan"
          onSubmit={async (reason) => {
            await rejectSubmission(id, reason);
            back();
          }}
          onClose={() => setModal(null)}
        />
      )}

      {approving && (
        <ConfirmDialog
          tone="success"
          icon="check-circle"
          title="Setujui Pengajuan?"
          confirmLabel="Setujui"
          loading={working}
          onConfirm={handleApprove}
          onClose={() => setApproving(false)}
        >
          <p>Turnamen akan dibuat dari pengajuan ini.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default AdminSubmissionDetail;
