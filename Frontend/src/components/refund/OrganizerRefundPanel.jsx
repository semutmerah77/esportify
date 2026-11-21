import { useCallback, useEffect, useMemo, useState } from "react";
import ActionDonePopup from "../kelola/ActionDonePopup";
import RefundIcon from "./RefundIcon";
import TransferProofDialog from "./TransferProofDialog";
import { RefundAvatar, RefundStatusPill } from "./RefundSquadHeader";
import {
  formatRupiah,
  formatShortDate,
  getOrganizerRefunds,
} from "../../services/refundApi";
import "../../styles/refund.css";

const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "menunggu_transfer", label: "Menunggu Transfer" },
  { value: "menunggu_data", label: "Menunggu Data" },
  { value: "selesai", label: "Selesai" },
];

function PanelSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="refund-skel row" />
      <div className="refund-skel row" />
      <div className="refund-skel row" />
    </div>
  );
}

// Tab "Pengembalian Dana" di Kelola Turnamen (penyelenggara). Hanya turnamen berbayar yang dibatalkan.
// GET sekali saat tab dibuka dan sekali setelah unggah bukti (tanpa polling). Ringkasan dihitung BE.
function OrganizerRefundPanel({ id }) {
  const [state, setState] = useState({ data: null, error: "" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let off = false;
    setState({ data: null, error: "" });
    getOrganizerRefunds(id)
      .then((data) => !off && setState({ data, error: "" }))
      .catch(
        (err) =>
          !off &&
          setState({
            data: null,
            error: err.message || "Data pengembalian dana tidak dapat dimuat.",
          }),
      );
    return () => {
      off = true;
    };
  }, [id]);

  const reload = useCallback(
    () =>
      getOrganizerRefunds(id)
        .then((data) => setState({ data, error: "" }))
        .catch(() => {}),
    [id],
  );

  const { data, error } = state;
  const items = data?.items;
  const keyword = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      (items ?? []).filter(
        (r) =>
          (!status || r.status === status) &&
          (!keyword ||
            r.squadName.toLowerCase().includes(keyword) ||
            String(r.squadId).includes(keyword.replace(/^#/, ""))),
      ),
    [items, status, keyword],
  );
  const selected = items?.find((r) => r.id === selectedId) ?? null;

  if (error) return <p className="admin-message error">{error}</p>;
  if (!data) return <PanelSkeleton />;

  if (!data.available) {
    return (
      <div className="refund-banner">
        <span className="refund-banner-ic">
          <RefundIcon name="info" size={16} />
        </span>
        <p>
          {data.note || "Pengembalian dana belum tersedia untuk turnamen ini."}
        </p>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="refund-org">
      <div className="refund-org-top">
        <div className="refund-org-count">
          <span>{summary.participants} squad peserta</span>
          {summary.total != null && (
            <small>
              Total pengembalian {formatRupiah(summary.total)} · Selesai{" "}
              {summary.done}/{summary.participants}
            </small>
          )}
        </div>
        <label className="refund-search">
          <RefundIcon name="search" size={16} />
          <input
            type="text"
            placeholder="Cari Nama Squad atau ID Squad"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="refund-select">
          <RefundIcon name="chevron-down" size={16} />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter status"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="refund-rows">
        {visible.map((r) => (
          <li key={r.id} className="refund-row">
            <RefundAvatar
              name={r.squadName}
              seed={r.squadId}
              src={r.squadLogo}
              size={44}
            />
            <div className="refund-row-name">
              <b title={r.squadName}>{r.squadName}</b>
              <small>
                Dikirim {r.submittedAt ? formatShortDate(r.submittedAt) : "-"}
              </small>
            </div>
            <div className="refund-row-col">
              <small>Status</small>
              <RefundStatusPill status={r.status} />
            </div>
            <div className="refund-row-col">
              <small>Pendaftar</small>
              <span>{r.registrant}</span>
            </div>
            <div className="refund-row-end">
              <small>ID: {r.squadId}</small>
              {r.canUploadProof && (
                <button
                  type="button"
                  className="refund-row-btn"
                  onClick={() => setSelectedId(r.id)}
                >
                  Proses
                </button>
              )}
              {!r.canUploadProof && r.status === "selesai" && (
                <button
                  type="button"
                  className="refund-row-btn"
                  onClick={() => setSelectedId(r.id)}
                >
                  Detail
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="admin-message">
          {items.length === 0
            ? "Belum ada data pengembalian dana."
            : "Squad tidak ditemukan."}
        </p>
      )}

      {selected && (
        <TransferProofDialog
          tournamentId={id}
          item={selected}
          onClose={() => setSelectedId(null)}
          onUploaded={async () => {
            setSelectedId(null);
            setDone(true);
            await reload();
          }}
        />
      )}

      {done && (
        <ActionDonePopup
          title="Bukti transfer terkirim"
          text="Status pengembalian dana squad ini sudah selesai."
          onClose={() => setDone(false)}
        />
      )}
    </div>
  );
}

export default OrganizerRefundPanel;
