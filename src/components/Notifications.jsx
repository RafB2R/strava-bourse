import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { themes } from "../App";

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

function getNotifMeta(notif) {
  const d = notif.data || {};
  switch (notif.type) {
    case "friend_request": return { icon: "👥", text: `${d.from_name} t'a envoyé une demande d'ami` };
    case "friend_accepted": return { icon: "🤝", text: `${d.from_name} a accepté ta demande d'ami` };
    case "badge_unlocked": return { icon: d.badge_medal || "🏅", text: `Tu as débloqué le badge ${d.badge_name}` };
    case "post_reaction": return { icon: d.reaction || "👍", text: `${d.from_name} a réagi à ton post` };
    default: return { icon: "🔔", text: "Nouvelle notification" };
  }
}

export default function Notifications({ session, T: TProp }) {
  const T = TProp || themes[localStorage.getItem("verio-theme") || "light"];
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    loadNotifs();
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadNotifs() {
    const { data } = await supabase.from("notifications").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(20);
    setNotifs(data || []);
    setUnread((data || []).filter(n => !n.read).length);
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", session.user.id).eq("read", false);
    setNotifs(p => p.map(n => ({ ...n, read: true })));
    setUnread(0);
  }

  async function markRead(id) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(p => Math.max(0, p - 1));
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => { setOpen(p => !p); if (!open) loadNotifs(); }}
        style={{ background: "none", border: `0.5px solid ${T.borderStrong}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", position: "relative", display: "flex", alignItems: "center", gap: 4 }}
      >
        <span style={{ fontSize: 16 }}>🔔</span>
        {unread > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, background: T.red, color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "fixed", top: 60, right: 16, width: 320, background: T.bgSecondary, border: `0.5px solid ${T.border}`, borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", zIndex: 100, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: `0.5px solid ${T.border}` }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background: "none", border: "none", fontSize: 12, color: T.accent, cursor: "pointer", fontFamily: "inherit" }}>
                Tout marquer lu
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {notifs.length === 0 && (
              <div style={{ padding: "2rem", textAlign: "center", fontSize: 13, color: T.textFaint }}>Aucune notification</div>
            )}
            {notifs.map(notif => {
              const meta = getNotifMeta(notif);
              return (
                <div key={notif.id} onClick={() => !notif.read && markRead(notif.id)}
                  style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: `0.5px solid ${T.border}`, background: notif.read ? "none" : T.accentBg, cursor: notif.read ? "default" : "pointer" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.bgCard, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: notif.read ? T.textMuted : T.text, lineHeight: 1.4, marginBottom: 3 }}>{meta.text}</div>
                    <div style={{ fontSize: 11, color: T.textFaint }}>{timeAgo(notif.created_at)}</div>
                  </div>
                  {!notif.read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent, flexShrink: 0, marginTop: 6 }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
