import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../../components/icon";
import FilterPanel from "../../components/search/FilterPanel";
import ResultCard from "../../components/search/ResultCard";
import Pagination from "../../components/search/Pagination";
import {
  FEE_OPTIONS,
  PER_PAGE,
  TYPE_OPTIONS,
  getSearchCategories,
  getSearchCities,
  getSearchProvinces,
  searchTournaments,
} from "../../services/tournamentSearchApi";
import {
  cleanSchedule,
  scheduleLabel,
  cleanRegistration,
  registrationLabel,
} from "../../utils/searchSchedule";
import "../../styles/search.css";

// ASSUMPTION: halaman detail turnamen belum ada (menunggu desain). Isi saat route-nya jadi,
// contoh: (id) => `/turnamen/${id}`. Selama null, tombol "Lihat Detail" nonaktif.
const DETAIL_PATH = (id) => `/turnamen/cari/${id}`;
// CHANGED: ditambah dari dan sampai (rentang tanggal kustom)
const FILTER_KEYS = [
  "kategori",
  "tipe",
  "biaya",
  "jadwal",
  "dari",
  "sampai",
  "provinsi",
  "kota",
  "daftar",
  "daftarDari",
  "daftarSampai",
];
const EMPTY_FILTERS = {
  kategori: "",
  tipe: "",
  biaya: "",
  jadwal: "",
  dari: "",
  sampai: "",
  provinsi: "",
  kota: "",
  daftar: "",
  daftarDari: "",
  daftarSampai: "",
};

const labelOf = (list, value) =>
  list.find((o) => o.value === value)?.label ?? value;

// Cari nama dari id untuk daftar { id, name }
const nameOf = (list, id, fallback) =>
  list.find((x) => x.id === id)?.name ?? fallback;

function SearchTournaments() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const paramsKey = params.toString();
  const listRef = useRef(null);

  // Semua kriteria hidup di URL: refresh dan tombol Back tetap konsisten.
  const criteria = useMemo(() => {
    const p = new URLSearchParams(paramsKey);
    const tipe = p.get("tipe") ?? "";
    const offline = tipe === "offline";
    // CHANGED: jadwal dibersihkan (nilai tidak valid diabaikan, dari/sampai ditukar kalau terbalik)
    const schedule = cleanSchedule({
      jadwal: p.get("jadwal") ?? "",
      dari: p.get("dari") ?? "",
      sampai: p.get("sampai") ?? "",
    });
    const registration = cleanRegistration({
      daftar: p.get("daftar") ?? "",
      daftarDari: p.get("daftarDari") ?? "",
      daftarSampai: p.get("daftarSampai") ?? "",
    });
    return {
      q: p.get("q") ?? "",
      kategori: p.get("kategori") ?? "",
      tipe,
      biaya: p.get("biaya") ?? "",
      ...schedule,
      ...registration,
      // CHANGED: provinsi dan kota hanya berlaku untuk tipe Offline
      provinsi: offline ? (p.get("provinsi") ?? "") : "",
      kota: offline ? (p.get("kota") ?? "") : "",
      page: Math.max(1, Math.floor(Number(p.get("page"))) || 1),
    };
  }, [paramsKey]);

  const [queryText, setQueryText] = useState(criteria.q);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [categories, setCategories] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState({
    status: "loading",
    items: [],
    total: 0,
    totalPages: 1,
    message: "",
  });

  // Opsi filter. Kalau gagal dimuat, filter tetap bisa dipakai tanpa pilihan.
  useEffect(() => {
    getSearchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
    getSearchProvinces()
      .then(setProvinces)
      .catch(() => setProvinces([]));
  }, []);

  // Kota mengikuti provinsi: yang di panel saat terbuka, yang aktif di URL saat tertutup
  const activeProvince = open ? draft.provinsi : criteria.provinsi;
  useEffect(() => {
    if (!activeProvince) {
      setCities([]);
      return;
    }
    let off = false;
    getSearchCities(activeProvince)
      .then((list) => !off && setCities(list))
      .catch(() => !off && setCities([]));
    return () => {
      off = true;
    };
  }, [activeProvince]);

  useEffect(() => {
    setQueryText(criteria.q);
  }, [criteria.q]);

  // Ambil data setiap kriteria berubah
  useEffect(() => {
    let off = false;
    setResult((r) => ({ ...r, status: "loading" }));
    searchTournaments(criteria)
      .then((data) => {
        if (off) return;
        // Halaman di URL melebihi jumlah halaman: lompat ke halaman terakhir
        if (data.total > 0 && criteria.page > data.totalPages) {
          const next = new URLSearchParams(paramsKey);
          if (data.totalPages > 1) next.set("page", String(data.totalPages));
          else next.delete("page");
          setParams(next, { replace: true });
          return;
        }
        setResult({
          status: "ok",
          items: data.items,
          total: data.total,
          totalPages: data.totalPages,
          message: "",
        });
      })
      .catch((err) => {
        if (off) return;
        setResult({
          status: "error",
          items: [],
          total: 0,
          totalPages: 1,
          message: err.message || "Terjadi kesalahan.",
        });
      });
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria, reload]);

  // patch: { key: value }. Nilai kosong menghapus parameter. Halaman kembali ke 1.
  const update = (patch, { keepPage = false } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === "" || value == null) next.delete(key);
      else next.set(key, String(value));
    });
    if (!keepPage) next.delete("page");
    setParams(next);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    update({ q: queryText.trim() });
  };

  const togglePanel = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setDraft(
      FILTER_KEYS.reduce((acc, k) => ({ ...acc, [k]: criteria[k] }), {}),
    );
    setOpen(true);
  };

  // CHANGED: ganti tipe ke non-offline mengosongkan provinsi dan kota;
  // ganti jadwal ke non-kustom mengosongkan tanggal
  const changeDraft = (key, value) =>
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === "provinsi") next.kota = "";
      if (key === "tipe" && value !== "offline") {
        next.provinsi = "";
        next.kota = "";
      }
      if (key === "jadwal" && value !== "custom") {
        next.dari = "";
        next.sampai = "";
      }
      if (key === "daftar" && value !== "custom") {
        next.daftarDari = "";
        next.daftarSampai = "";
      }
      return next;
    });

  const applyDraft = () => {
    update({
      ...draft,
      ...cleanSchedule(draft),
      ...cleanRegistration(draft),
      ...(draft.tipe !== "offline" ? { provinsi: "", kota: "" } : {}),
    });
    setOpen(false);
  };

  const resetAll = () => {
    setQueryText("");
    setDraft(EMPTY_FILTERS);
    update({ ...EMPTY_FILTERS, q: "" });
  };

  const changePage = (n) => {
    update({ page: n > 1 ? n : "" }, { keepPage: true });
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Satu chip per filter aktif. "clear" = parameter URL yang dihapus saat chip ditutup.
  // Provinsi dan kota dihitung satu lokasi.
  const chips = [];
  if (criteria.kategori)
    chips.push({
      key: "kategori",
      label: nameOf(categories, criteria.kategori, "Kategori"),
      clear: ["kategori"],
    });
  if (criteria.tipe)
    chips.push({
      key: "tipe",
      label: labelOf(TYPE_OPTIONS, criteria.tipe),
      clear: ["tipe", "provinsi", "kota"],
    });
  if (criteria.biaya)
    chips.push({
      key: "biaya",
      label: labelOf(FEE_OPTIONS, criteria.biaya),
      clear: ["biaya"],
    });
  const jadwalText = scheduleLabel(criteria);
  if (jadwalText)
    chips.push({
      key: "jadwal",
      label: jadwalText,
      clear: ["jadwal", "dari", "sampai"],
    });
  const daftarText = registrationLabel(criteria);
  if (daftarText)
    chips.push({
      key: "daftar",
      label: daftarText,
      clear: ["daftar", "daftarDari", "daftarSampai"],
    });
  if (criteria.kota)
    chips.push({
      key: "kota",
      label: nameOf(cities, criteria.kota, "Kota"),
      clear: ["kota"],
    });
  else if (criteria.provinsi)
    chips.push({
      key: "provinsi",
      label: nameOf(provinces, criteria.provinsi, "Provinsi"),
      clear: ["provinsi", "kota"],
    });

  const hasCriteria = Boolean(criteria.q) || chips.length > 0;

  // Tampilan tombol Filter: terbuka (terisi biru), ada filter aktif (biru muda), atau biasa
  const filterBtnClass = [
    "ct-btn",
    "ct-btn-o",
    open ? "is-open" : "",
    !open && chips.length > 0 ? "has-filter" : "",
  ]
    .filter(Boolean)
    .join(" ");

  let body;
  if (result.status === "loading") {
    body = (
      <div className="ct-grid" aria-busy="true">
        {Array.from({ length: PER_PAGE }, (_, i) => (
          <div key={i} className="ct-card ct-skel" />
        ))}
      </div>
    );
  } else if (result.status === "error") {
    body = (
      <div className="ct-state" role="alert">
        <div className="ct-state-ic">
          <Icon name="alert" size={26} />
        </div>
        <h3>Data belum bisa dimuat</h3>
        <p>{result.message}</p>
        <button
          type="button"
          className="ct-btn ct-btn-s"
          onClick={() => setReload((n) => n + 1)}
        >
          Coba lagi
        </button>
      </div>
    );
  } else if (result.items.length === 0) {
    body = (
      <div className="ct-state">
        <div className="ct-state-ic">
          <Icon name={hasCriteria ? "search" : "trophy"} size={26} />
        </div>
        <h3>
          {hasCriteria ? "Turnamen tidak ditemukan" : "Belum ada turnamen"}
        </h3>
        <p>
          {hasCriteria
            ? "Coba ubah kata kunci atau hapus beberapa filter."
            : "Turnamen yang sudah dipublikasikan akan tampil di sini."}
        </p>
        {hasCriteria && (
          <button type="button" className="ct-btn ct-btn-s" onClick={resetAll}>
            <Icon name="reset" size={16} /> Reset filter
          </button>
        )}
      </div>
    );
  } else {
    body = (
      <>
        <div className="ct-grid">
          {result.items.map((item) => (
            <ResultCard
              key={item.id}
              item={item}
              onOpen={
                DETAIL_PATH ? () => navigate(DETAIL_PATH(item.id)) : undefined
              }
            />
          ))}
        </div>
        <Pagination
          page={criteria.page}
          totalPages={result.totalPages}
          onChange={changePage}
        />
      </>
    );
  }

  return (
    <div className="ct-page">
      <h1 className="admin-title">Cari Turnamen</h1>

      <form className="ct-search" role="search" onSubmit={handleSearch}>
        <div className="ct-search-field">
          <Icon name="search" size={18} />
          <input
            type="text"
            placeholder="Cari nama turnamen atau game..."
            aria-label="Cari nama turnamen atau game"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
          />
        </div>
        <button type="submit" className="ct-btn ct-btn-p">
          Cari
        </button>
        <button
          type="button"
          className={filterBtnClass}
          aria-expanded={open}
          aria-controls="ct-filter-panel"
          onClick={togglePanel}
        >
          <Icon name="sliders" size={16} /> Filter
          {chips.length > 0 && <span className="ct-badge">{chips.length}</span>}
        </button>
      </form>

      {open && (
        <FilterPanel
          values={draft}
          onChange={changeDraft}
          onApply={applyDraft}
          onReset={() => setDraft(EMPTY_FILTERS)}
          categories={categories}
          provinces={provinces}
          cities={cities}
        />
      )}

      {!open && chips.length > 0 && (
        <div className="ct-chips">
          {chips.map((c) => (
            <span key={c.key} className="ct-chip">
              {c.label}
              <button
                type="button"
                aria-label={`Hapus filter ${c.label}`}
                onClick={() =>
                  update(Object.fromEntries(c.clear.map((k) => [k, ""])))
                }
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="ct-link"
            onClick={() => update(EMPTY_FILTERS)}
          >
            Hapus semua
          </button>
        </div>
      )}

      <h2 className="ct-list-title" ref={listRef}>
        Daftar Turnamen
      </h2>
      {body}
    </div>
  );
}

export default SearchTournaments;
