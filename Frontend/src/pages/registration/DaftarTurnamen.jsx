import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Icon from "../../components/icon";
import SquadLogo from "../../components/squad/SquadLogo";
import initials from "../../components/squad/initials";
import { MemberGrid, StatusPill } from "../../components/registration/RegParts";
import { getSquadDetail } from "../../services/squadApi";
import { getTournamentDetail } from "../../services/tournamentApi";
import {
  getSquadChoices,
  getTournamentForRegister,
  rupiah,
  storageUrl,
  submitRegistration,
} from "../../services/tournamentRegApi";
import "../../styles/turnamen-daftar.css";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "application/pdf"];

const logoOf = (s) => ({
  name: s.name,
  logo: s.logo,
  icon: "shield",
  tone: "blue",
});

function DaftarTurnamen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [t, setT] = useState(null);
  const [choices, setChoices] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState(1);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [members, setMembers] = useState([]);
  const [method, setMethod] = useState("");
  const [file, setFile] = useState(null);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    let off = false;
    Promise.all([
      getTournamentForRegister(id),
      getSquadChoices(id),
      getTournamentDetail(id),
    ])
      .then(([tour, ch, detail]) => {
        if (off) return;
        setT({
          ...tour,
          name: detail.name || tour.name,
          game: detail.game || tour.game,
        });
        setChoices(ch);
      })
      .catch(
        (err) =>
          !off && setLoadError(err.message || "Gagal memuat data pendaftaran."),
      );
    return () => {
      off = true;
    };
  }, [id]);

  const methods = useMemo(() => {
    const list = [];
    if (t?.payment?.qris) list.push("qris");
    if (t?.payment?.account) list.push("bank");
    return list;
  }, [t]);

  useEffect(() => {
    if (!method && methods.length) setMethod(methods[0]);
  }, [methods, method]);

  const back = (
    <button
      type="button"
      className="d-back"
      onClick={() => (step === 2 && !done ? setStep(1) : navigate(-1))}
    >
      <Icon name="chevron-left" size={26} /> Kembali
    </button>
  );

  if (loadError) {
    return (
      <div className="sq-page">
        {back}
        <p className="admin-message error">{loadError}</p>
      </div>
    );
  }
  if (!t || !choices) return <div className="sq-page">{back}</div>;

  const showFee = t.state === "daftar" && choices.items.length > 0;

  const head = (
    <section className="tr-card tr-head">
      <h2>{t.name}</h2>
      {t.game && <small>{t.game}</small>}
      {showFee && (
        <div className="tr-fee">
          <span>Biaya Pendaftaran:</span>
          <b>{t.paid ? rupiah(t.fee) : "Gratis"}</b>
        </div>
      )}
    </section>
  );

  const titleRow = (
    <div className="tr-titlebar">
      <h1 className="admin-title">Daftar Turnamen</h1>
      {t.state === "daftar" && choices.items.length > 0 && (
        <span className="tr-step">{step}/2</span>
      )}
    </div>
  );

  // Sudah terdaftar (menunggu / diterima)
  if (t.state === "status") {
    const r = t.reg;
    return (
      <div className="sq-page tr-page">
        {back}
        {titleRow}
        {head}
        <section className="tr-card tr-info">
          <div className="tr-info-head">
            <span className="tr-info-ic">
              <Icon name="info" size={18} />
            </span>
            <h3>Kamu sudah terdaftar di turnamen ini</h3>
          </div>
          <p>
            {r.didaftarkan_oleh_saya === false
              ? `${r.pendaftar?.username} mendaftarkan kamu bersama squad di bawah ini. `
              : "Kamu mendaftarkan squad di bawah ini. "}
            Satu pemain hanya boleh mengikuti satu squad di turnamen yang sama.
          </p>
          <b className="tr-label">Terdaftar dengan squad:</b>
          <div className="tr-squadrow">
            <span className="tr-squad-ic">{initials(r.squad?.nama_squad)}</span>
            <b>{r.squad?.nama_squad}</b>
            <code>ID: {r.squad?.id_squad}</code>
          </div>
          <div className="tr-statusline">
            Status pendaftaran: <StatusPill status={r.status_pendaftaran} />
          </div>
          <small className="tr-muted">
            {r.status_pendaftaran === "diterima"
              ? "Pendaftaran kamu sudah diterima. Sampai jumpa di turnamen!"
              : "Pendaftaran kamu sedang menunggu konfirmasi penyelenggara."}
          </small>
          <Link
            className="sq-btn outline tr-link"
            to={`/pendaftaran/${r.id_pendaftaran}`}
          >
            Lihat Pendaftaran
          </Link>
        </section>
      </div>
    );
  }

  // Pendaftaran ditutup / slot penuh
  if (t.state !== "daftar") {
    return (
      <div className="sq-page tr-page">
        {back}
        {titleRow}
        {head}
        <p className="tr-warn">{t.note}</p>
      </div>
    );
  }

  // Belum punya squad
  if (choices.items.length === 0) {
    return (
      <div className="sq-page tr-page">
        {back}
        {titleRow}
        {head}
        <p className="admin-message">
          {choices.message ||
            "Gabung ke squad terlebih dahulu untuk melanjutkan proses pendaftaran"}
        </p>
      </div>
    );
  }

  const shown = choices.items.filter((s) => {
    const k = q.trim().toLowerCase().replace(/^#/, "");
    return (
      !k ||
      s.name.toLowerCase().includes(k) ||
      String(s.code).toLowerCase().includes(k) ||
      String(s.id) === k
    );
  });

  const goStep2 = () => {
    if (!selected) return;
    setError("");
    setMembers([]);
    setStep(2);
    getSquadDetail(selected.id)
      .then((d) => d && setMembers(d.members))
      .catch(() => {});
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!ALLOWED.includes(f.type))
      return setError(
        "Bukti pembayaran harus berformat JPG, JPEG, PNG, atau PDF.",
      );
    if (f.size > MAX_BYTES)
      return setError("Ukuran bukti pembayaran maksimal 2 MB.");
    setError("");
    setFile(f);
  };

  const submit = async () => {
    if (t.paid && (!file || !agree)) {
      setError("Harap isi persyaratan yang diperlukan");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await submitRegistration(id, {
        squadId: selected.id,
        file: t.paid ? file : null,
        agree: t.paid && agree,
      });
      setDone(res);
    } catch (err) {
      setError(err.message || "Gagal mengirim pendaftaran.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sq-page tr-page">
      {back}
      {titleRow}
      {head}

      {step === 1 && (
        <>
          <h3 className="tr-h3">Pilih Squad</h3>
          <section className="tr-card tr-pick">
            <div className="tr-pick-top">
              <span>Daftar Squad Anda</span>
              <label className="tr-search">
                <Icon name="search" size={16} />
                <input
                  type="text"
                  placeholder="Cari nama atau id squad"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
            </div>
            <ul className="tr-squads">
              {shown.map((s) => {
                const on = selected?.id === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`tr-squad ${on ? "on" : ""} ${s.canRegister ? "" : "off"}`}
                      disabled={!s.canRegister}
                      onClick={() => setSelected(s)}
                    >
                      <span className="tr-lead">
                        {s.canRegister ? (
                          <span className="tr-radio">
                            <i />
                          </span>
                        ) : (
                          <Icon name="lock" size={22} />
                        )}
                      </span>
                      <span className="tr-squad-main">
                        <b>{s.name}</b>
                        <small>
                          {s.count} Anggota
                          {!s.canRegister && s.reason && <em>{s.reason}</em>}
                        </small>
                      </span>
                      <code>ID: {s.code}</code>
                    </button>
                    {s.registrationId && (
                      <Link
                        className="tr-sub-link"
                        to={`/pendaftaran/${s.registrationId}`}
                      >
                        Lihat Pendaftaran
                      </Link>
                    )}
                  </li>
                );
              })}
              {shown.length === 0 && (
                <p className="admin-message">Squad tidak ditemukan.</p>
              )}
            </ul>
          </section>
          <div className="tr-actions">
            <button
              type="button"
              className="tr-cta tr-cta-next"
              disabled={!selected}
              onClick={goStep2}
            >
              Lanjutkan <Icon name="arrow-right" size={20} />
            </button>
          </div>
        </>
      )}

      {step === 2 && selected && (
        <>
          <b className="tr-label">Squad dipilih:</b>
          <div className="tr-squadrow">
            <SquadLogo squad={logoOf(selected)} size={32} />
            <b>{selected.name}</b>
            <code>ID: {selected.code}</code>
          </div>

          <b className="tr-label">Daftar Anggota:</b>
          <div className="tr-card tr-members-panel">
            <MemberGrid members={members} meName={user?.username} />
          </div>

          {t.paid && (
            <>
              {methods.length > 1 && (
                <>
                  <h3 className="tr-h3">Pilih Metode Pembayaran</h3>
                  <div className="tr-methods">
                    <button
                      type="button"
                      className={`tr-method ${method === "qris" ? "on" : ""}`}
                      onClick={() => setMethod("qris")}
                    >
                      <Icon name="qr-code" size={18} />
                      <b>Qris</b>
                      <small>Scan kode QR</small>
                      {method === "qris" && <em>Dipilih</em>}
                    </button>
                    <button
                      type="button"
                      className={`tr-method ${method === "bank" ? "on" : ""}`}
                      onClick={() => setMethod("bank")}
                    >
                      <Icon name="landmark" size={18} />
                      <b>Transfer Bank</b>
                      <small>Transfer rekening</small>
                      {method === "bank" && <em>Dipilih</em>}
                    </button>
                  </div>
                </>
              )}

              <h3 className="tr-h3">
                {methods.length > 1 ? "Detail Pembayaran" : "Metode Pembayaran"}
              </h3>
              <div className="tr-card tr-pay">
                {method === "qris" && t.payment?.qris && (
                  <img
                    src={storageUrl(t.payment.qris, selected.logo || "")}
                    alt="QRIS"
                  />
                )}
                {method === "bank" && t.payment?.account && (
                  <>
                    <h4>Nomor Rekening</h4>
                    <div className="tr-account">{t.payment.account}</div>
                  </>
                )}
              </div>

              <h3 className="tr-h3">Upload Bukti Pembayaran</h3>
              <p className="tr-muted">
                Unggah screenshot atau foto bukti transaksi yang berhasil.
              </p>
              <label className="tr-upload">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={pickFile}
                  hidden
                />
                <Icon name="upload-cloud" size={44} />
                <b>{file ? file.name : "Unggah Bukti Pembayaran"}</b>
                <small>
                  <Icon name="info" size={12} /> FORMAT JPG, PNG, PDF • MAKS 2
                  MB
                </small>
              </label>

              <div className="tr-notice">
                <b>
                  <Icon name="alert-triangle" size={14} /> Perhatian sebelum
                  mengirim pendaftaran
                </b>
                <ul>
                  <li>
                    Pastikan nominal transfer sesuai biaya pendaftaran:{" "}
                    {rupiah(t.fee).replace("Rp.", "Rp ")}.
                  </li>
                  <li>Pastikan foto bukti pembayaran jelas dan terbaca.</li>
                  <li>Pendaftaran yang sudah dikirim tidak dapat diubah.</li>
                  <li>
                    Jika ditolak, squad dapat mendaftar ulang dari awal selama
                    pendaftaran masih dibuka dan slot tersedia.
                  </li>
                  <li>
                    Urusan pembayaran dan pengembalian dana menjadi tanggung
                    jawab penyelenggara.
                  </li>
                </ul>
                <label className="tr-check">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                  />
                  Saya telah memeriksa data pendaftaran dan bukti pembayaran,
                  serta memahami ketentuan di atas.
                </label>
              </div>
            </>
          )}

          {error && <p className="sq-err">{error}</p>}
          <button
            type="button"
            className="tr-cta"
            disabled={busy}
            onClick={submit}
          >
            {busy ? "Mengirim..." : "Kirim Pendaftaran"}
          </button>
        </>
      )}

      {done && (
        <div className="sq-ov">
          <div className="tr-done" role="dialog" aria-modal="true">
            <span className="tr-done-ic">
              <Icon name="check" size={28} />
            </span>
            <h2>Pendaftaran berhasil dikirim</h2>
            <p className="tr-muted">{done.message}</p>
            <dl>
              <div>
                <dt>Turnamen</dt>
                <dd>
                  {t.name}
                  <small>{t.game}</small>
                </dd>
              </div>
              <div>
                <dt>Squad</dt>
                <dd>{selected.name}</dd>
              </div>
              <div>
                <dt>Biaya Pendaftaran</dt>
                <dd className="green">{t.paid ? rupiah(t.fee) : "Gratis"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusPill status={done.registration.status} />
                </dd>
              </div>
            </dl>
            <div className="tr-done-actions">
              <button
                type="button"
                className="sq-btn outline"
                onClick={() =>
                  navigate(`/turnamen/cari/${id}`, { replace: true })
                }
              >
                Kembali ke Turnamen
              </button>
              <button
                type="button"
                className="sq-btn primary"
                onClick={() =>
                  navigate(`/pendaftaran/${done.registration.id}`, {
                    replace: true,
                  })
                }
              >
                Lihat Status Pendaftaran <Icon name="arrow-right" size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DaftarTurnamen;