import { useCallback, useEffect, useState } from "react";
import { getPlayerBracket } from "../../services/tournamentBracketApi";
import BracketCanvas from "./BracketCanvas";
import PlayerReportDialog from "./PlayerReportDialog";
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
// Pensil di kartu pertandingan squad sendiri membuka dialog lapor hasil (PB-15/17).
function PlayerBracketPanel({ id }) {
  const [state, setState] = useState({ data: null, error: "" });
  const [reporting, setReporting] = useState(null); // pertandingan yang sedang dilaporkan

  useEffect(() => {
    let off = false;
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

  // Muat ulang tanpa skeleton (setelah laporan terkirim)
  const refresh = useCallback(
    () =>
      getPlayerBracket(id)
        .then((data) => setState({ data, error: "" }))
        .catch(() => {}),
    [id],
  );
  const closeReport = useCallback(() => setReporting(null), []);

  if (state.error) return <p className="admin-message error">{state.error}</p>;
  if (!state.data) return <Skeleton />;

  const { data } = state;
  const b = data.bracket;

  // Belum dipublikasikan: tampilkan keterangan dari BE
  if (!data.published || !b) {
    return (
      <p className="kl-empty">{data.note || "Bracket belum dipublikasikan."}</p>
    );
  }

  return (
    <>
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
        onReport={setReporting}
      />
      {reporting && (
        <PlayerReportDialog
          tournamentId={id}
          match={reporting}
          onClose={closeReport}
          onSubmitted={refresh}
        />
      )}
    </>
  );
}

export default PlayerBracketPanel;
