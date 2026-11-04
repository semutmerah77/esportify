import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../../components/icon";
import TournamentForm, {
  emptyForm,
} from "../../components/tournament/TournamentForm";
import SuccessDialog from "../../components/tournament/SuccessDialog";
import { submitTournament } from "../../services/tournamentApi";

function CreateTournament() {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  const handleSubmit = async (values) => {
    await submitTournament(values);
    // Jangan navigate di sini: tampilkan popup dulu, pindah halaman saat ditutup.
    setDone(true);
  };

  return (
    <>
      <TournamentForm
        mode="create"
        initial={emptyForm}
        submitLabel="Ajukan Turnamen"
        onSubmit={handleSubmit}
        header={
          <h1 className="admin-title t-back-title">
            <button type="button" onClick={() => navigate("/turnamen/kelola")}>
              <Icon name="chevron-left" size={28} /> Kembali
            </button>
          </h1>
        }
      />

      {done && (
        <SuccessDialog
          title="Pengajuan Berhasil Dikirim"
          text="Pengajuan kamu akan diverifikasi admin maksimal 5 hari kerja. Pantau statusnya di halaman Status Pengajuan."
          onClose={() => navigate("/turnamen/status-pengajuan")}
        />
      )}
    </>
  );
}

export default CreateTournament;
