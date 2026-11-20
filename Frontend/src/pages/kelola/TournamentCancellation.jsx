import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CancellationIcon from "../../components/kelola/CancellationIcon";
import CancellationForm from "../../components/kelola/CancellationForm";
import CancellationRequestView, {
  CancellationStatusPill,
} from "../../components/kelola/CancellationRequestView";
import ActionDonePopup from "../../components/kelola/ActionDonePopup";
import {
  formatShortDate,
  getTournamentCancellation,
} from "../../services/tournamentCancellationApi";
import "../../styles/tournament-cancellation.css";

function PageSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="cancel-skel w40" />
      <div className="cancel-skel w25" />
      <div className="cancel-skel block" />
    </div>
  );
}

// Halaman pembatalan turnamen milik penyelenggara: /turnamen/:id/pembatalan
// - belum ada pengajuan  -> form (kalau bisa_ajukan)
// - ada pengajuan        -> status + isi pengajuan (menunggu / ditolak / disetujui)
function TournamentCancellation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ data: null, error: "" });
  const [showForm, setShowForm] = useState(false);
  const [done, setDone] = useState(false);

  // Dimuat sekali saat halaman dibuka; tanpa polling.
  useEffect(() => {
    let off = false;
    setState({ data: null, error: "" });
    setShowForm(false);
    getTournamentCancellation(id)
      .then((data) => !off && setState({ data, error: "" }))
      .catch(
        (err) =>
          !off &&
          setState({
            data: null,
            error: err.message || "Data pembatalan tidak dapat dimuat.",
          }),
      );
    return () => {
      off = true;
    };
  }, [id]);

  // Muat ulang setelah submit
  const reload = useCallback(
    () =>
      getTournamentCancellation(id)
        .then((data) => setState({ data, error: "" }))
        .catch(() => {}),
    [id],
  );

  const handleSubmitted = async () => {
    setShowForm(false);
    setDone(true);
    await reload();
  };

  const back = (
    <button
      type="button"
      className="cancel-back"
      onClick={() => navigate("/turnamen/kelola")}
    >
      <CancellationIcon name="chevron-left" size={26} /> Kembali
    </button>
  );

  const { data, error } = state;
  if (error) {
    return (
      <div className="cancel-page">
        {back}
        <p className="admin-message error">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="cancel-page">
        {back}
        <PageSkeleton />
      </div>
    );
  }

  const latest = data.pending ?? data.history[0] ?? null;
  const older = data.pending ? data.history : data.history.slice(1);
  const formVisible = (showForm || !latest) && data.canSubmit;

  return (
    <div className="cancel-page">
      {back}

      <header className="cancel-head">
        <div>
          <h1>Ajukan pembatalan</h1>
          <p>{data.tournament.name}</p>
        </div>
        {!formVisible && latest && (
          <CancellationStatusPill status={latest.status} />
        )}
      </header>

      {formVisible && (
        <CancellationForm
          tournamentId={id}
          tournamentName={data.tournament.name}
          info={data}
          onCancel={() =>
            latest ? setShowForm(false) : navigate("/turnamen/kelola")
          }
          onSubmitted={handleSubmitted}
        />
      )}

      {!formVisible && latest && (
        <CancellationRequestView
          request={latest}
          feeType={data.tournament.feeType}
          canResubmit={data.canSubmit}
          blockedReason={data.cannotSubmitReason}
          onResubmit={() => setShowForm(true)}
        />
      )}

      {!formVisible && !latest && (
        <div className="cancel-banner plain">
          <CancellationIcon name="info" size={20} />
          <div>
            <b>Pembatalan belum dapat diajukan</b>
            <small>
              {data.cannotSubmitReason ||
                "Pengajuan pembatalan tidak tersedia."}
            </small>
          </div>
        </div>
      )}

      {!formVisible && older.length > 0 && (
        <section className="cancel-card">
          <h2 className="cancel-h2">Riwayat pengajuan sebelumnya</h2>
          <ul className="cancel-history">
            {older.map((item) => (
              <li key={item.id}>
                <div>
                  <b>{item.reasonLabel}</b>
                  <small>
                    Diajukan {formatShortDate(item.submittedAt)}
                    {item.status === "ditolak" && item.adminNote
                      ? ` · Catatan admin: ${item.adminNote}`
                      : ""}
                  </small>
                </div>
                <CancellationStatusPill status={item.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {done && (
        <ActionDonePopup
          title="Pengajuan terkirim"
          text="Admin akan meninjau pengajuan pembatalan turnamenmu."
          onClose={() => setDone(false)}
        />
      )}
    </div>
  );
}

export default TournamentCancellation;
