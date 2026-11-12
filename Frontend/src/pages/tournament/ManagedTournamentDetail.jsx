import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/icon";
import TournamentInfo from "../../components/tournament/TournamentInfo";
import { getTournamentDetail } from "../../services/tournamentApi";
import { getRegistrationInfo } from "../../services/tournamentRegApi";

function ManagedTournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [filled, setFilled] = useState(undefined); // slot terisi (menunggu + diterima)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let off = false;
    getTournamentDetail(id)
      .then((data) => !off && setD(data))
      .catch(
        (err) =>
          !off &&
          setError(
            err.status === 404 ? "Turnamen tidak ditemukan." : err.message,
          ),
      )
      .finally(() => !off && setLoading(false));

    // Jumlah slot terisi: gagal dimuat tidak menghalangi halaman detail
    getRegistrationInfo(id)
      .then((r) => !off && setFilled(r.filled))
      .catch(() => {});

    return () => {
      off = true;
    };
  }, [id]);

  const back = (
    <button
      type="button"
      className="d-back"
      onClick={() => navigate("/turnamen/kelola")}
    >
      <Icon name="chevron-left" size={26} /> Kembali
    </button>
  );

  if (loading) return <p className="admin-message">Memuat...</p>;
  if (error)
    return (
      <>
        {back}
        <p className="admin-message error">{error}</p>
      </>
    );

  return (
    <>
      {back}
      <h1 className="admin-title">Detail Turnamen</h1>
      <TournamentInfo d={d} registered={filled} />
    </>
  );
}

export default ManagedTournamentDetail;
