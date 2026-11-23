import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import Icon from "../../components/icon";
import Avatar from "../../components/user/Avatar";
import ChatWindow from "../../components/chat/ChatWindow";
import NewChatModal from "../../components/chat/NewChatModal";
import { ChatBubbleIcon, NewChatIcon } from "../../components/chat/ChatIcons";

function Obrolan() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { chat } = useOutletContext();
  const [newOpen, setNewOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (chat.denied)
    return (
      <div className="ch-page">
        <h1 className="ch-title">Obrolan</h1>
        <p className="admin-message error">
          Kamu tidak punya akses ke fitur Obrolan.
        </p>
      </div>
    );

  return (
    <div className="ch-page">
      <h1 className="ch-title">Obrolan</h1>

      <div className={`ch-card ${id ? "has-chat" : ""}`}>
        <aside className="ch-list">
          <div className="ch-list-head">
            <h2>
              Daftar Percakapan <span>({chat.items.length})</span>
            </h2>
            <button
              type="button"
              className="ch-new"
              onClick={() => setNewOpen(true)}
            >
              <NewChatIcon size={15} /> Obrolan Baru
            </button>
          </div>

          <div className="ch-items">
            {!chat.loaded &&
              [0, 1, 2, 3, 4, 5].map((n) => (
                <div className="ch-item skel" key={n} aria-hidden="true">
                  <i className="ch-skel round" />
                  <i className="ch-skel line" />
                </div>
              ))}

            {chat.loaded && chat.error && chat.items.length === 0 && (
              <p className="ch-list-msg error">{chat.error}</p>
            )}

            {chat.loaded && !chat.error && chat.items.length === 0 && (
              <p className="ch-list-msg">Belum ada percakapan.</p>
            )}

            {chat.items.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`ch-item ${String(c.id) === id ? "active" : ""}`}
                onClick={() => navigate(`/obrolan/${c.id}`)}
              >
                <span className="ch-ava">
                  <Avatar
                    src={c.partner.avatar}
                    name={c.partner.username}
                    size={36}
                  />
                </span>
                <b>{c.partner.username}</b>
                {c.unread > 0 && (
                  <span className="ch-badge">
                    {c.unread > 99 ? "99+" : c.unread}
                  </span>
                )}
                <Icon name="chevron-right" size={14} />
              </button>
            ))}
          </div>
        </aside>

        {id ? (
          <ChatWindow key={id} id={id} chat={chat} onToast={setToast} />
        ) : (
          <section className="ch-pane">
            <div className="ch-empty">
              <span className="ch-empty-ic">
                <ChatBubbleIcon size={22} />
              </span>
              <b>Pilih yang ada di Daftar untuk mulai ngobrol</b>
              <span>Klik salah satu Card di daftar untuk membuka pesan</span>
            </div>
          </section>
        )}
      </div>

      {newOpen && (
        <NewChatModal
          onClose={() => setNewOpen(false)}
          onOpened={(page) => {
            setNewOpen(false);
            navigate(`/obrolan/${page.id}`, { state: { page } });
          }}
        />
      )}

      {toast && (
        <div className="ch-toast" role="alert">
          {toast}
        </div>
      )}
    </div>
  );
}

export default Obrolan;
