import { useState } from "react";
import Icon from "../icon";
import FilePreview from "./FilePreview";
import useKtpPreview from "../../hooks/useKtpPreview";
import { longDate, rupiah } from "../../utils/date";

const METHOD_LABEL = {
  qris: "QRIS",
  transfer: "Transfer Bank",
  qris_transfer: "QRIS dan Transfer Bank",
};
const FUNDING_LABEL = {
  sponsor: "Sponsor",
  dana_pribadi: "Dana Pribadi",
  biaya_peserta: "Biaya Pendaftaran Peserta",
};

function Field({ label, children }) {
  return (
    <section className="d-card">
      <p className="d-label">{label}</p>
      <div className="d-value">{children || "-"}</div>
    </section>
  );
}

// Baris file: tombol Lihat membuka popup di halaman yang sama
function ViewRow({ name, disabled, loading, note, onView }) {
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
          onClick={onView}
        >
          {loading ? "Memuat..." : "Lihat"}
        </button>
      </div>
    </div>
  );
}

// Tampilan baca isi pengajuan. d = hasil getSubmissionDetail.
function SubmissionView({ d }) {
  const ktp = useKtpPreview(d.id); // role default: player
  const [qrisPreview, setQrisPreview] = useState(null);

  return (
    <>
      <section className="d-card d-center">
        <p className="d-label">Poster Turnamen</p>
        {d.posterUrl ? (
          <img
            className="d-poster"
            src={d.posterUrl}
            alt={`Poster ${d.name}`}
          />
        ) : (
          <p className="admin-message">Poster tidak tersedia.</p>
        )}
      </section>

      <Field label="Nama Turnamen">{d.name}</Field>
      <Field label="Nama Lengkap">{d.organizer}</Field>
      <Field label="Game">{d.gameName}</Field>
      <Field label="Tipe">{d.type === "offline" ? "Offline" : "Online"}</Field>

      {d.type === "offline" && (
        <section className="d-card">
          <p className="d-label">Lokasi</p>
          <p className="d-row">
            <span>Provinsi</span> <b>{d.provinceName || "-"}</b>
          </p>
          <p className="d-row">
            <span>Kota</span> <b>{d.cityName || "-"}</b>
          </p>
          <div className="d-value">{d.address || "-"}</div>
        </section>
      )}

      <Field label="Slot">{d.slot}</Field>

      <section className="d-card">
        <p className="d-label">Pendaftaran</p>
        <div className="d-value">{longDate(d.closeDate)}</div>
        <p className="d-label">Hari Pertandingan</p>
        <div className="d-value">{longDate(d.matchDate)}</div>
      </section>

      <Field label="Deskripsi">{d.description}</Field>
      <Field label="Total Hadiah">{rupiah(d.prize)}</Field>

      <section className="d-card">
        <p className="d-label">Sumber Pendanaan</p>
        <div className="d-value">
          {d.funding.map((k) => FUNDING_LABEL[k]).join(", ") || "-"}
        </div>
        {d.funding.includes("sponsor") &&
          (d.sponsors.length > 0 ? (
            d.sponsors.map((s, i) => (
              <div key={i} className="d-sponsor">
                <p className="d-sponsor-title">Sponsor {i + 1}</p>
                <p className="d-label">Nama Sponsor</p>
                <div className="d-value">{s.nama_sponsor || "-"}</div>
                <p className="d-label">Contact Person Sponsor</p>
                <div className="d-value">{s.kontak_sponsor || "-"}</div>
              </div>
            ))
          ) : (
            <div className="d-value">-</div>
          ))}
      </section>

      <Field label="Rincian Pendanaan">{d.fundingDetail}</Field>

      <section className="d-card">
        <p className="d-label">Biaya Pendaftaran</p>
        <div className="d-value">
          {d.feeType === "berbayar" ? "Berbayar" : "Gratis"}
        </div>
        {d.feeType === "berbayar" && (
          <>
            <p className="d-label">Nominal Pendaftaran</p>
            <div className="d-value">{rupiah(d.fee)}</div>
            <p className="d-label">Metode Pembayaran</p>
            <div className="d-value">
              {METHOD_LABEL[d.paymentMethod] ?? "-"}
            </div>
            {["qris", "qris_transfer"].includes(d.paymentMethod) && (
              <ViewRow
                name={d.qrisName || "QRIS"}
                disabled={!d.qrisUrl}
                note="File QRIS tidak tersedia"
                onView={() =>
                  setQrisPreview({ url: d.qrisUrl, name: d.qrisName || "QRIS" })
                }
              />
            )}
            {["transfer", "qris_transfer"].includes(d.paymentMethod) && (
              <>
                <p className="d-label">Nomor Rekening</p>
                <div className="d-value">{d.account || "-"}</div>
              </>
            )}
          </>
        )}
      </section>

      <section className="d-card">
        <p className="d-label">KTP</p>
        <ViewRow name="KTP" loading={ktp.loading} onView={ktp.open} />
        {ktp.error && <p className="admin-message error">{ktp.error}</p>}
      </section>

      {ktp.preview && <FilePreview file={ktp.preview} onClose={ktp.close} />}
      {qrisPreview && (
        <FilePreview file={qrisPreview} onClose={() => setQrisPreview(null)} />
      )}
    </>
  );
}

export default SubmissionView;
