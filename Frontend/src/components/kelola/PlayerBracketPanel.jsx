import { useCallback, useEffect, useRef, useState } from "react";
import { getPlayerBracket } from "../../services/tournamentBracketApi";
import BracketCanvas from "./BracketCanvas";
import PlayerReportDialog from "./PlayerReportDialog";
import CorrectionBanner from "./CorrectionBanner";
import { ChampionsCard } from "./ChampionsPodium";
import ChampionsPopup from "./ChampionsPopup";
import "../../styles/bracket.css";

function Skeleton() {
  return (
    <div aria-hidden="true">
      <div className="kl-bk-card kl-bk-skel">
        <i className="w40" />
        <i className="w70" />
      </div>
      <div className="kl-bk-skel-canvas" />
    </div>
  );
}

// Tab Bracket untuk peserta/player. id = id turnamen.
// subtitle : "Nama Turnamen · Game" untuk popup juara
// onChanged: dipanggil saat turnamen selesai agar header halaman (status) disegarkan
function PlayerBracketPanel({ id, subtitle = "", onChanged }) {
  const [state, setState] = useState({ data: null, error: "" });
  const [reporting, setReporting] = useState(null);
  const [championsOpen, setChampionsOpen] = useState(false);
  const sawCorrection = useRef(false);

  useEffect(() => {
    let off = false;
    sawCorrection.current = false;
    setChampionsOpen(false);
    setState({ data: null, error: "" });
    getPlayerBracket(id)
      .then((data) => !off && setState({ data, error: "" }))
      .catch(
        (err) =>
          !off &&
          setState({
            data: null,
            error: err.message || "Bracket tidak dapat dimuat.",
          }),
      );
    return () => {
      off = true;
    };
  }, [id]);

  const refresh = useCallback(
    () =>
      getPlayerBracket(id)
        .then((data) => setState({ data, error: "" }))
        .catch(() => {}),
    [id],
  );
  const closeReport = useCallback(() => setReporting(null), []);
  const closeChampions = useCallback(() => setChampionsOpen(false), []);

  const correction = state.data?.bracket?.correction ?? null;
  const champions = state.data?.bracket?.champions ?? null;

  // Popup juara hanya saat turnamen BARU selesai
  useEffect(() => {
    if (correction) sawCorrection.current = true;
    if (champions && sawCorrection.current) {
      sawCorrection.current = false;
      setChampionsOpen(true);
    }
  }, [correction, champions]);

  const onCorrectionEnded = async () => {
    await refresh();
    onChanged?.();
  };

  if (state.error) return <p className="admin-message error">{state.error}</p>;
  if (!state.data) return <Skeleton />;

  const { data } = state;
  const b = data.bracket;

  if (!data.published || !b) {
    return (
      <p className="kl-empty">{data.note || "Bracket belum dipublikasikan."}</p>
    );
  }

  const finished = data.tournament.status === "selesai";

  return (
    <>
      {correction && !finished && (
        <CorrectionBanner
          key={correction.endsAt}
          seconds={correction.seconds}
          onExpired={onCorrectionEnded}
        />
      )}
      {finished && champions && (
        <ChampionsCard champions={champions} decidedAt={b.finalizedAt} />
      )}
      {b.description && (
        <div className="kl-bk-card kl-bk-desc">
          <div className="kl-bk-desc-top">
            <h4>Deskripsi Bracket</h4>
          </div>
          <p>{b.description}</p>
        </div>
      )}
      <BracketCanvas
        rounds={b.rounds}
        mineReg={data.mySquad?.regId ?? null}
        onReport={finished ? undefined : setReporting}
      />
      {reporting && !finished && (
        <PlayerReportDialog
          tournamentId={id}
          match={reporting}
          onClose={closeReport}
          onSubmitted={refresh}
        />
      )}
      {championsOpen && champions && (
        <ChampionsPopup
          champions={champions}
          subtitle={subtitle}
          onClose={closeChampions}
        />
      )}
    </>
  );
}

export default PlayerBracketPanel;
