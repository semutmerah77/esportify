import { useCallback, useEffect, useState } from "react";
import {
  formatReportTime,
  getReportInbox,
  reporterSide,
} from "../../services/matchReportApi";
import ApproveReportDialog from "./ApproveReportDialog";
import RejectReportDialog from "./RejectReportDialog";
import { EvidenceRow, EvidenceViewer } from "./ReportEvidence";
import ReportIcon from "./ReportIcon";
import "../../styles/match-report.css";

const TABS = [
  { value: "menunggu", label: "Menunggu" },
  { value: "riwayat", label: "Riwayat" },
];

const resultText = (m) =>
  m.scoreA !== null && m.scoreB !== null
    ? `${m.a?.name ?? "-"} ${m.scoreA} – ${m.scoreB} ${m.b?.name ?? "-"}`
    : "Belum ada hasil";

function InboxSkeleton() {
  return (
    <div aria-hidden="true">
      {[0, 1].map((i) => (
        <div className="rp-group" key={i}>
          <div className="rp-skel rp-skel-line w40" />
          <div className="rp-skel rp-skel-card" />
        </div>
      ))}
    </div>
  );
}

// Kartu satu laporan. mode "pending" (ada tombol Tolak/Setujui) atau "history" (status keputusan)
function ReportCard({ report, match, mode, onView, onApprove, onReject }) {
  // Skor ditampilkan dari sudut pandang squad pelapor; BE mengirim skor menurut posisi slot (A/B)
  const side = reporterSide(report, match);
  const mine = side === "A" ? match.a : match.b;
  const other = side === "A" ? match.b : match.a;
  const myScore = side === "A" ? report.scoreA : report.scoreB;
  const otherScore = side === "A" ? report.scoreB : report.scoreA;
  const reporterName = report.squad?.name ?? mine?.name ?? "-";
  const iWon = myScore > otherScore;
  const history = mode === "history";

  return (
    <article className="rp-card">
      <div className="rp-card-top">
        <div>
          <h4>Laporan {reporterName}</h4>
          {history && (
            <span className="rp-by">
              <ReportIcon name="user" size={13} />{" "}
              {report.sentBy && (
                <>
                  Dikirim oleh <b>{report.sentBy}</b>
                </>
              )}
            </span>
          )}
        </div>
        {history ? (
          report.status === "disetujui" ? (
            <span className="rp-badge ok">
              <ReportIcon name="check" size={12} /> Disetujui
            </span>
          ) : (
            <span className="rp-badge bad">
              <ReportIcon name="x" size={12} /> Ditolak
            </span>
          )
        ) : (
          <time>{formatReportTime(report.sentAt)}</time>
        )}
      </div>
      {!history && (
        <span className="rp-by">
          <ReportIcon name="user" size={13} /> Dikirim oleh{" "}
          <b>{report.sentBy || "-"}</b>
        </span>
      )}

      {history && report.status === "ditolak" && (
        <div className="rp-reject-box">
          <b>
            <ReportIcon name="alert" size={15} /> Alasan penolakan
          </b>
          <p>{report.rejectReason || "-"}</p>
        </div>
      )}

      <p className="rp-label muted">Skor dilaporkan</p>
      <div className="rp-result card">
        <span>
          {reporterName}
          {history && iWon && <em className="rp-win">Menang</em>}
        </span>
        <b>
          {myScore} <i>vs</i> {otherScore}
        </b>
        <span>
          {other?.name ?? "-"}
          {history && !iWon && <em className="rp-win">Menang</em>}
        </span>
      </div>

      <p className="rp-label muted">
        Bukti pertandingan ({report.evidences.length})
      </p>
      {report.evidences.map((ev) => (
        <EvidenceRow
          key={ev.id}
          variant="chip"
          name={ev.name}
          type={ev.type}
          onView={() => onView({ name: ev.name, source: { url: ev.url } })}
        />
      ))}

      <p className="rp-label muted">Catatan</p>
      <div className="rp-note-box">
        {report.note || <em>Tidak ada catatan.</em>}
      </div>

      {!history && (
        <div className="rp-actions">
          <button
            type="button"
            className="rp-btn outline-danger"
            onClick={onReject}
          >
            Tolak
          </button>
          <button type="button" className="rp-btn success" onClick={onApprove}>
            Setujui
          </button>
        </div>
      )}
    </article>
  );
}

// Panel samping "Laporan Hasil Pertandingan" untuk penyelenggara (PB-16): tab Menunggu & Riwayat.
// id: id turnamen | onChanged: dipanggil setelah laporan disetujui/ditolak (muat ulang bracket)
function ReportInboxDrawer({ id, onClose, onChanged }) {
  const [tab, setTab] = useState("menunggu");
  const [lists, setLists] = useState({ menunggu: null, riwayat: null });
  const [pendingCount, setPendingCount] = useState(0);
  const [rejectOptions, setRejectOptions] = useState([]);
  const [dialog, setDialog] = useState(null); // { type: "approve"|"reject", group, report }
  const [viewer, setViewer] = useState(null);

  const load = useCallback(
    async (which) => {
      try {
        const res = await getReportInbox(id, which);
        setPendingCount(res.pendingCount);
        if (res.rejectOptions.length) setRejectOptions(res.rejectOptions);
        setLists((prev) => ({
          ...prev,
          [which]: { groups: res.groups, error: "" },
        }));
      } catch (err) {
        setLists((prev) => ({
          ...prev,
          [which]: {
            groups: [],
            error: err.message || "Laporan tidak dapat dimuat.",
          },
        }));
      }
    },
    [id],
  );

  // Muat tab yang dibuka (sekali per tab; daftar dimuat ulang setelah ada keputusan)
  useEffect(() => {
    if (lists[tab] === null) load(tab);
  }, [tab, lists, load]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !dialog && !viewer && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, viewer, onClose]);

  // Setelah setuju/tolak: inbox + riwayat + bracket disegarkan
  const afterDecision = () => {
    setLists({ menunggu: null, riwayat: null });
    onChanged?.();
  };

  const current = lists[tab];

  return (
    <div
      className="rp-drawer-ov"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        className="rp-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rp-inbox-title"
      >
        <header className="rp-drawer-head">
          <div>
            <h2 id="rp-inbox-title">Laporan Hasil Pertandingan</h2>
            <p>Periksa bukti pertandingan sebelum memperbarui bracket.</p>
          </div>
          <button
            type="button"
            className="rp-x"
            aria-label="Tutup"
            onClick={onClose}
          >
            <ReportIcon name="x" size={18} />
          </button>
        </header>

        <div className="rp-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={tab === t.value ? "on" : ""}
              onClick={() => setTab(t.value)}
            >
              {t.label}
              {t.value === "menunggu" && pendingCount > 0 && (
                <span className="rp-count">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="rp-drawer-body">
          {!current && <InboxSkeleton />}
          {current?.error && <p className="rp-err">{current.error}</p>}
          {current && !current.error && current.groups.length === 0 && (
            <div className="rp-empty">
              <ReportIcon name="check" size={22} />
              <b>
                {tab === "menunggu"
                  ? "Tidak ada laporan yang menunggu"
                  : "Belum ada riwayat laporan"}
              </b>
              <p>
                {tab === "menunggu"
                  ? "Laporan baru dari peserta akan muncul di sini."
                  : "Laporan yang sudah disetujui atau ditolak akan muncul di sini."}
              </p>
            </div>
          )}

          {current?.groups.map((group) => (
            <section className="rp-group" key={group.match.id}>
              <h3>Pertandingan #{group.match.number}</h3>
              <p className="rp-group-sub">
                Hasil saat ini: <b>{resultText(group.match)}</b>
              </p>
              {group.reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  match={group.match}
                  mode={tab === "menunggu" ? "pending" : "history"}
                  onView={setViewer}
                  onApprove={() =>
                    setDialog({ type: "approve", group, report })
                  }
                  onReject={() => setDialog({ type: "reject", group, report })}
                />
              ))}
            </section>
          ))}
        </div>
      </aside>

      {dialog?.type === "approve" && (
        <ApproveReportDialog
          tournamentId={id}
          group={dialog.group}
          report={dialog.report}
          onClose={() => setDialog(null)}
          onApproved={afterDecision}
        />
      )}
      {dialog?.type === "reject" && (
        <RejectReportDialog
          tournamentId={id}
          group={dialog.group}
          report={dialog.report}
          options={rejectOptions}
          onClose={() => setDialog(null)}
          onRejected={afterDecision}
        />
      )}
      {viewer && (
        <EvidenceViewer
          name={viewer.name}
          source={viewer.source}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

export default ReportInboxDrawer;
