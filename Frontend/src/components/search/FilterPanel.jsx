import Icon from "../icon";
import {
  FEE_OPTIONS,
  SCHEDULE_OPTIONS,
  TYPE_OPTIONS,
} from "../../services/tournamentSearchApi";

function SelectField({
  id,
  label,
  value,
  onChange,
  disabled,
  className = "",
  children,
}) {
  return (
    <div className={`ct-field ${className}`}>
      {" "}
      <label className="ct-label" htmlFor={id}>
        {label}
      </label>
      <div className="ct-select-wrap">
        <select
          id={id}
          className="ct-select"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {children}
        </select>
        <Icon name="chevron-down" size={18} />
      </div>
    </div>
  );
}

function DateField({ id, label, value, onChange }) {
  return (
    <div className="ct-field">
      <label className="ct-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="date"
        className="ct-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function FilterPanel({
  values,
  onChange,
  onApply,
  onReset,
  categories,
  provinces,
  cities,
}) {
  // Provinsi dan kota hanya relevan untuk turnamen offline
  const offline = values.tipe === "offline";

  return (
    <section
      id="ct-filter-panel"
      className="ct-panel"
      aria-label="Filter turnamen"
    >
      <div className="ct-panel-grid">
        {/* Kolom 1: Kategori, Jadwal main */}
        <div className="ct-col">
          <SelectField
            id="ct-kategori"
            label="Kategori Game"
            value={values.kategori}
            onChange={(v) => onChange("kategori", v)}
          >
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="ct-jadwal"
            label="Jadwal"
            value={values.jadwal}
            onChange={(v) => onChange("jadwal", v)}
          >
            {SCHEDULE_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>

          {values.jadwal === "custom" && (
            <>
              <DateField
                id="ct-dari"
                label="Dari tanggal"
                value={values.dari}
                onChange={(v) => onChange("dari", v)}
              />
              <DateField
                id="ct-sampai"
                label="Sampai tanggal"
                value={values.sampai}
                onChange={(v) => onChange("sampai", v)}
              />
            </>
          )}
        </div>

        {/* Kolom 2: Biaya, Batas pendaftaran */}
        <div className="ct-col">
          <SelectField
            id="ct-biaya"
            label="Biaya"
            value={values.biaya}
            onChange={(v) => onChange("biaya", v)}
          >
            {FEE_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="ct-daftar"
            label="Batas Pendaftaran"
            value={values.daftar}
            onChange={(v) => onChange("daftar", v)}
          >
            {SCHEDULE_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>

          {values.daftar === "custom" && (
            <>
              <DateField
                id="ct-daftar-dari"
                label="Pendaftaran tutup dari"
                value={values.daftarDari}
                onChange={(v) => onChange("daftarDari", v)}
              />
              <DateField
                id="ct-daftar-sampai"
                label="Pendaftaran tutup sampai"
                value={values.daftarSampai}
                onChange={(v) => onChange("daftarSampai", v)}
              />
            </>
          )}
        </div>

        {/* Kolom 3: Tipe, lalu Provinsi dan Kota (hanya Offline) */}
        <div className="ct-col">
          <div className="ct-field">
            <span className="ct-label" id="ct-tipe-label">
              Tipe
            </span>
            <div
              className="ct-seg"
              role="radiogroup"
              aria-labelledby="ct-tipe-label"
            >
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value || "all"}
                  type="button"
                  role="radio"
                  aria-checked={values.tipe === o.value}
                  className={values.tipe === o.value ? "on" : ""}
                  onClick={() => onChange("tipe", o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {offline && (
            <>
              <SelectField
                id="ct-provinsi"
                label="Provinsi"
                value={values.provinsi}
                onChange={(v) => onChange("provinsi", v)}
              >
                <option value="">Semua provinsi</option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectField>

              <SelectField
                id="ct-kota"
                label="Kota"
                value={values.kota}
                disabled={!values.provinsi}
                onChange={(v) => onChange("kota", v)}
              >
                <option value="">Semua kota</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
            </>
          )}
        </div>
      </div>

      <div className="ct-panel-foot">
        <button type="button" className="ct-btn ct-btn-g" onClick={onReset}>
          <Icon name="reset" size={16} /> Reset
        </button>
        <button type="button" className="ct-btn ct-btn-p" onClick={onApply}>
          Terapkan
        </button>
      </div>
    </section>
  );
}

export default FilterPanel;
