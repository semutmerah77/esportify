import { useCallback, useEffect, useRef, useState } from "react";
import { getNotificationMarker, isAbort } from "../services/notificationApi";

const POLL_MS = 45 * 1000; // 30-60 detik sesuai kontrak (bukan real-time)

// Penanda lonceng (titik biru). Satu state global di UserLayout, dipakai semua halaman.
// setTimeout berantai, berhenti saat tab tersembunyi, langsung cek sekali saat tab aktif lagi.
export default function useNotifMarker(enabled) {
  const [unread, setUnread] = useState(false);
  const [denied, setDenied] = useState(false);
  const runRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setUnread(false);
      setDenied(false);
      runRef.current = null;
      return undefined;
    }

    let off = false;
    let timer;
    let ctrl;

    const schedule = () => {
      clearTimeout(timer);
      if (off || document.visibilityState === "hidden") return;
      timer = setTimeout(run, POLL_MS);
    };

    async function run() {
      clearTimeout(timer);
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const value = await getNotificationMarker({ signal: ctrl.signal });
        if (off) return;
        setUnread(value);
      } catch (e) {
        if (off || isAbort(e)) return;
        if (e.status === 403) {
          setDenied(true); // bukan Player / tanpa permission: berhenti
          return;
        }
        /* gagal sementara: coba lagi di putaran berikutnya */
      }
      schedule();
    }

    const onVisible = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") run();
      else ctrl?.abort();
    };

    runRef.current = run;
    document.addEventListener("visibilitychange", onVisible);
    run();

    return () => {
      off = true;
      clearTimeout(timer);
      ctrl?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  // Cek ulang sekali (misalnya setelah membuka sebuah notifikasi)
  const refresh = useCallback(() => runRef.current?.(), []);

  return { unread, setUnread, denied, refresh };
}
