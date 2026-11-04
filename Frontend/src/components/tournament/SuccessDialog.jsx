import { useEffect } from "react";

function SuccessDialog({ title, text, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(5, 8, 14, 0.8)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 100%)",
          padding: 24,
          border: "1px solid #243049",
          borderRadius: 12,
          background: "#121826",
          color: "#f1f5f9",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            margin: "0 auto 12px",
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            background: "rgba(34, 197, 94, 0.15)",
            color: "#22c55e",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          ✓
        </div>
        <h3 style={{ margin: "0 0 8px" }}>{title}</h3>
        <p style={{ margin: "0 0 20px", color: "#94a3b8", lineHeight: 1.5 }}>
          {text}
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{
            height: 38,
            padding: "0 28px",
            border: 0,
            borderRadius: 8,
            background: "#2563eb",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}

export default SuccessDialog;
