import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/icon";
import SquadLogo from "../../components/squad/SquadLogo";
import initials from "../../components/squad/initials";
import { Avatar, StatusPill } from "../../components/registration/RegParts";
import ProofUpload from "../../components/registration/ProofUpload";
import { getTournamentDetail } from "../../services/tournamentApi";
import {
  getSquadChoices,
  getSquadRoster,
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
  const [t, setT] = useState(null);
  const [choices, setChoices] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState(1);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [roster, setRoster] = useState(null); // detail anggota squad terpilih
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [picked, setPicked] = useState(() => new Set()); // id_player roster yang dipilih
  const [confirming, setConfirming] = useState(false);
  const [method, setMethod] = useState("");
  const [file, setFile] = useState(null);
  const [agree, setAgree] = useState(false);
  const [nickname, setNickname] = useState("");
  const [uid, setUid] = useState("");
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

  // Penyelenggara tidak bisa mendaftar di turnamennya sendiri
  if (t.state === "penyelenggara" || choices.organizer) {
    return (
      <div className="sq-page tr-page">
        {back}
        {titleRow}
        {head}
        <section className="tr-card tr-info">
          <div className="tr-info-head">
            <span className="tr-info-ic">
              <Icon name="lock" size={18} />
            </span>
            <h3>Kamu adalah penyelenggara turnamen ini</h3>
          </div>
          <p>
            Penyelenggara tidak dapat mendaftar pada turnamen yang
            diselenggarakannya.
          </p>
          <Link className="sq-btn outline tr-link" to="/turnamen/kelola">
            Kelola Turnamen
          </Link>
        </section>
      </div>
    );
  }

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

  // Batas roster: detail squad, lalu per squad, lalu meta squad-saya, lalu detail turnamen
  const minRoster =
    roster?.minRoster ??
    selected?.minRoster ??
    choices.minRoster ??
    t.minRoster ??
    1;
  const maxRoster =
    roster?.maxRoster ??
    selected?.maxRoster ??
    choices.maxRoster ??
    t.maxRoster ??
    10;
  const rosterOk = picked.size >= minRoster && picked.size <= maxRoster;
  const need = Math.max(0, minRoster - picked.size);
  const rosterMembers = (roster?.members ?? []).filter((m) => picked.has(m.id));

  // Halaman 2/2: ambil anggota squad, pendaftar (is_pendaftar) otomatis masuk roster
  const goStep2 = async () => {
    if (!selected || loadingRoster) return;
    setError("");
    setLoadingRoster(true);
    try {
      const r = await getSquadRoster(id, selected.id);
      if (!r.canRegister) {
        setError(r.reason || "Squad ini tidak dapat didaftarkan.");
        return;
      }
      setRoster(r);
      setPicked(new Set(r.members.filter((m) => m.isMe).map((m) => m.id)));
      setStep(2);
    } catch (err) {
      setError(err.message || "Gagal memuat anggota squad.");
    } finally {
      setLoadingRoster(false);
    }
  };

  const toggleMember = (m) => {
    if (m.isMe || !m.canPick) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(m.id)) next.delete(m.id);
      else if (next.size < maxRoster) next.add(m.id);
      return next;
    });
  };

  const pickFile = (f) => {
    if (!ALLOWED.includes(f.type))
      return setError(
        "Bukti pembayaran harus berformat JPG, JPEG, PNG, atau PDF.",
      );
    if (f.size > MAX_BYTES)
      return setError("Ukuran bukti pembayaran maksimal 2 MB.");
    setError("");
    setFile(f);
  };

  // Validasi, lalu tampilkan popup konfirmasi
  const review = () => {
    if (!rosterOk) {
      setError(
        picked.size < minRoster
          ? `Roster minimal ${minRoster} pemain.`
          : `Roster maksimal ${maxRoster} pemain.`,
      );
      return;
    }
    if (!nickname.trim()) {
      setError("Nickname game wajib diisi.");
      return;
    }
    if (!uid.trim()) {
      setError("UID game wajib diisi.");
      return;
    }
    if (t.paid && (!file || !agree)) {
      setError("Harap isi persyaratan yang diperlukan");
      return;
    }
    setError("");
    setConfirming(true);
  };

  // "Ya, Daftarkan" di popup konfirmasi
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await submitRegistration(id, {
        squadId: selected.id,
        roster: [...picked],
        nickname: nickname.trim(),
        uid: uid.trim(),
        file: t.paid ? file : null,
        agree: t.paid && agree,
      });
      setConfirming(false);
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
          {error && <p className="sq-err">{error}</p>}
          <div className="tr-actions">
            <button
              type="button"
              className="tr-cta tr-cta-next"
              disabled={!selected || loadingRoster}
              onClick={goStep2}
            >
              Lanjutkan <Icon name="arrow-right" size={20} />
            </button>
          </div>
        </>
      )}

      {step === 2 && selected && roster && (
        <>
          <b className="tr-label">Squad dipilih:</b>
          <div className="tr-squadrow">
            <SquadLogo squad={logoOf(selected)} size={32} />
            <b>{selected.name}</b>
            <code>ID: {selected.code}</code>
          </div>

          <b className="tr-label">Pilih Roster:</b>
          <div className="tr-rm-info">
            <Icon name="info" size={18} />
            <span>
              Pilih minimal {minRoster} dan maksimal {maxRoster} anggota yang
              akan bermain di turnamen ini. Kamu sebagai pendaftar otomatis
              masuk roster.
            </span>
          </div>
          <div className="tr-card tr-rm-panel">
            <div className="tr-rm-top">
              <small>
                Klik kartu anggota untuk memilih atau membatalkan pilihan.
              </small>
              <small className={`tr-rm-count ${rosterOk ? "ok" : "low"}`}>
                {picked.size} dari maks {maxRoster} dipilih
              </small>
            </div>
            <div className="tr-rm-grid">
              {roster.members.map((m) => {
                const on = picked.has(m.id);
                const blocked = !m.canPick && !m.isMe;
                const full = !on && picked.size >= maxRoster;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`tr-rm ${on ? "on" : ""} ${blocked ? "na" : ""}`}
                    disabled={m.isMe || blocked || full}
                    aria-pressed={on}
                    onClick={() => toggleMember(m)}
                  >
                    <Avatar name={m.username} src={m.avatar} size={34} />
                    <span className="tr-rm-name">
                      <b>
                        {m.username}
                        {m.isMe && <em> (Anda)</em>}
                      </b>
                      {blocked && m.reason && (
                        <small>
                          <Icon name="alert" size={12} /> {m.reason}
                        </small>
                      )}
                    </span>
                    <span className="tr-rm-state">
                      {m.isMe ? (
                        <Icon name="lock" size={16} />
                      ) : blocked ? (
                        <Icon name="ban" size={20} />
                      ) : (
                        <span className="tr-rm-box">
                          {on && <Icon name="check" size={14} />}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {need > 0 && (
              <p className="tr-rm-need">
                <Icon name="alert" size={13} /> Pilih minimal {need} anggota
                lagi untuk melanjutkan.
              </p>
            )}
          </div>

          <h3 className="tr-h3">Akun in-game perwakilan</h3>
          <section className="tr-card tr-ingame">
            <p className="tr-ingame-note">
              Dipakai penyelenggara untuk mencocokkan hasil pertandingan, dan
              terlihat oleh peserta turnamen ini agar bisa mencari lawan.
            </p>
            <div className="tr-ingame-fields">
              <label className="tr-field">
                <span>
                  Nickname in-game <em>*</em>
                </span>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="Contoh: Samuel ML"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </label>
              <label className="tr-field">
                <span>
                  ID in-game <em>*</em>
                </span>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="Contoh: 123456789 (1234)"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                />
                <small>
                  Tulis persis seperti di game, termasuk Zone ID atau #TAG jika
                  ada.
                </small>
              </label>
            </div>
          </section>

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
                      <Icon name="qr" size={18} />
                      <b>Qris</b>
                      <small>Scan kode QR</small>
                      {method === "qris" && <em>Dipilih</em>}
                    </button>
                    <button
                      type="button"
                      className={`tr-method ${method === "bank" ? "on" : ""}`}
                      onClick={() => setMethod("bank")}
                    >
                      <Icon name="bank" size={18} />
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
              <ProofUpload
                file={file}
                onSelect={pickFile}
                onRemove={() => setFile(null)}
              />

              <div className="tr-notice">
                <b>
                  <Icon name="alert" size={14} /> Perhatian sebelum mengirim
                  pendaftaran
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
            disabled={busy || !rosterOk}
            onClick={review}
          >
            Kirim Pendaftaran
          </button>
        </>
      )}

      {confirming && selected && (
        <div
          className="sq-ov"
          onMouseDown={(e) =>
            e.target === e.currentTarget && !busy && setConfirming(false)
          }
        >
          <div
            className="tr-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tr-confirm-title"
          >
            <button
              type="button"
              className="tr-confirm-x"
              aria-label="Tutup"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              <Icon name="x" size={18} />
            </button>
            <span className="tr-confirm-ic">
              <Icon name="clipboard-check" size={26} />
            </span>
            <h2 id="tr-confirm-title">Konfirmasi Pendaftaran</h2>
            <p className="tr-confirm-sub">
              Periksa kembali data pendaftaran. Data tidak dapat diubah setelah
              dikirim.
            </p>

            <dl className="tr-confirm-box">
              <div>
                <dt>Turnamen</dt>
                <dd>
                  <b>{t.name}</b>
                  {t.game && <small>{t.game}</small>}
                </dd>
              </div>
              <div>
                <dt>Biaya</dt>
                <dd className="green">{t.paid ? rupiah(t.fee) : "Gratis"}</dd>
              </div>
              <div>
                <dt>Squad</dt>
                <dd className="row">
                  <SquadLogo squad={logoOf(selected)} size={22} />
                  <b>{selected.name}</b>
                  <small>ID: {selected.code}</small>
                </dd>
              </div>
            </dl>

            <h3>Roster ({rosterMembers.length} anggota)</h3>
            <ul className="tr-confirm-roster">
              {rosterMembers.map((m) => (
                <li key={m.id}>
                  <Avatar name={m.username} src={m.avatar} size={28} />
                  <span className="tr-confirm-name">{m.username}</span>
                  {m.isMe && <em>Perwakilan</em>}
                </li>
              ))}
            </ul>

            <h3>Akun in-game perwakilan</h3>
            <div className="tr-confirm-acc">
              <div>
                <small>Nickname in-game</small>
                <b>{nickname.trim()}</b>
              </div>
              <div>
                <small>ID in-game</small>
                <b>{uid.trim()}</b>
              </div>
            </div>

            {t.paid && file && (
              <>
                <h3>Bukti Pembayaran</h3>
                <div className="tr-confirm-file">{file.name}</div>
              </>
            )}

            <p className="tr-confirm-warn">
              <Icon name="alert" size={16} />
              <span>
                Pastikan nickname dan ID in-game sesuai dengan akun yang akan
                digunakan saat bertanding.
              </span>
            </p>

            {error && <p className="sq-err">{error}</p>}
            <div className="tr-confirm-actions">
              <button
                type="button"
                className="tr-confirm-btn"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="tr-confirm-btn primary"
                disabled={busy}
                onClick={submit}
              >
                {busy ? "Mengirim..." : "Ya, Daftarkan"}
              </button>
            </div>
          </div>
        </div>
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
                className="tr-done-btn"
                onClick={() =>
                  navigate(`/turnamen/cari/${id}`, { replace: true })
                }
              >
                Kembali ke Turnamen
              </button>
              <button
                type="button"
                className="tr-done-btn primary"
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
