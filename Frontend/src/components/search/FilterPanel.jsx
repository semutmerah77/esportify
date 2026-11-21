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

        {offline && (
          <>
            <SelectField
              id="ct-provinsi"
              className="ct-col-1"
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

        {values.jadwal === "custom" && (
          <div className="ct-dates">
            <div className="ct-field">
              <label className="ct-label" htmlFor="ct-dari">
                Dari tanggal
              </label>
              <input
                id="ct-dari"
                type="date"
                className="ct-input"
                value={values.dari}
                onChange={(e) => onChange("dari", e.target.value)}
              />
            </div>
            <div className="ct-field">
              <label className="ct-label" htmlFor="ct-sampai">
                Sampai tanggal
              </label>
              <input
                id="ct-sampai"
                type="date"
                className="ct-input"
                value={values.sampai}
                onChange={(e) => onChange("sampai", e.target.value)}
              />
            </div>
          </div>
        )}

        {values.daftar === "custom" && (
          <div className="ct-dates">
            <div className="ct-field">
              <label className="ct-label" htmlFor="ct-daftar-dari">
                Pendaftaran tutup dari
              </label>
              <input
                id="ct-daftar-dari"
                type="date"
                className="ct-input"
                value={values.daftarDari}
                onChange={(e) => onChange("daftarDari", e.target.value)}
              />
            </div>
            <div className="ct-field">
              <label className="ct-label" htmlFor="ct-daftar-sampai">
                Pendaftaran tutup sampai
              </label>
              <input
                id="ct-daftar-sampai"
                type="date"
                className="ct-input"
                value={values.daftarSampai}
                onChange={(e) => onChange("daftarSampai", e.target.value)}
              />
            </div>
          </div>
        )}
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
