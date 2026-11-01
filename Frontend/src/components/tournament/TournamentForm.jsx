import { useEffect, useState } from "react";
import Icon from "../icon";
import FormSection from "./FormSection";
import UploadButton from "./UploadButton";
import GameSelect from "./GameSelect";
import {
  getGameOptions,
  getProvinces,
  getCities,
} from "../../services/tournamentApi";
import { addDays, toISO } from "../../utils/date";
import { newSponsor, MAX_SPONSOR } from "../../utils/sponsor";

const FUNDING_OPTIONS = [
  { value: "sponsor", label: "Sponsor" },
  { value: "dana_pribadi", label: "Dana Pribadi" },
  { value: "biaya_peserta", label: "Biaya Pendaftaran Peserta" },
];
const PAYMENT_OPTIONS = [
  { value: "qris", label: "QRIS" },
  { value: "transfer", label: "Transfer Bank" },
  { value: "qris_transfer", label: "QRIS dan Transfer Bank" },
];

const FIELD_MAP = {
  poster: "poster",
  nama_turnamen: "name",
  nama_penyelenggara: "organizer",
  id_game: "gameId",
  tipe_turnamen: "type",
  id_kota: "city",
  deskripsi_lokasi: "address",
  slot: "slot",
  jadwal_pendaftaran_tutup: "closeDate",
  jadwal_main: "matchDate",
  deskripsi_turnamen: "description",
  total_hadiah: "prize",
  rincian_pendanaan: "fundingDetail",
  sumber_pendanaan: "funding",
  sponsor: "funding",
  jenis_biaya: "fee",
  biaya_pendaftaran: "feeAmount",
  metode_pembayaran: "paymentMethod",
  qris: "qris",
  no_rekening: "account",
  ktp: "ktp",
  setuju_pertanggungjawaban: "agree",
};
const mapKey = (k) => FIELD_MAP[k] ?? FIELD_MAP[k.replace(/\.\d+$/, "")] ?? k;

export const emptyForm = {
  poster: null,
  name: "",
  organizer: "",
  gameId: null,
  type: "",
  province: "",
  city: "",
  address: "",
  slot: "",
  closeDate: "",
  matchDate: "",
  description: "",
  prize: "",
  funding: [],
  sponsors: [newSponsor()],
  fundingDetail: "",
  fee: "",
  feeAmount: "",
  paymentMethod: "",
  qris: null,
  account: "",
  ktp: null,
  agree: false,
};

const MIN_CLOSE_DAYS = 6; // tidak boleh hari ini sampai 5 hari ke depan
const MIN_GAP_DAYS = 1; // hari pertandingan minimal 1 hari setelah pendaftaran ditutup
const digits = (v) => v.replace(/\D/g, "");

// mode: "create" | "edit". initial = nilai awal. existing = file lama (edit).
// onSubmit(values) melempar error kalau gagal. header = isi di atas poster.
function TournamentForm({
  mode = "create",
  initial = emptyForm,
  existing = null,
  submitLabel,
  onSubmit,
  header,
}) {
  const edit = mode === "edit";
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [games, setGames] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadError, setLoadError] = useState("");

  const minClose = addDays(toISO(new Date()), MIN_CLOSE_DAYS);
  const minMatch = form.closeDate
    ? addDays(form.closeDate, MIN_GAP_DAYS)
    : minClose;

  useEffect(() => {
    Promise.all([getGameOptions(), getProvinces()])
      .then(([g, p]) => {
        setGames(g);
        setProvinces(p);
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  // Kota mengikuti provinsi; balasan lama tidak boleh menimpa pilihan baru
  useEffect(() => {
    if (!form.province) {
      setCities([]);
      return undefined;
    }
    let active = true;
    setCities([]);
    getCities(Number(form.province))
      .then((list) => active && setCities(list))
      .catch(() => active && setCities([]));
    return () => {
      active = false;
    };
  }, [form.province]);

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setMessage("");
  };
  const text = (key) => ({
    value: form[key],
    onChange: (e) => set(key, e.target.value),
  });
  const number = (key) => ({
    value: form[key],
    onChange: (e) => set(key, digits(e.target.value)),
    inputMode: "numeric",
  });
  const setError = (key) => (msg) =>
    setErrors((prev) => ({ ...prev, [key]: msg }));

  const useQris = ["qris", "qris_transfer"].includes(form.paymentMethod);
  const useBank = ["transfer", "qris_transfer"].includes(form.paymentMethod);

  const clearSponsorErrors = () =>
    setErrors((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([k]) => !k.startsWith("sponsor.")),
      ),
    );

  const updateSponsor = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      sponsors: prev.sponsors.map((s, i) =>
        i === index ? { ...s, [field]: value } : s,
      ),
    }));
    setErrors((prev) => ({ ...prev, [`sponsor.${index}.${field}`]: "" }));
    setMessage("");
  };

  const addSponsor = () =>
    setForm((prev) =>
      prev.sponsors.length < MAX_SPONSOR
        ? { ...prev, sponsors: [...prev.sponsors, newSponsor()] }
        : prev,
    );

  const removeSponsor = (index) => {
    setForm((prev) => ({
      ...prev,
      sponsors: prev.sponsors.filter((_, i) => i !== index),
    }));
    clearSponsorErrors(); // index bergeser, jadi error lama dibersihkan
  };

  const toggleFunding = (value) => {
    const next = form.funding.includes(value)
      ? form.funding.filter((x) => x !== value)
      : [...form.funding, value];
    set("funding", next);
    if (!next.includes("sponsor")) {
      set("sponsors", [newSponsor()]);
      clearSponsorErrors();
    }
  };

  const changePayment = (value) => {
    set("paymentMethod", value);
    if (!["qris", "qris_transfer"].includes(value)) set("qris", null);
    if (!["transfer", "qris_transfer"].includes(value)) set("account", "");
  };

  // Validasi klien hanya kenyamanan. Aturan yang berlaku tetap dari backend.
  const validate = () => {
    const e = {};
    if (!edit && !form.poster) e.poster = "Poster wajib diunggah.";
    if (form.name.trim().length < 3)
      e.name = "Nama turnamen minimal 3 karakter.";
    if (form.organizer.trim().length < 3)
      e.organizer = "Nama penyelenggara minimal 3 karakter.";
    if (!form.gameId) e.gameId = "Pilih game.";
    if (!form.type) e.type = "Pilih tipe turnamen.";
    if (form.type === "offline") {
      if (!form.province) e.province = "Pilih provinsi.";
      if (!form.city) e.city = "Pilih kota.";
      if (form.address.trim().length < 5)
        e.address = "Alamat lokasi wajib diisi.";
    }
    if (!(Number(form.slot) >= 1)) e.slot = "Slot minimal 1.";

    // Di mode edit, aturan jarak tanggal hanya dicek kalau tanggalnya diubah
    const closeChanged = form.closeDate !== initial.closeDate;
    const matchChanged = form.matchDate !== initial.matchDate || closeChanged;
    if (!form.closeDate) e.closeDate = "Tetapkan tanggal pendaftaran ditutup.";
    else if (closeChanged && form.closeDate < minClose) {
      e.closeDate = "Pendaftaran ditutup paling cepat 6 hari dari hari ini.";
    }
    if (!form.matchDate) e.matchDate = "Tetapkan hari pertandingan.";
    else if (matchChanged && form.closeDate && form.matchDate < minMatch) {
      e.matchDate =
        "Hari pertandingan minimal 1 hari setelah pendaftaran ditutup.";
    }

    if (form.description.trim().length < 10)
      e.description = "Deskripsi minimal 10 karakter.";
    if (form.prize === "") e.prize = "Isi total hadiah (0 jika tidak ada).";
    if (form.funding.length === 0)
      e.funding = "Pilih minimal satu sumber pendanaan.";
    if (form.funding.includes("sponsor")) {
      form.sponsors.forEach((s, i) => {
        if (!s.nama_sponsor.trim())
          e[`sponsor.${i}.nama_sponsor`] = "Nama sponsor wajib diisi.";
        if (!s.kontak_sponsor.trim())
          e[`sponsor.${i}.kontak_sponsor`] =
            "Contact person sponsor wajib diisi.";
      });
    }
    if (form.fundingDetail.trim().length < 10)
      e.fundingDetail = "Rincian pendanaan minimal 10 karakter.";
    if (!form.fee) e.fee = "Pilih biaya pendaftaran.";
    if (form.fee === "berbayar") {
      if (!(Number(form.feeAmount) > 0))
        e.feeAmount = "Nominal pendaftaran harus lebih dari 0.";
      if (!form.paymentMethod) e.paymentMethod = "Pilih metode pembayaran.";
      if (useQris && !form.qris && !existing?.qrisName)
        e.qris = "QRIS wajib diunggah.";
      if (useBank && form.account.trim().length < 5) {
        e.account = "Isi nomor rekening, nama bank, dan atas nama.";
      }
    }
    if (!edit && !form.ktp) e.ktp = "KTP wajib diunggah.";
    if (!form.agree) e.agree = "Pernyataan harus disetujui.";
    return e;
  };

  const scrollToError = () =>
    setTimeout(
      () =>
        document
          .querySelector(".t-form-section.has-error, .t-line.has-error")
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      0,
    );

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (submitting || !form.agree) return;

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setMessage("Periksa kembali isian yang ditandai merah.");
      scrollToError();
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err) {
      const fieldErrors = {};
      Object.entries(err.fields || {}).forEach(([k, v]) => {
        fieldErrors[mapKey(k)] = Array.isArray(v) ? v[0] : v;
      });
      setErrors(fieldErrors);
      setMessage(err.message || "Gagal menyimpan pengajuan.");
      if (Object.keys(fieldErrors).length > 0) scrollToError();
    } finally {
      setSubmitting(false);
    }
  };

  const radio = (key, value, label) => (
    <label className="t-radio">
      <input
        type="radio"
        name={key}
        checked={form[key] === value}
        onChange={() => set(key, value)}
      />
      {label}
    </label>
  );
  const underline = (key, props = {}) => (
    <input className={`t-line ${errors[key] ? "has-error" : ""}`} {...props} />
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="t-form">
      {header}
      {loadError && <p className="admin-message error">{loadError}</p>}

      <FormSection title="Poster" error={errors.poster}>
        <UploadButton
          hint="FORMAT JPG, PNG, WEBP • MAKS 5 MB"
          maxMB={5}
          file={form.poster}
          existing={
            edit && existing?.posterUrl
              ? { name: "Poster saat ini", url: existing.posterUrl }
              : null
          }
          onChange={(f) => set("poster", f)}
          onError={setError("poster")}
        />
      </FormSection>

      <FormSection title="Nama Turnamen" error={errors.name}>
        {underline("name", {
          placeholder: "Masukkan nama turnamen",
          ...text("name"),
        })}
      </FormSection>

      <FormSection title="Nama Lengkap Penyelenggara" error={errors.organizer}>
        {underline("organizer", {
          placeholder: "Masukkan nama lengkap Anda",
          ...text("organizer"),
        })}
      </FormSection>

      <FormSection title="Pilih Game" error={errors.gameId}>
        <GameSelect
          games={games}
          value={form.gameId}
          onChange={(id) => set("gameId", id)}
        />
      </FormSection>

      <FormSection title="Tipe" error={errors.type}>
        {radio("type", "online", "Online")}
        {radio("type", "offline", "Offline")}

        {form.type === "offline" && (
          <>
            <h3>Lokasi</h3>
            <select
              className={`t-dropdown ${errors.province ? "has-error" : ""}`}
              value={form.province}
              onChange={(e) => {
                set("province", e.target.value);
                set("city", "");
              }}
            >
              <option value="">Provinsi</option>
              {provinces.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.province && (
              <p className="t-field-error">{errors.province}</p>
            )}

            <select
              className={`t-dropdown ${errors.city ? "has-error" : ""}`}
              value={form.city}
              disabled={!form.province}
              onChange={(e) => set("city", e.target.value)}
            >
              <option value="">Kota</option>
              {cities.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.city && <p className="t-field-error">{errors.city}</p>}

            <textarea
              className={`t-box ${errors.address ? "has-error" : ""}`}
              rows={3}
              placeholder="Masukkan nama gedung atau tempat, alamat jalan, dan detail lokasi yang membantu peserta menemukan venue."
              {...text("address")}
            />
            {errors.address && (
              <p className="t-field-error">{errors.address}</p>
            )}
          </>
        )}
      </FormSection>

      <FormSection title="Slot" error={errors.slot}>
        {underline("slot", { placeholder: "Contoh: 32", ...number("slot") })}
      </FormSection>

      <FormSection title="Jadwal Turnamen">
        <label className="t-label">Pendaftaran ditutup</label>
        <div className="t-date">
          <Icon name="calendar" size={18} />
          {underline("closeDate", {
            type: "date",
            min: minClose,
            value: form.closeDate,
            onChange: (e) => {
              set("closeDate", e.target.value);
              if (
                form.matchDate &&
                form.matchDate < addDays(e.target.value, MIN_GAP_DAYS)
              )
                set("matchDate", "");
            },
          })}
        </div>
        {errors.closeDate && (
          <p className="t-field-error">{errors.closeDate}</p>
        )}

        <label className="t-label">Hari Pertandingan</label>
        <div className="t-date">
          <Icon name="calendar" size={18} />
          {underline("matchDate", {
            type: "date",
            min: minMatch,
            ...text("matchDate"),
          })}
        </div>
        {errors.matchDate && (
          <p className="t-field-error">{errors.matchDate}</p>
        )}
      </FormSection>

      <FormSection title="Deskripsi" error={errors.description}>
        <textarea
          className={`t-box ${errors.description ? "has-error" : ""}`}
          rows={4}
          placeholder="Jelaskan konsep, format pertandingan, aturan, dan informasi penting lainnya."
          {...text("description")}
        />
      </FormSection>

      <FormSection title="Total Hadiah" error={errors.prize}>
        <div className="t-money">
          <span>Rp.</span>
          {underline("prize", {
            placeholder: "Masukkan nominal hadiah turnamen",
            ...number("prize"),
          })}
        </div>
      </FormSection>

      <FormSection title="Sumber Pendanaan" error={errors.funding}>
        {FUNDING_OPTIONS.map((o) => (
          <label key={o.value} className="t-radio">
            <input
              type="checkbox"
              checked={form.funding.includes(o.value)}
              onChange={() => toggleFunding(o.value)}
            />
            {o.label}
          </label>
        ))}

        {form.funding.includes("sponsor") && (
          <>
            <h3>Informasi Sponsor</h3>

            {form.sponsors.map((s, i) => {
              const nKey = `sponsor.${i}.nama_sponsor`;
              const kKey = `sponsor.${i}.kontak_sponsor`;
              return (
                <div key={s.key} className="t-sponsor-item">
                  <div className="t-sponsor-head">
                    <span className="t-sponsor-title">Sponsor {i + 1}</span>
                    {form.sponsors.length > 1 && (
                      <button
                        type="button"
                        className="t-sponsor-remove"
                        onClick={() => removeSponsor(i)}
                      >
                        ✕ Hapus
                      </button>
                    )}
                  </div>

                  <label className="t-label">Nama Sponsor</label>
                  {underline(nKey, {
                    placeholder: "Nama perusahaan atau pihak sponsor",
                    value: s.nama_sponsor,
                    onChange: (e) =>
                      updateSponsor(i, "nama_sponsor", e.target.value),
                  })}
                  {errors[nKey] && (
                    <p className="t-field-error">{errors[nKey]}</p>
                  )}

                  <label className="t-label">Contact Person Sponsor</label>
                  {underline(kKey, {
                    placeholder: "Nomer Hp/email",
                    value: s.kontak_sponsor,
                    onChange: (e) =>
                      updateSponsor(i, "kontak_sponsor", e.target.value),
                  })}
                  {errors[kKey] && (
                    <p className="t-field-error">{errors[kKey]}</p>
                  )}
                </div>
              );
            })}

            {form.sponsors.length < MAX_SPONSOR && (
              <button
                type="button"
                className="t-sponsor-add"
                onClick={addSponsor}
              >
                + Tambah Sponsor
              </button>
            )}
          </>
        )}
      </FormSection>

      <FormSection title="Rincian Pendanaan" error={errors.fundingDetail}>
        <textarea
          className={`t-box ${errors.fundingDetail ? "has-error" : ""}`}
          rows={4}
          placeholder="Jelaskan perkiraan total anggaran turnamen serta rencana penggunaan dana, seperti hadiah pemenang dan biaya operasional. Pastikan rincian sesuai dengan sumber pendanaan yang dipilih."
          {...text("fundingDetail")}
        />
      </FormSection>

      <FormSection title="Biaya Pendaftaran" error={errors.fee}>
        {radio("fee", "gratis", "Gratis")}
        {radio("fee", "berbayar", "Berbayar")}

        {form.fee === "berbayar" && (
          <>
            <h3>Nominal Pendaftaran</h3>
            <div className="t-money">
              <span>Rp.</span>
              {underline("feeAmount", {
                placeholder: "Masukkan nominal pendaftaran Turnamen",
                ...number("feeAmount"),
              })}
            </div>
            {errors.feeAmount && (
              <p className="t-field-error">{errors.feeAmount}</p>
            )}

            <h3>Metode Pembayaran</h3>
            <select
              className={`t-dropdown ${errors.paymentMethod ? "has-error" : ""}`}
              value={form.paymentMethod}
              onChange={(e) => changePayment(e.target.value)}
            >
              <option value="">Pilih metode pembayaran</option>
              {PAYMENT_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            {errors.paymentMethod && (
              <p className="t-field-error">{errors.paymentMethod}</p>
            )}

            {useQris && (
              <>
                <div className="t-upload-frame">
                  <UploadButton
                    hint="FORMAT FILE PNG, JPG, WEBP • MAKS 5 MB"
                    maxMB={5}
                    file={form.qris}
                    existing={
                      edit && existing?.qrisName
                        ? { name: existing.qrisName, url: existing.qrisUrl }
                        : null
                    }
                    onChange={(f) => set("qris", f)}
                    onError={setError("qris")}
                  />
                </div>
                {errors.qris && <p className="t-field-error">{errors.qris}</p>}
              </>
            )}

            {useBank && (
              <>
                <h3>Nomor Rekening</h3>
                {underline("account", {
                  placeholder: "Contoh: 1234567890 - BCA - Budi Santoso",
                  ...text("account"),
                })}
                <p className="t-upload-hint">
                  Tulis nomor rekening, nama bank, dan atas nama.
                </p>
                {errors.account && (
                  <p className="t-field-error">{errors.account}</p>
                )}
              </>
            )}
          </>
        )}
      </FormSection>

      <FormSection title="Upload KTP" error={errors.ktp}>
        <div className="t-upload-frame">
          <UploadButton
            hint="JPG, PNG, atau PDF • maks 5 MB. Pastikan KTP terbaca jelas."
            maxMB={5}
            accept=".jpg,.jpeg,.png,.pdf"
            allowedTypes={["image/jpeg", "image/png", "application/pdf"]}
            file={form.ktp}
            existing={edit ? { name: "KTP sudah diunggah", url: null } : null}
            onChange={(f) => set("ktp", f)}
            onError={setError("ktp")}
          />
        </div>
      </FormSection>

      <label className={`t-agree ${errors.agree ? "has-error" : ""}`}>
        <input
          type="checkbox"
          checked={form.agree}
          onChange={(e) => set("agree", e.target.checked)}
        />
        Saya menyatakan data pengajuan, identitas, dan rincian pendanaan yang
        diberikan benar serta dapat dipertanggungjawabkan.
      </label>
      {errors.agree && <p className="t-field-error">{errors.agree}</p>}

      {message && <p className="admin-message error">{message}</p>}

      <div className="t-submit-row">
        <button
          type="submit"
          className="t-submit"
          disabled={submitting || !form.agree}
        >
          {submitting ? "Mengirim..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

export default TournamentForm;
