import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/icon";
import BracketPanel from "../../components/kelola/BracketPanel";
import { RegistrantRow } from "../../components/kelola/KlParts";
import ParticipantDetailModal from "../../components/kelola/ParticipantDetailModal";
import ParticipantsPanel from "../../components/kelola/ParticipantsPanel";
import ReviewDrawer from "../../components/kelola/ReviewDrawer";
import AnnouncementPanel from "../../components/kelola/AnnouncementPanel";
import OrganizerRefundPanel from "../../components/refund/OrganizerRefundPanel";
import { longDate } from "../../utils/date";
import {
  getManageHeader,
  getParticipantDetail,
  getParticipants,
  getRegistrations,
} from "../../services/tournamentManageApi";
import "../../styles/kelola.css";
import CancellationIcon from "../../components/kelola/CancellationIcon";
import "../../styles/tournament-cancellation.css";

const STATUS_LABEL = {
  pendaftaran: "Pendaftaran",
  ditutup: "Pendaftaran ditutup",
  tertunda: "Tertunda",
  berlangsung: "Berlangsung",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

function KelolaTurnamen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [head, setHead] = useState(null);
  const [headError, setHeadError] = useState("");
  const [tab, setTab] = useState("");

  const [reg, setReg] = useState({
    items: [],
    waiting: 0,
    ready: false,
    error: "",
  });
  const [part, setPart] = useState({
    items: [],
    ready: false,
    error: "",
  });
  // Detail peserta: { item, data, loading, error }
  const [detailOf, setDetailOf] = useState(null);

  const [reviewing, setReviewing] = useState(null);
  const [toast, setToast] = useState("");

  const paid = head?.feeType === "berbayar";
  const cancelled = head?.status === "dibatalkan";

  const loadHead = useCallback(() => getManageHeader(id).then(setHead), [id]);

  const loadRegs = useCallback(
    () =>
      getRegistrations(id, { status: "menunggu" })
        .then((res) =>
          setReg({
            items: res.items,
            waiting: res.meta.waiting,
            ready: true,
            error: "",
          }),
        )
        .catch((err) =>
          setReg((r) => ({
            ...r,
            ready: true,
            error: err.message || "Gagal memuat pendaftar.",
          })),
        ),
    [id],
  );

  const loadPart = useCallback(
    () =>
      getParticipants(id)
        .then((res) =>
          // Nickname & ID in-game sudah ada di list peserta
          setPart({ items: res.items, ready: true, error: "" }),
        )
        .catch((err) =>
          setPart((p) => ({
            ...p,
            ready: true,
            error: err.message || "Gagal memuat peserta.",
          })),
        ),
    [id],
  );

  // Header dan peserta dimuat paralel (peserta tidak bergantung pada header).
  // Hasil lama tidak menimpa state kalau id berganti atau halaman ditutup.
  useEffect(() => {
    let off = false;
    setHead(null);
    setHeadError("");
    setPart({ items: [], ready: false, error: "" });

    getManageHeader(id)
      .then((h) => {
        if (off) return;
        setHead(h);
        setTab(
          h.status !== "dibatalkan" && h.feeType === "berbayar"
            ? "verifikasi"
            : "peserta",
        );
      })
      .catch(
        (err) => !off && setHeadError(err.message || "Gagal memuat turnamen."),
      );

    getParticipants(id)
      .then(
        (res) => !off && setPart({ items: res.items, ready: true, error: "" }),
      )
      .catch(
        (err) =>
          !off &&
          setPart((p) => ({
            ...p,
            ready: true,
            error: err.message || "Gagal memuat peserta.",
          })),
      );

    return () => {
      off = true;
    };
  }, [id]);

  // Pendaftar hanya dimuat setelah header, karena hanya turnamen berbayar yang punya tab verifikasi
  useEffect(() => {
    if (head && paid && !cancelled) loadRegs();
  }, [head?.id, paid]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = (
    <button
      type="button"
      className="kl-back"
      onClick={() => navigate("/turnamen/kelola")}
    >
      <Icon name="chevron-left" size={26} /> Kembali
    </button>
  );

  if (headError) {
    return (
      <div className="kl-page">
        {back}
        <p className="admin-message error">{headError}</p>
      </div>
    );
  }
  if (!head) return <div className="kl-page">{back}</div>;

  // Indikator tampilan dari BE (bukan nilai status): Tertunda menggantikan Berlangsung
  const statusKey = cancelled
    ? "dibatalkan"
    : head.delayed
      ? "tertunda"
      : head.status === "pendaftaran" && head.closed
        ? "ditutup"
        : head.status;

  const percent = head.slot
    ? Math.min(100, Math.round(((head.filled ?? 0) / head.slot) * 100))
    : 0;
  const place =
    head.type === "online"
      ? "Online"
      : [head.city, head.province].filter(Boolean).join(", ") || "-";

  const tabs = [
    ...(paid
      ? [
          {
            key: "verifikasi",
            label: "Verifikasi Pendaftar",
            badge: reg.waiting,
          },
        ]
      : []),
    { key: "peserta", label: "Peserta" },
    ...(cancelled && paid
      ? [{ key: "refund", label: "Pengembalian Dana" }]
      : []),
    { key: "bracket", label: "Bracket" },
    { key: "pengumuman", label: "Pengumuman" },
  ];

  // Buka detail peserta: daftar anggota (roster) diambil dari endpoint detail
  const openDetail = (item) => {
    setDetailOf({ item, data: null, loading: true, error: "" });
    getParticipantDetail(id, item.id)
      .then((data) =>
        setDetailOf((d) =>
          d?.item.id === item.id ? { ...d, data, loading: false } : d,
        ),
      )
      .catch((err) =>
        setDetailOf((d) =>
          d?.item.id === item.id
            ? {
                ...d,
                loading: false,
                error: err.message || "Detail peserta tidak dapat dimuat.",
              }
            : d,
        ),
      );
  };

  // Setelah Terima / Tolak: segarkan daftar, peserta, dan slot di header
  const afterVerify = async (message) => {
    setReviewing(null);
    setToast(message);
    await Promise.allSettled([loadRegs(), loadPart(), loadHead()]);
  };

  return (
    <div className="kl-page">
      {back}
      <h1 className="admin-title kl-title">Kelola Turnamen</h1>

      <section className="kl-head">
        <div className="kl-head-top">
          <div>
            <h2>{head.name}</h2>
            <p>{head.game}</p>
          </div>
          <span className={`kl-pill ${statusKey}`}>
            <i></i> {STATUS_LABEL[statusKey] ?? statusKey}
          </span>
        </div>

        <div className="kl-head-meta">
          <span>
            <Icon name="calendar" size={14} /> Pendaftaran tutup:{" "}
            {longDate(head.closeDate)}
          </span>
          <span>
            <Icon name="calendar" size={14} /> Jadwal main:{" "}
            {longDate(head.matchDate)}
          </span>
          <span>{place}</span>
          <span className="kl-slot">
            <Icon name="users" size={15} />
            <span>
              {head.filled ?? "-"}/{head.slot ?? "-"} tim
              <i className="kl-bar">
                <b style={{ width: `${percent}%` }} />
              </i>
            </span>
          </span>
          <div className="kl-head-actions">
            <Link to={`/turnamen/detail/${head.id}`} className="kl-detail-btn">
              Detail
            </Link>
          </div>
        </div>
      </section>

      {cancelled && (
        <div className="cancel-banner danger">
          <CancellationIcon name="stamp" size={20} />
          <div>
            <b>Turnamen dibatalkan</b>
            <small>
              Pembatalan sudah disetujui admin. Kelola bracket, skor, laporan,
              dan pengumuman tidak tersedia lagi.
            </small>
          </div>
        </div>
      )}

      <nav className="kl-tabs" role="tablist">
        {(cancelled
          ? tabs.filter(
              (t) => t.key === "peserta" || (paid && t.key === "refund"),
            )
          : tabs
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`kl-tab ${tab === t.key ? "on" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.badge > 0 && <span className="kl-badge">{t.badge}</span>}
          </button>
        ))}
      </nav>

      <section className="kl-panel">
        {tab === "verifikasi" && (
          <>
            <div className="kl-panel-head">
              {reg.waiting} pendaftar menunggu verifikasi
            </div>
            {reg.error && <p className="admin-message error">{reg.error}</p>}
            {reg.ready && !reg.error && reg.items.length === 0 && (
              <p className="kl-empty">
                Belum ada pendaftar yang menunggu verifikasi.
              </p>
            )}
            <ul className="kl-list">
              {reg.items.map((item) => (
                <RegistrantRow
                  key={item.id}
                  item={item}
                  onReview={setReviewing}
                />
              ))}
            </ul>
          </>
        )}

        {tab === "peserta" && (
          <ParticipantsPanel
            items={part.items}
            ready={part.ready}
            error={part.error}
            emptyText={
              paid
                ? "Squad yang diterima di tab Verifikasi Pendaftar akan muncul di sini."
                : "Squad yang mendaftar akan muncul di sini."
            }
            onDetail={openDetail}
          />
        )}

        {tab === "refund" && <OrganizerRefundPanel id={id} />}

        {tab === "bracket" && <BracketPanel id={id} onChanged={loadHead} />}

        {tab === "pengumuman" && <AnnouncementPanel id={id} />}
      </section>

      {detailOf && (
        <ParticipantDetailModal
          item={detailOf.item}
          detail={detailOf.data}
          loading={detailOf.loading}
          error={detailOf.error}
          onClose={() => setDetailOf(null)}
        />
      )}

      {reviewing && (
        <ReviewDrawer
          tournamentId={id}
          row={reviewing}
          onClose={() => setReviewing(null)}
          onDone={afterVerify}
          onStale={() => {
            loadRegs();
            loadHead();
          }}
        />
      )}

      {toast && (
        <div
          className="kl-ov"
          onMouseDown={(e) => e.target === e.currentTarget && setToast("")}
        >
          <div
            className="kl-dialog kl-success"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kl-success-title"
          >
            <span className="kl-success-ic">
              <Icon name="check" size={26} />
            </span>
            <h2 id="kl-success-title">Berhasil</h2>
            <p>{toast}</p>
            <button
              type="button"
              className="kl-btn accept kl-success-btn"
              onClick={() => setToast("")}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default KelolaTurnamen;
