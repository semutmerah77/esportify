import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/icon";
import TournamentInfo from "../../components/tournament/TournamentInfo";
import { getTournamentDetail } from "../../services/tournamentApi";
import { getRegistrationInfo } from "../../services/tournamentRegApi";
import "../../styles/turnamen-daftar.css";

function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState({
    status: "loading",
    data: null,
    message: "",
  });
  const [reg, setReg] = useState(null); // keadaan tombol Daftar (PB-06)

  const here = `${location.pathname}${location.search}`;

  useEffect(() => {
    let off = false;
    setState({ status: "loading", data: null, message: "" });
    setReg(null);
    getTournamentDetail(id)
      .then((data) => {
        if (!off) setState({ status: "ok", data, message: "" });
      })
      .catch((err) => {
        if (off) return;
        // Token tidak valid / kedaluwarsa: ke login, lalu kembali ke halaman ini
        if (err.status === 401) {
          navigate("/login", { replace: true, state: { from: here } });
          return;
        }
        setState({
          status: "error",
          data: null,
          message:
            err.status === 404
              ? "Turnamen tidak ditemukan."
              : err.message || "Terjadi kesalahan.",
        });
      });
    // Status pendaftaran: gagal dimuat tidak menghalangi halaman detail
    getRegistrationInfo(id)
      .then((r) => !off && setReg(r))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [id, here, navigate]);

  const registerAction = () => {
    // Status belum termuat: tombol nonaktif sementara
    if (!reg) {
      return (
        <button type="button" className="td-register" disabled>
          <Icon name="user-plus" size={18} /> Daftar Sekarang
        </button>
      );
    }

    // Penyelenggara: tombol daftar diganti keterangan
    if (reg.state === "penyelenggara") {
      return (
        <div className="tr-organizer-box">
          <Icon name="lock" size={18} /> {reg.note}
        </div>
      );
    }

    if (reg.state === "status") {
      return (
        <div className="tr-detail-action">
          {reg.note && <small className="tr-muted">{reg.note}</small>}
          <Link
            className="td-register"
            to={`/pendaftaran/${reg.reg.id_pendaftaran}`}
          >
            Lihat Pendaftaran
          </Link>
        </div>
      );
    }

    // Belum terdaftar / pernah ditolak / ditutup / slot penuh
    return (
      <div className="tr-detail-action">
        {reg.reg?.alasan_penolakan && (
          <p className="tr-warn">
            Pendaftaran sebelumnya ditolak: {reg.reg.alasan_penolakan}
          </p>
        )}
        <button
          type="button"
          className="td-register"
          disabled={reg.state !== "daftar"}
          onClick={() => navigate(`/turnamen/${id}/daftar`)}
        >
          <Icon name="user-plus" size={18} /> Daftar Sekarang
        </button>
        {reg.note && <small className="tr-muted">{reg.note}</small>}
      </div>
    );
  };

  return (
    <>
      <button type="button" className="d-back" onClick={() => navigate(-1)}>
        <Icon name="chevron-left" size={26} /> Kembali
      </button>
      <h1 className="admin-title">Detail Turnamen</h1>

      {state.status === "error" && (
        <p className="admin-message error" role="alert">
          {state.message}
        </p>
      )}
      {state.status === "ok" && (
        <TournamentInfo
          d={state.data}
          registered={reg?.filled}
          action={registerAction()}
        />
      )}
    </>
  );
}

export default TournamentDetail;
