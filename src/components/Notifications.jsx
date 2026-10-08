import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { T as TLive } from "../theme";
import { badgeFromData } from "../badges";
import { momentNotification } from "../moments";
import { closeFinishedPolls, pollEndedText } from "../polls";
import Icon from "./Icon";
import { t } from "../i18n";

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return t("à l'instant");
  if (diff < 3600) return t("il y a {n} min", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("il y a {n}h", { n: Math.floor(diff / 3600) });
  return t("il y a {n} j", { n: Math.floor(diff / 86400) });
}

function getNotifMeta(notif) {
  const d = notif.data || {};
  switch (notif.type) {
    case "friend_request": return { icon: "👥", text: t("{name} t'a envoyé une demande d'ami", { name: d.from_name }) };
    case "friend_accepted": return { icon: "🤝", text: t("{name} a accepté ta demande d'ami", { name: d.from_name }) };
    case "badge_unlocked": { const info = badgeFromData(d); return { icon: info.medal, text: t("Tu as débloqué le badge {badge}", { badge: info.name }) }; }
    case "activity_like": return { icon: "👍", text: t("{name} a aimé ton activité", { name: d.from_name }) };
    case "activity_comment": return { icon: "💬", text: t("{name} a commenté : « {excerpt} »", { name: d.from_name, excerpt: d.excerpt }) };
    case "moment": return { icon: d.moment_id?.startsWith("anniversaire") ? "🎂" : "🌟", text: momentNotification(d.moment_id) };
    case "mention": return { icon: "💬", text: t("{name} t'a mentionné : « {excerpt} »", { name: d.from_name, excerpt: d.excerpt }) };
    case "poll_ended": return { icon: "📊", text: pollEndedText(d) };
    case "super_filing": return { icon: "🏛️", text: t(d.moves > 1 ? "{name} a publié ses mouvements du trimestre : {n} changements" : "{name} a publié ses mouvements du trimestre : {n} changement", { name: d.name || t("Une légende"), n: d.moves ?? 0 }) };
    case "post_reaction": return { icon: d.reaction || "👍", text: t("{name} a réagi à ton post", { name: d.from_name }) };
    default: return { icon: "🔔", text: t("Nouvelle notification") };
  }
}

// « onOpen(notif) » : ouvre ce dont parle la notification (post, profil, club, badges…)
export default function Notifications({ session, T: TProp, onOpen }) {
  const T = TProp || TLive;
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const [reloadKey, setReloadKey] = useState(0);
  const userId = session.user.id;

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Recharge au montage et à chaque ouverture du panneau (reloadKey)
  useEffect(() => {
    let ignore = false;
    closeFinishedPolls()
      .then(() => supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20))
      .then(({ data }) => {
        if (ignore) return;
        setNotifs(data || []);
        setUnread((data || []).filter(n => !n.read).length);
      });
    return () => { ignore = true; };
  }, [userId, reloadKey]);

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
        onClick={() => { setOpen(p => !p); if (!open) setReloadKey(k => k + 1); }}
        style={{ background: "none", border: `0.5px solid ${T.borderStrong}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", position: "relative", display: "flex", alignItems: "center", gap: 4 }}
      >
        <Icon name="bell" size={16} style={{ color: T.textMuted }} />
        {unread > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, background: T.red, color: T.bg, borderRadius: "50%", width: 16, height: 16, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "fixed", top: 60, right: 16, width: 320, background: T.bgSecondary, border: `0.5px solid ${T.border}`, borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", zIndex: 100, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: `0.5px solid ${T.border}` }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{t("Notifications")}</span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background: "none", border: "none", fontSize: 12, color: T.accent, cursor: "pointer", fontFamily: "inherit" }}>
                {t("Tout marquer lu")}
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {notifs.length === 0 && (
              <div style={{ padding: "2rem", textAlign: "center", fontSize: 13, color: T.textFaint }}>{t("Aucune notification")}</div>
            )}
            {notifs.map(notif => {
              const meta = getNotifMeta(notif);
              return (
                <div key={notif.id} role="button" tabIndex={0}
                  onClick={() => { if (!notif.read) markRead(notif.id); setOpen(false); onOpen?.(notif); }}
                  onKeyDown={e => { if (e.key === "Enter") { if (!notif.read) markRead(notif.id); setOpen(false); onOpen?.(notif); } }}
                  style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: `0.5px solid ${T.border}`, background: notif.read ? "none" : T.accentBg, cursor: "pointer" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.bgSubtle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, color: T.textMuted }}>
                    <Icon emoji={meta.icon} size={16} />
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
