import { useState, useEffect, useCallback } from "react";
import { T as TLive } from "../theme";
import { Thread } from "./Messages";
import Avatar from "./Avatar";
import { shortTime, fetchConversations, startConversation, fetchFriends } from "../messages";

const BAR_WIDTH = 300;

// Messagerie en encart, en bas à droite de l'écran (ordinateur), façon LinkedIn :
// une barre « Messagerie » qui s'ouvre sur la liste, et la conversation en cours
// dans une fenêtre à côté, qu'on peut réduire ou fermer en continuant à naviguer.
export default function ChatDock({ session, T: TProp, open, onToggle, target, onTargetHandled, onViewProfile, onUnreadChange }) {
  const T = TProp || TLive;
  const me = session.user.id;
  const [conversations, setConversations] = useState(null);
  const [active, setActive] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const [picking, setPicking] = useState(false);
  const [friends, setFriends] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  // Liste : au chargement, après lecture, puis toutes les 30 s
  useEffect(() => {
    let ignore = false;
    const refresh = () => fetchConversations().then(list => {
      if (ignore) return;
      setConversations(list);
      onUnreadChange?.(list.reduce((s, c) => s + (c.unread || 0), 0));
    });
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { ignore = true; clearInterval(timer); };
  }, [reloadKey, onUnreadChange]);

  const openConversation = useCallback(async (friendId) => {
    setError("");
    const { id, error: err } = await startConversation(friendId);
    if (err) { setError("Tu ne peux écrire qu'à tes amis."); return; }
    const list = await fetchConversations();
    setConversations(list);
    setPicking(false);
    setMinimized(false);
    setActive(list.find(c => c.conversation_id === id) || null);
  }, []);

  // « ✉️ Message » depuis un profil : ouvre directement la fenêtre de discussion.
  // La cible n'est effacée qu'une fois la conversation ouverte (sinon l'effet serait annulé).
  useEffect(() => {
    if (!target) return;
    let ignore = false;
    startConversation(target).then(async ({ id, error: err }) => {
      if (ignore) return;
      if (err) { setError("Tu ne peux écrire qu'à tes amis."); onTargetHandled?.(); return; }
      const list = await fetchConversations();
      if (ignore) return;
      setConversations(list);
      setPicking(false);
      setMinimized(false);
      setActive(list.find(c => c.conversation_id === id) || null);
      onTargetHandled?.();
    });
    return () => { ignore = true; };
  }, [target, onTargetHandled]);

  useEffect(() => {
    if (!picking || friends) return;
    let ignore = false;
    fetchFriends(me).then(list => { if (!ignore) setFriends(list); });
    return () => { ignore = true; };
  }, [picking, friends, me]);

  const unread = (conversations || []).reduce((s, c) => s + (c.unread || 0), 0);
  const panel = { background: T.bgSecondary, border: `1px solid ${T.border}`, borderBottom: "none", boxShadow: "0 -4px 24px rgba(0,0,0,0.18)", borderRadius: "12px 12px 0 0" };
  const rowBtn = { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" };

  return (
    <>
      {/* Fenêtre de la conversation en cours */}
      {active && (
        <div style={{ position: "fixed", bottom: 0, right: 16 + BAR_WIDTH + 12, width: 330, zIndex: 60 }}>
          <Thread key={active.conversation_id} conversation={active} session={session} T={T} variant="dock"
            minimized={minimized} onToggleMinimize={() => setMinimized(m => !m)}
            onClose={() => { setActive(null); reload(); }}
            onRead={reload} onViewProfile={onViewProfile} />
        </div>
      )}

      {/* Barre « Messagerie » et liste des conversations */}
      <div style={{ position: "fixed", bottom: 0, right: 16, width: BAR_WIDTH, zIndex: 60, ...panel }}>
        <button onClick={onToggle} aria-expanded={open} style={{ ...rowBtn, padding: "10px 12px", borderBottom: open ? `0.5px solid ${T.border}` : "none" }}>
          <span style={{ fontSize: 16 }}>💬</span>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: T.text }}>Messagerie</span>
          {unread > 0 && <span style={{ background: T.red, color: T.bg, borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>{unread}</span>}
          <span style={{ fontSize: 13, color: T.textMuted }}>{open ? "▾" : "▴"}</span>
        </button>

        {open && (
          <div style={{ height: 380, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 12px", borderBottom: `0.5px solid ${T.border}` }}>
              <button onClick={() => setPicking(p => !p)} style={{ width: "100%", background: picking ? "none" : T.accent, color: picking ? T.textMuted : T.onAccent, border: picking ? `0.5px solid ${T.border}` : "none", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {picking ? "Annuler" : "✉️ Nouveau message"}
              </button>
              {error && <div style={{ fontSize: 12, color: T.red, marginTop: 6 }}>{error}</div>}
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {picking ? (
                <>
                  {friends === null && <div style={{ fontSize: 12, color: T.textFaint, padding: 12 }}>Chargement…</div>}
                  {friends?.length === 0 && <div style={{ fontSize: 12, color: T.textFaint, padding: 12 }}>Ajoute des amis depuis Explore pour pouvoir leur écrire.</div>}
                  {friends?.map(f => (
                    <button key={f.id} onClick={() => openConversation(f.id)} style={rowBtn}>
                      <Avatar userId={f.id} name={f.full_name} size={30} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{f.full_name}</span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {conversations === null && <div style={{ fontSize: 12, color: T.textFaint, padding: 12 }}>Chargement…</div>}
                  {conversations?.length === 0 && <div style={{ fontSize: 12, color: T.textFaint, padding: 12, lineHeight: 1.5 }}>Aucune conversation. Écris à un ami avec « Nouveau message » ou depuis son profil.</div>}
                  {conversations?.map(c => (
                    <button key={c.conversation_id} onClick={() => { setActive(c); setMinimized(false); }}
                      style={{ ...rowBtn, background: active?.conversation_id === c.conversation_id ? T.accentBg : "none" }}>
                      <Avatar userId={c.other_id} name={c.other_name} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: c.unread ? 800 : 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.other_name}</span>
                          {c.last_message && <span style={{ fontSize: 10, color: T.textFaint, flexShrink: 0 }}>{shortTime(c.last_message_at)}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ flex: 1, fontSize: 12, color: c.unread ? T.text : T.textMuted, fontWeight: c.unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.last_message ? `${c.last_sender_id === me ? "Toi : " : ""}${c.last_message}` : "Nouvelle conversation"}
                          </span>
                          {c.unread > 0 && <span style={{ background: T.accent, color: T.onAccent, borderRadius: 999, fontSize: 10, fontWeight: 700, padding: "0 6px" }}>{c.unread}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
