import { useEffect } from "react";

function LeaveSquadDialog({
  name,
  isLeader,
  loading,
  error,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !loading && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, onClose]);

  return (
    <div
      className="sq-ov"
      onMouseDown={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div
        className="sq-modal sqd-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sqd-leave-title"
      >
        <h2 id="sqd-leave-title" className="sqd-confirm-title">
          Keluar dari {name}?
        </h2>
        <p className="sqd-confirm-text">
          {isLeader
            ? "Kamu adalah Leader. Jika keluar tanpa mengalihkan jabatan, anggota aktif dengan tanggal bergabung paling awal akan menjadi Leader baru."
            : "Kamu tidak akan lagi menjadi anggota squad ini. Untuk bergabung kembali, kamu perlu mengajukan permintaan atau menerima undangan."}
        </p>
        {error && <p className="sq-err">{error}</p>}
        <div className="sq-modal-actions">
          <button
            type="button"
            className="sq-btn ghost"
            onClick={onClose}
            disabled={loading}
          >
            Batal
          </button>
          <button
            type="button"
            className="sq-btn danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Memproses..." : "Keluar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LeaveSquadDialog;
