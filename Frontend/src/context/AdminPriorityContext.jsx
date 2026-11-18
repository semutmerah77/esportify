import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { getAdminSubmissions } from "../services/adminApi";
import { isPriority, toMs, waitingSince } from "../utils/priority";

const Ctx = createContext(null);

const TICK_MS = 5000; // geser jam (di browser saja, tanpa request)
const MIN_GAP_MS = 15000; // jarak minimal muat ulang saat tab kembali aktif

export function AdminPriorityProvider({ children }) {
  const { pathname } = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const requestNo = useRef(0); // hasil muat ulang yang lebih lama tidak boleh menimpa yang lebih baru
  const lastLoadAt = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++requestNo.current;
    try {
      const list = await getAdminSubmissions();
      if (mine !== requestNo.current) return;
      setItems(list);
      setError("");
    } catch (err) {
      if (mine !== requestNo.current) return;
      setError(
        err.status === 403
          ? err.message || "Kamu tidak punya izin melihat pengajuan."
          : err.message,
      );
    } finally {
      if (mine === requestNo.current) {
        lastLoadAt.current = Date.now();
        setLoading(false);
      }
    }
  }, []);

  // Muat ulang tiap pindah halaman admin (termasuk setelah setujui/tolak/revisi)
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  // Provider ditutup: abaikan hasil yang masih berjalan
  useEffect(
    () => () => {
      requestNo.current += 1;
    },
    [],
  );

  // Jam: supaya popup muncul tepat waktu tanpa menunggu muat ulang (hanya di browser)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  // Saat tab kembali aktif: geser jam, dan muat ulang kalau data sudah agak lama
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      if (Date.now() - lastLoadAt.current >= MIN_GAP_MS) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // Prioritas, yang paling lama menunggu di atas.
  // Acuan waktu = terakhir diajukan ulang (kalau ada), bukan tanggal pengajuan pertama.
  const priority = useMemo(
    () =>
      items
        .filter((s) => isPriority(s, now))
        .sort((a, b) => toMs(waitingSince(a)) - toMs(waitingSince(b))),
    [items, now],
  );

  return (
    <Ctx.Provider value={{ items, priority, loading, error, now, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAdminPriority = () => useContext(Ctx);
