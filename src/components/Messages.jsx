import { useState, useEffect, useRef, useCallback } from "react";
import { T as TLive, avatarColors } from "../theme";
import { fetchConversations, fetchMessages, sendMessage, markRead, startConversation, subscribeToConversation, fetchFriends } from "../messages";

function Avatar({ name, size = 40 }) {
  const initials = name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?";
  const [bg, color] = avatarColors(name);
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 700, flexShrink: 0 }}>{initials}</div>;
}

function shortTime(date) {
  const d = new Date(date), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const days = (now - d) / 86400000;
  if (days < 7) return d.toLocaleDateString("fr-FR", { weekday: "short" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Fil d'une conversation : messages en temps réel, envoi, lecture
function Thread({ conversation, session, T, onBack, onViewProfile, onRead }) {
  const me = session.user.id;
  const [messages, setMessages] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const convId = conversation.conversation_id;

  useEffect(() => {
    let ignore = false;
    fetchMessages(convId).then(list => { if (!ignore) setMessages(list); });
    markRead(convId).then(onRead);
    const unsubscribe = subscribeToConversation(convId, msg => {
      setMessages(prev => (prev && !prev.some(m => m.id === msg.id) ? [...prev, msg] : prev));
      if (msg.sender_id !== me) markRead(convId).then(onRead);
    });
    return () => { ignore = true; unsubscribe(); };
  }, [convId, me, onRead]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true); setError("");
    const { message, error: err } = await sendMessage(convId, me, text);
    setSending(false);
    if (err) { setError("Message non envoyé : vous n'êtes peut-être plus amis."); return; }
    setInput("");
    setMessages(prev => (prev.some(m => m.id === message.id) ? prev : [...prev, message]));
  }

  return (
    <div style={{ background: T.bgCard, border: `0.5px solid ${T.border}`, boxShadow: T.cardShadow, borderRadius: 14, display: "flex", flexDirection: "column", height: "min(70vh, 640px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `0.5px solid ${T.border}` }}>
        <button onClick={onBack} aria-label="Retour aux conversations" style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 18, padding: "0 4px" }}>←</button>
        <Avatar name={conversation.other_name} size={34} />
        <button onClick={() => onViewProfile?.(conversation.other_id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{conversation.other_name}</div>
          {conversation.other_username && <div style={{ fontSize: 12, color: T.textFaint }}>@{conversation.other_username}</div>}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: 6 }}>
        {messages === null && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", margin: "auto" }}>Chargement…</div>}
        {messages?.length === 0 && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", margin: "auto" }}>Aucun message. Dis bonjour 👋</div>}
        {messages?.map((m, i) => {
          const mine = m.sender_id === me;
          const prev = messages[i - 1];
          const showTime = !prev || new Date(m.created_at) - new Date(prev.created_at) > 15 * 60000;
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
              {showTime && <div style={{ fontSize: 11, color: T.textFaint, alignSelf: "center", margin: "6px 0" }}>{shortTime(m.created_at)}</div>}
              <div style={{ maxWidth: "78%", padding: "8px 12px", borderRadius: 16, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, background: mine ? T.accent : T.bgSubtle, color: mine ? T.onAccent : T.text, fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: `0.5px solid ${T.border}`, padding: 10 }}>
        {error && <div style={{ fontSize: 12, color: T.red, marginBottom: 6 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={1} maxLength={2000} placeholder="Écris un message…"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            style={{ flex: 1, resize: "none", padding: "9px 12px", fontSize: 14, borderRadius: 18, border: `0.5px solid ${T.input.border}`, background: T.input.background, color: T.input.color, fontFamily: "inherit", maxHeight: 120 }} />
          <button onClick={send} disabled={sending || !input.trim()} aria-label="Envoyer"
            style={{ background: T.accent, color: T.onAccent, border: "none", borderRadius: 18, padding: "9px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: sending || !input.trim() ? 0.5 : 1 }}>
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

// openWith : identifiant d'un ami avec qui ouvrir directement la conversation
export default function Messages({ session, T: TProp, openWith, onOpened, onViewProfile, onUnreadChange }) {
  const T = TProp || TLive;
  const me = session.user.id;
  const [conversations, setConversations] = useState(null);
  const [active, setActive] = useState(null);
  const [picking, setPicking] = useState(false);
  const [friends, setFriends] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  // Stable : le fil s'en sert dans son effet d'abonnement temps réel
  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    let ignore = false;
    fetchConversations().then(list => {
      if (ignore) return;
      setConversations(list);
      onUnreadChange?.(list.reduce((s, c) => s + (c.unread || 0), 0));
    });
    return () => { ignore = true; };
  }, [reloadKey, onUnreadChange]);

  // Ouverture directe depuis un profil (« ✉️ Message »)
  useEffect(() => {
    if (!openWith) return;
    let ignore = false;
    startConversation(openWith).then(async ({ id, error: err }) => {
      if (ignore) return;
      onOpened?.();
      if (err) { setError("Tu ne peux écrire qu'à tes amis."); return; }
      const list = await fetchConversations();
      if (ignore) return;
      setConversations(list);
      setActive(list.find(c => c.conversation_id === id) || null);
    });
    return () => { ignore = true; };
  }, [openWith, onOpened]);

  useEffect(() => {
    if (!picking || friends) return;
    let ignore = false;
    fetchFriends(me).then(list => { if (!ignore) setFriends(list); });
    return () => { ignore = true; };
  }, [picking, friends, me]);

  async function openFriend(friendId) {
    setError("");
    const { id, error: err } = await startConversation(friendId);
    if (err) { setError("Tu ne peux écrire qu'à tes amis."); return; }
    const list = await fetchConversations();
    setConversations(list);
    setPicking(false);
    setActive(list.find(c => c.conversation_id === id) || null);
  }

  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, boxShadow: T.cardShadow, borderRadius: 14, padding: "1.25rem", marginBottom: 12 };

  if (active) {
    return <Thread conversation={active} session={session} T={T} onViewProfile={onViewProfile}
      onBack={() => { setActive(null); reload(); }}
      onRead={reload} />;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Messages</div>
        <button onClick={() => setPicking(p => !p)} style={{ background: T.accent, color: T.onAccent, border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {picking ? "Fermer" : "✉️ Nouveau message"}
        </button>
      </div>
      {error && <div style={{ ...card, color: T.red, fontSize: 13 }}>{error}</div>}

      {picking && (
        <div style={card}>
          <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Écrire à un ami</div>
          {friends === null && <div style={{ fontSize: 13, color: T.textFaint }}>Chargement…</div>}
          {friends?.length === 0 && <div style={{ fontSize: 13, color: T.textFaint }}>Ajoute des amis depuis Explore pour pouvoir leur écrire.</div>}
          {friends?.map(f => (
            <button key={f.id} onClick={() => openFriend(f.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 0", background: "none", border: "none", borderTop: `0.5px solid ${T.border}`, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              <Avatar name={f.full_name} size={32} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{f.full_name}</div>
                {f.username && <div style={{ fontSize: 12, color: T.textFaint }}>@{f.username}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      <div style={card}>
        {conversations === null && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem" }}>Chargement…</div>}
        {conversations?.length === 0 && (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 4 }}>Aucune conversation pour l'instant</div>
            <div style={{ fontSize: 12, color: T.textFaint }}>Écris à un ami avec « Nouveau message » ou depuis son profil.</div>
          </div>
        )}
        {conversations?.map((c, i) => (
          <button key={c.conversation_id} onClick={() => setActive(c)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 0", background: "none", border: "none", borderTop: i === 0 ? "none" : `0.5px solid ${T.border}`, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
            <Avatar name={c.other_name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: c.unread ? 800 : 600, color: T.text }}>{c.other_name}</span>
                {c.last_message && <span style={{ fontSize: 11, color: T.textFaint, flexShrink: 0 }}>{shortTime(c.last_message_at)}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, fontSize: 13, color: c.unread ? T.text : T.textMuted, fontWeight: c.unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.last_message ? `${c.last_sender_id === me ? "Toi : " : ""}${c.last_message}` : "Nouvelle conversation"}
                </span>
                {c.unread > 0 && <span style={{ background: T.accent, color: T.onAccent, borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>{c.unread}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.textFaint, textAlign: "center" }}>🔒 Messages visibles uniquement par les participants. Tu ne peux écrire qu'à tes amis.</div>
    </div>
  );
}
