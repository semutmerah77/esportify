import RefundIcon from "./RefundIcon";
import RefundFileRow from "./RefundFileRow";
import {
  REFUND_METHOD_QRIS,
  REFUND_METHOD_TRANSFER,
  formatShortDate,
} from "../../services/refundApi";
import { RefundAvatar } from "./RefundSquadHeader";
import "../../styles/refund.css";

const METHOD_TEXT = {
  [REFUND_METHOD_TRANSFER]: "Transfer bank",
  [REFUND_METHOD_QRIS]: "QRIS",
};

// Kartu "Data pengembalian dana" (peserta, hanya baca): data yang sudah dikirim + status transfer.
// Anggota non-pendaftar tidak menerima atas nama / rekening / QRIS dari BE: bagian itu otomatis hilang.
function RefundDataCard({ refund, organizer, organizerAvatar, plannedDate }) {
  const hasData = Boolean(refund.method && refund.holderName);
  const done = refund.status === "selesai";

  return (
    <section className="refund-card refund-data">
      <h2>Data pengembalian dana</h2>
      <p className="refund-sub">
        Informasi rekening atau barcode tujuan pengembalian dana pendaftaran
        turnamen.
      </p>

      {hasData && (
        <>
          <div className="refund-pair">
            <div>
              <label>Metode Pengembalian</label>
              <div className="refund-box">
                <RefundIcon
                  name={refund.method === REFUND_METHOD_QRIS ? "qr" : "bank"}
                  size={16}
                />
                {METHOD_TEXT[refund.method] ?? refund.methodLabel}
              </div>
            </div>
            <div>
              <label>Atas Nama</label>
              <div className="refund-box strong">
                <span className="refund-blue">
                  <RefundIcon name="user" size={15} />
                </span>
                {refund.holderName}
              </div>
            </div>
          </div>

          {refund.method === REFUND_METHOD_TRANSFER && (
            <>
              <label>Nama bank dan Nomor Rekening</label>
              <div className="refund-box center">{refund.accountNumber}</div>
            </>
          )}

          {refund.method === REFUND_METHOD_QRIS && refund.qrisUrl && (
            <>
              <label>Gambar QRIS Terunggah</label>
              <RefundFileRow
                label="Gambar QRIS"
                url={refund.qrisUrl}
                kind="gambar"
              />
            </>
          )}
        </>
      )}

      {done && refund.proofUrl && (
        <>
          <label>Bukti Pengembalian Dana</label>
          <RefundFileRow
            label="Bukti transfer pengembalian dana"
            url={refund.proofUrl}
            kind={refund.proofKind === "pdf" ? "pdf" : "gambar"}
          />
        </>
      )}

      {!done && (
        <div className="refund-banner">
          <span className="refund-banner-ic">
            <RefundIcon name="clock" size={16} />
          </span>
          <p>
            Data sudah terkirim. Menunggu penyelenggara melakukan transfer.
            {plannedDate && (
              <>
                {" "}
                Estimasi pengembalian dana:{" "}
                <b>{formatShortDate(plannedDate)}</b>.
              </>
            )}
          </p>
        </div>
      )}

      {done && (
        <div className="refund-banner warn">
          <span className="refund-banner-ic">
            <RefundIcon name="info" size={16} />
          </span>
          <p>
            Catatan: sistem tidak dapat memastikan apakah dana sudah benar-benar
            masuk ke rekening kamu. Jika dana belum masuk, silakan hubungi
            penyelenggara terkait pengembalian dana ini.
          </p>
        </div>
      )}

      {organizer && (
        <footer className="refund-organizer">
          <small>PENYELENGGARA</small>
          <RefundAvatar
            name={organizer}
            src={organizerAvatar}
            size={44}
            color="#1f2a44"
          />
          <em>{/\s/.test(organizer) ? organizer : `@${organizer}`}</em>
        </footer>
      )}
    </section>
  );
}

export default RefundDataCard;
