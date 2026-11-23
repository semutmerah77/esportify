import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Icon from "../icon";
import Avatar from "../user/Avatar";
import ConfirmDialog from "./ConfirmDialog";
import {
  BanIcon,
  BroomIcon,
  DotsIcon,
  SendIcon,
  TrashIcon,
  UnlockIcon,
} from "./ChatIcons";
import {
  blockPlayer,
  clearConversation,
  deleteConversation,
  getConversationPage,
  getNewMessages,
  isAbort,
  markConversationRead,
  sendMessage,
  unblockPlayer,
} from "../../services/chatApi";

const POLL_MS = 4000; // 3-5 detik sesuai kontrak
const MAX_LEN = 1000;

// Gabung + saring duplikat berdasarkan id_pesan (BE memakai >=, jadi duplikat pasti terjadi)
function mergeMessages(prev, incoming) {
  const map = new Map(prev.map((m) => [m.id, m]));
  incoming.forEach((m) => {
    if (!map.has(m.id)) map.set(m.id, m);
  });
  return [...map.values()].sort((a, b) => a.id - b.id);
}

const timeText = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    })
    .replace(".", ":");
};

const CONFIRM = {
  block: (n) => ({
    title: `Blokir ${n}?`,
    description:
      "Player tidak akan dapat mengirim pesan kepada Anda. Player tidak akan tahu bahwa Anda memblokir.",
    label: "Blokir",
    icon: <BanIcon size={18} />,
  }),
  delete: (n) => ({
    title: `Hapus percakapan dengan “${n}”?`,
    description: "Percakapan ini akan dihapus dari daftar Percakapan Anda.",
    label: "Hapus percakapan",
    icon: <TrashIcon size={22} />,
  }),
  clear: (n) => ({
    title: `Bersihkan obrolan dengan ${n}?`,
    description:
      "Obrolan ini akan kosong namun tetap berada dalam daftar percakapan Anda.",
    label: "Bersihkan Pesan",
    icon: <BroomIcon size={20} />,
  }),
};

// Jendela chat satu percakapan. Pasang dengan key={id}.
function ChatWindow({ id, chat }) {
  const cid = Number(id);
  const [notice, setNotice] = useState("");
  const onToast = setNotice; // error ditampilkan di dalam jendela chat, di atas kolom input

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const location = useLocation();
  const navigate = useNavigate();

  const [status, setStatus] = useState("loading"); // loading | ok | missing | error
  const [errMsg, setErrMsg] = useState("");
  const [page, setPage] = useState(null); // { partner, blocked, hasOlder }
  const [messages, setMessages] = useState([]);
  const [readUpTo, setReadUpTo] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const serverTime = useRef("");
  const listRef = useRef(null);
  const menuRef = useRef(null);
  const nearBottom = useRef(true);
  const restoreFrom = useRef(null);
  const needsRead = useRef(false);
  const messagesRef = useRef([]);
  const chatRef = useRef(chat);
  chatRef.current = chat;
  messagesRef.current = messages;

  // ---- Muat halaman pesan (pakai data dari "Kirim Pesan" kalau ada, tanpa request ulang) ----
  useEffect(() => {
    let off = false;
    const ctrl = new AbortController();

    const apply = (p) => {
      setPage({ partner: p.partner, blocked: p.blocked, hasOlder: p.hasOlder });
      setMessages(p.messages);
      serverTime.current = p.serverTime;
      nearBottom.current = true;
      setStatus("ok");
    };

    const known = chatRef.current.items.find((c) => c.id === cid);
    needsRead.current = !known || known.unread > 0;

    const initial = location.state?.page;
    if (initial && String(initial.id) === String(id)) {
      apply(initial);
      return () => {
        off = true;
      };
    }

    getConversationPage(id, { signal: ctrl.signal })
      .then((p) => !off && apply(p))
      .catch((e) => {
        if (off || isAbort(e)) return;
        if (e.status === 404) setStatus("missing");
        else {
          setErrMsg(e.message || "Pesan tidak dapat dimuat.");
          setStatus("error");
        }
      });

    return () => {
      off = true;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---- Tandai dibaca: hanya bila perlu dan tab aktif ----
  const flushRead = useCallback(async () => {
    if (!needsRead.current || document.visibilityState !== "visible") return;
    needsRead.current = false;
    try {
      await markConversationRead(id);
      chatRef.current.patch(cid, { unread: 0 });
    } catch {
      /* gagal diam-diam: dicoba lagi saat ada pesan baru */
    }
  }, [id, cid]);

  useEffect(() => {
    if (status === "ok") flushRead();
  }, [status, flushRead]);

  // ---- Polling pesan baru (setTimeout berantai, pause saat tab tersembunyi) ----
  useEffect(() => {
    if (status !== "ok") return undefined;
    let off = false;
    let timer;
    let ctrl;

    const schedule = () => {
      clearTimeout(timer);
      if (off || document.visibilityState === "hidden") return;
      timer = setTimeout(tick, POLL_MS);
    };

    async function tick() {
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const r = await getNewMessages(id, serverTime.current, {
          signal: ctrl.signal,
        });
        if (off) return;
        if (r.serverTime) serverTime.current = r.serverTime;
        if (r.lastReadId != null)
          setReadUpTo((p) => (p === r.lastReadId ? p : r.lastReadId));

        const have = new Set(messagesRef.current.map((m) => m.id));
        const fresh = r.messages.filter((m) => !have.has(m.id));
        if (fresh.length) {
          if (fresh.some((m) => !m.mine)) needsRead.current = true;
          setMessages((prev) => mergeMessages(prev, fresh));
          const last = fresh[fresh.length - 1];
          chatRef.current.patch(cid, { last });
          flushRead();
        }
      } catch (e) {
        if (off || isAbort(e)) return;
        /* jaringan gagal: coba lagi di putaran berikutnya */
      }
      schedule();
    }

    const onVisible = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") tick();
      else ctrl?.abort();
    };

    document.addEventListener("visibilitychange", onVisible);
    schedule();

    return () => {
      off = true;
      clearTimeout(timer);
      ctrl?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, id, cid, flushRead]);

  // ---- Posisi scroll: ke bawah untuk pesan baru, dijaga saat memuat pesan lama ----
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (restoreFrom.current != null) {
      el.scrollTop = el.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else if (nearBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, status]);

  const loadOlder = async () => {
    const el = listRef.current;
    if (loadingOlder || !page?.hasOlder || !messages.length || !el) return;
    setLoadingOlder(true);
    try {
      const p = await getConversationPage(id, { before: messages[0].id });
      restoreFrom.current = el.scrollHeight - el.scrollTop;
      setMessages((prev) => mergeMessages(prev, p.messages));
      setPage((pg) => ({ ...pg, hasOlder: p.hasOlder }));
    } catch (e) {
      onToast(e.message || "Gagal memuat pesan lama.");
    } finally {
      setLoadingOlder(false);
    }
  };

  const onScroll = (e) => {
    const el = e.currentTarget;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 60) loadOlder();
  };

  // ---- Menu titik tiga: tutup saat klik di luar ----
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // ---- Kirim pesan ----
  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const body = text.trim();
    if (!body) {
      onToast("Pesan tidak boleh kosong.");
      return;
    }
    if (body.length > MAX_LEN) {
      onToast("Pesan maksimal 1000 karakter.");
      return;
    }
    setSending(true);
    try {
      const m = await sendMessage(id, body);
      nearBottom.current = true;
      setMessages((prev) => mergeMessages(prev, [m]));
      setText("");
      chat.upsert({
        id: cid,
        partner: page.partner,
        last: m,
        unread: 0,
        blocked: page.blocked,
      });
    } catch (err) {
      onToast(
        err.fields?.isi_pesan?.[0] || err.message || "Pesan gagal dikirim.",
      );
    } finally {
      setSending(false);
    }
  };

  // ---- Blokir / bersihkan / hapus ----
  const runConfirm = async () => {
    const kind = confirm;
    setBusy(true);
    try {
      if (kind === "block") {
        await blockPlayer(page.partner.id);
        setPage((p) => ({ ...p, blocked: true }));
        chat.patch(cid, { blocked: true });
      } else if (kind === "clear") {
        await clearConversation(id);
        setMessages([]);
        setPage((p) => ({ ...p, hasOlder: false }));
        chat.patch(cid, { last: null });
      } else {
        await deleteConversation(id);
        chat.remove(cid);
        navigate("/obrolan", { replace: true });
        return;
      }
      setConfirm(null);
    } catch (err) {
      onToast(err.message || "Aksi gagal.");
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const unblock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await unblockPlayer(page.partner.id);
      setPage((p) => ({ ...p, blocked: false }));
      chat.patch(cid, { blocked: false });
    } catch (err) {
      onToast(err.message || "Gagal membuka blokir.");
    } finally {
      setBusy(false);
    }
  };

  // ---- Tampilan ----
  if (status === "loading")
    return (
      <section className="ch-pane" aria-hidden="true">
        <div className="ch-pane-head">
          <i className="ch-skel round" />
          <i className="ch-skel line" />
        </div>
        <div className="ch-msgs">
          <i className="ch-skel bubble" />
          <i className="ch-skel bubble right" />
          <i className="ch-skel bubble" />
        </div>
      </section>
    );

  if (status !== "ok")
    return (
      <section className="ch-pane">
        <div className="ch-empty">
          <b>
            {status === "missing"
              ? "Percakapan tidak ditemukan."
              : "Pesan tidak dapat dimuat."}
          </b>
          {status === "error" && <span>{errMsg}</span>}
          <button
            type="button"
            className="ch-result-btn"
            onClick={() => navigate("/obrolan", { replace: true })}
          >
            Kembali ke daftar
          </button>
        </div>
      </section>
    );

  const name = page.partner.username;
  const dlg = confirm ? CONFIRM[confirm](name) : null;

  return (
    <section className="ch-pane">
      <div className="ch-pane-head">
        <button
          type="button"
          className="ch-back"
          onClick={() => navigate("/obrolan")}
          aria-label="Kembali ke daftar"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span className="ch-ava">
          <Avatar src={page.partner.avatar} name={name} size={36} />
        </span>
        <b className="ch-pane-name">{name}</b>

        <div className="ch-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="ch-dots"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu percakapan"
            aria-expanded={menuOpen}
          >
            <DotsIcon />
          </button>
          {menuOpen && (
            <div className="ch-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="muted"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirm("clear");
                }}
              >
                <BroomIcon size={24} /> Bersihkan Pesan
              </button>
              <hr />
              {!page.blocked && (
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirm("block");
                  }}
                >
                  <BanIcon size={24} /> Blokir Pesan
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirm("delete");
                }}
              >
                <TrashIcon size={24} /> Hapus Percakapan
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="ch-msgs" ref={listRef} onScroll={onScroll}>
        {page.hasOlder && (
          <p className="ch-older">
            {loadingOlder ? "" : "Gulir ke atas untuk pesan lama"}
          </p>
        )}
        {messages.map((m) => {
          const isRead =
            m.mine && (m.read || (readUpTo != null && m.id <= readUpTo));
          return (
            <div
              key={m.id}
              className={`ch-bubble ${m.mine ? "mine" : "theirs"}`}
            >
              <p>{m.text}</p>
              <span className="ch-meta">
                {timeText(m.sentAt)}
                {isRead && <b>Dibaca</b>}
              </span>
            </div>
          );
        })}
      </div>

      {notice && (
        <div className="ch-notice" role="alert">
          {notice}
        </div>
      )}

      {page.blocked ? (
        <div className="ch-blocked">
          <p className="ch-blocked-text">
            <BanIcon size={16} /> Anda telah memblokir player ini. Ketuk untuk
            membuka blokir.
          </p>
          <div className="ch-blocked-actions">
            <button
              type="button"
              className="ch-blk-btn danger"
              onClick={() => setConfirm("delete")}
              disabled={busy}
            >
              <TrashIcon size={18} /> Hapus percakapan
            </button>
            <button
              type="button"
              className="ch-blk-btn"
              onClick={unblock}
              disabled={busy}
            >
              <UnlockIcon size={18} /> Buka blokir
            </button>
          </div>
        </div>
      ) : (
        <form className="ch-compose" onSubmit={submit}>
          <div className="ch-input-wrap">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              placeholder="Tulis pesan..."
              maxLength={MAX_LEN}
              autoComplete="off"
            />
            {text.length > 0 && (
              <small className={text.length >= MAX_LEN ? "limit" : ""}>
                {text.length}/{MAX_LEN}
              </small>
            )}
          </div>
          <button type="submit" className="ch-send" disabled={sending}>
            KIRIM <SendIcon size={15} />
          </button>
        </form>
      )}

      {dlg && (
        <ConfirmDialog
          title={dlg.title}
          description={dlg.description}
          confirmLabel={dlg.label}
          icon={dlg.icon}
          busy={busy}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </section>
  );
}

export default ChatWindow;
