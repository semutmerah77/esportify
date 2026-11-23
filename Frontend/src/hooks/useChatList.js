import { useCallback, useEffect, useState } from "react";
import { getConversations, isAbort } from "../services/chatApi";

const LIST_POLL_MS = 20000; // 15-30 detik sesuai kontrak

// Daftar percakapan, di-poll di UserLayout (setTimeout berantai, berhenti saat tab tersembunyi).
export default function useChatList(enabled) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoaded(false);
      setError("");
      setDenied(false);
      return undefined;
    }

    let off = false;
    let timer;
    let ctrl;

    const schedule = () => {
      clearTimeout(timer);
      if (off || document.visibilityState === "hidden") return;
      timer = setTimeout(run, LIST_POLL_MS);
    };

    async function run() {
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const list = await getConversations({ signal: ctrl.signal });
        if (off) return;
        setItems(list);
        setError("");
        setLoaded(true);
      } catch (e) {
        if (off || isAbort(e)) return;
        if (e.status === 403) {
          setDenied(true); // tidak punya permission chat_player: berhenti
          setLoaded(true);
          return;
        }
        setError(e.message || "Gagal memuat percakapan.");
        setLoaded(true);
      }
      schedule();
    }

    const onVisible = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") run();
      else ctrl?.abort();
    };

    document.addEventListener("visibilitychange", onVisible);
    run();

    return () => {
      off = true;
      clearTimeout(timer);
      ctrl?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  const upsert = useCallback(
    (item) =>
      setItems((prev) => [item, ...prev.filter((c) => c.id !== item.id)]),
    [],
  );
  const patch = useCallback(
    (id, changes) =>
      setItems((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...changes } : c)),
      ),
    [],
  );
  const remove = useCallback(
    (id) => setItems((prev) => prev.filter((c) => c.id !== id)),
    [],
  );

  const unread = items.reduce((sum, c) => sum + (c.unread || 0), 0);

  return { items, loaded, error, denied, unread, upsert, patch, remove };
}
