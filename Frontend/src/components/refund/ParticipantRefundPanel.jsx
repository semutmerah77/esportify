import { useCallback, useEffect, useState } from "react";
import ActionDonePopup from "../kelola/ActionDonePopup";
import RefundDataCard from "./RefundDataCard";
import RefundForm from "./RefundForm";
import RefundIcon from "./RefundIcon";
import RefundSquadHeader from "./RefundSquadHeader";
import { getParticipantRefund } from "../../services/refundApi";
import "../../styles/refund.css";

function PanelSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="refund-skel block" />
      <div className="refund-skel block tall" />
    </div>
  );
}

// Tab "Pengembalian Dana" di Ruang Turnamen (peserta). Hanya untuk turnamen berbayar yang dibatalkan.
// GET dipanggil sekali saat tab dibuka dan sekali setelah kirim data (tanpa polling).
function ParticipantRefundPanel({ id }) {
  const [state, setState] = useState({ data: null, error: "" });
  const [done, setDone] = useState(false);

  useEffect(() => {
    let off = false;
    setState({ data: null, error: "" });
    getParticipantRefund(id)
      .then((data) => !off && setState({ data, error: "" }))
      .catch(
        (err) =>
          !off &&
          setState({
            data: null,
            error: err.message || "Data pengembalian dana tidak dapat dimuat.",
          }),
      );
    return () => {
      off = true;
    };
  }, [id]);

  const reload = useCallback(
    () =>
      getParticipantRefund(id)
        .then((data) => setState({ data, error: "" }))
        .catch(() => {}),
    [id],
  );

  const handleSubmitted = async () => {
    setDone(true);
    await reload();
  };

  const { data, error } = state;
  if (error) return <p className="admin-message error">{error}</p>;
  if (!data) return <PanelSkeleton />;

  if (!data.available) {
    return (
      <div className="refund-banner">
        <span className="refund-banner-ic">
          <RefundIcon name="info" size={16} />
        </span>
        <p>
          {data.note || "Pengembalian dana belum tersedia untuk turnamen ini."}
        </p>
      </div>
    );
  }

  const refund = data.refund;
  const note = data.isRegistrant
    ? "Hanya pendaftar yang dapat mengisi data pengembalian dana."
    : refund?.registrant
      ? `Data pengembalian dana diisi oleh ${refund.registrant}.`
      : "";

  return (
    <div className="refund-wrap">
      <RefundSquadHeader
        squadName={refund?.squadName ?? "Squad kamu"}
        squadId={refund?.squadId ?? null}
        squadLogo={refund?.squadLogo ?? null}
        registrant={refund?.registrant ?? "-"}
        status={refund?.status ?? "menunggu_data"}
        statusLabel={refund?.statusLabel}
        note={note}
      />

      {data.canFill && (
        <RefundForm
          tournamentId={id}
          methods={data.methods}
          onSubmitted={handleSubmitted}
        />
      )}

      {!data.canFill && refund && refund.status !== "menunggu_data" && (
        <RefundDataCard
          refund={refund}
          organizer={data.tournament.organizer}
          organizerPlayerId={data.tournament.organizerPlayerId}
          organizerAvatar={data.tournament.organizerAvatar}
          plannedDate={data.plannedDate}
        />
      )}

      {done && (
        <ActionDonePopup
          title="Data pengembalian dana terkirim"
          text="Penyelenggara akan melakukan transfer. Pantau statusnya di tab ini."
          onClose={() => setDone(false)}
        />
      )}
    </div>
  );
}

export default ParticipantRefundPanel;
