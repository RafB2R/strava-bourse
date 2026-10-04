import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { T, T as TLive, avatarColors } from "../theme";
import { badgeFromData } from "../badges";
import { MOMENTS, MOMENT_TYPES, isMoment, momentSentence } from "../moments";

function Avatar({ name, size = 36 }) {
  const initials = name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2) : "?";
  const [bg, color] = avatarColors(name);
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size*0.33, fontWeight: 700, flexShrink: 0 }}>{initials}</div>;
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

const ACTIVITY_TYPES = ["new_position","renforcement","vente","allegement","dividende","coupon","versement","retrait","rebalancement","suppression_position","new_broker"];
const BADGE_TYPES = ["badge"];

function getActivityMeta(activity) {
  const d = activity.data || {};
  const name = activity.author?.full_name || "Quelqu'un";
  const badge = badgeFromData(d);
  if (isMoment(activity.type)) {
    const m = MOMENTS[activity.type];
    return { tag: m.tag, tagBg: "rgba(240,215,0,0.1)", tagColor: T.gold, title: momentSentence(activity.type, d, name), sub: m.sub?.(d) || "", stat: m.stat?.(d) || "" };
  }
  const map = {
    new_position: { tag: "Nouvelle position", tagBg: "rgba(123,184,240,0.1)", tagColor: T.blue, title: `${name} a ajouté une nouvelle position`, sub: d.label, stat: `${d.exposition || d.vehicule || ""}${d.broker ? ` · ${d.broker}` : ""}${d.percentage ? ` · ${d.percentage}%` : ""}` },
    renforcement: { tag: "Renforcement", tagBg: T.accentBg, tagColor: T.accent, title: `${name} a renforcé une position`, sub: d.label, stat: "" },
    vente: { tag: "Vente", tagBg: "rgba(240,153,123,0.1)", tagColor: T.orange, title: `${name} a vendu une position`, sub: d.label, stat: "" },
    allegement: { tag: "Allègement", tagBg: "rgba(240,153,123,0.1)", tagColor: T.orange, title: `${name} a allégé une position`, sub: d.label, stat: "" },
    dividende: { tag: "Dividende 💰", tagBg: "rgba(240,203,123,0.1)", tagColor: T.yellow, title: `${name} a reçu un dividende`, sub: d.label, stat: "" },
    coupon: { tag: "Coupon", tagBg: "rgba(240,203,123,0.1)", tagColor: T.yellow, title: `${name} a reçu un coupon`, sub: d.label, stat: "" },
    versement: { tag: "Versement", tagBg: T.accentBg, tagColor: T.accent, title: `${name} a effectué un versement`, sub: d.broker, stat: "" },
    retrait: { tag: "Retrait", tagBg: "rgba(240,153,123,0.1)", tagColor: T.orange, title: `${name} a effectué un retrait`, sub: d.broker, stat: "" },
    rebalancement: { tag: "Rééquilibrage", tagBg: "rgba(240,203,123,0.1)", tagColor: T.yellow, title: `${name} a rééquilibré son portefeuille`, sub: "", stat: "" },
    suppression_position: { tag: "Position supprimée", tagBg: "rgba(128,128,128,0.1)", tagColor: "#888", title: `${name} a supprimé une position`, sub: d.label, stat: "" },
    new_broker: { tag: "Nouveau broker", tagBg: "rgba(175,169,236,0.1)", tagColor: T.purple, title: `${name} a ajouté un broker`, sub: d.broker, stat: "" },
    badge: { tag: "Badge 🏅", tagBg: "rgba(240,215,0,0.08)", tagColor: T.gold, title: `${name} a débloqué un badge`, sub: badge.category, stat: `${badge.medal} ${badge.name}` },
  };
  return map[activity.type] || { tag: "Activité", tagBg: "rgba(128,128,128,0.1)", tagColor: "#888", title: `${name} a eu une activité`, sub: "", stat: "" };
}

const FILTERS = [
  { id: "all", label: "Tout" },
  { id: "activite", label: "Activité" },
  { id: "moments", label: "Moments" },
  { id: "badges", label: "Badges 🏅" },
];

const COMMENT_COLUMNS = "id, activity_id, user_id, content, created_at, author:profiles!activity_comments_user_id_fkey(full_name)";

// Amis acceptés (moi inclus), activités à afficher selon le périmètre, avec leurs likes et commentaires
async function fetchFeed(userId, scope) {
  const { data: friendships } = await supabase.from("friendships").select("requester_id, receiver_id").eq("status", "accepted").or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
  const ids = [userId];
  if (friendships) friendships.forEach(f => {
    if (f.requester_id !== userId) ids.push(f.requester_id);
    if (f.receiver_id !== userId) ids.push(f.receiver_id);
  });
  let query = supabase.from("activities").select("*, author:profiles!activities_user_id_fkey(full_name, username)").order("created_at", { ascending: false }).limit(100);
  if (scope === "amis") query = query.in("user_id", ids);
  const { data } = await query;
  const activities = data || [];

  // Likes et commentaires des activités affichées
  const likes = {}, comments = {};
  const activityIds = activities.map(a => a.id);
  if (activityIds.length > 0) {
    const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
      supabase.from("activity_likes").select("activity_id, user_id").in("activity_id", activityIds),
      supabase.from("activity_comments").select(COMMENT_COLUMNS).in("activity_id", activityIds).order("created_at"),
    ]);
    for (const l of likeRows || []) {
      const entry = likes[l.activity_id] ||= { count: 0, mine: false };
      entry.count++;
      if (l.user_id === userId) entry.mine = true;
    }
    for (const c of commentRows || []) (comments[c.activity_id] ||= []).push(c);
  }
  return { ids, activities, likes, comments };
}

export default function Feed({ session, T: TProp, onViewProfile }) {
  const T = TProp || TLive;
  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, boxShadow: T.cardShadow, padding: "1.25rem", marginBottom: 12 };
  const btnAct = { background: "none", border: `0.5px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" };

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [scope, setScope] = useState("amis");
  const [friendIds, setFriendIds] = useState([]);
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState({});
  const [openComment, setOpenComment] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [postInput, setPostInput] = useState("");
  const [posting, setPosting] = useState(false);
  const [profile, setProfile] = useState(null);

  const [reloadKey, setReloadKey] = useState(0);
  const userId = session.user.id;

  useEffect(() => {
    let ignore = false;
    supabase.from("profiles").select("full_name").eq("id", userId).single()
      .then(({ data }) => { if (!ignore) setProfile(data); });
    return () => { ignore = true; };
  }, [userId]);

  useEffect(() => {
    let ignore = false;
    fetchFeed(userId, scope).then(({ ids, activities, likes, comments }) => {
      if (ignore) return;
      setFriendIds(ids);
      setActivities(activities);
      setLikes(likes);
      setComments(comments);
      setLoading(false);
    });
    return () => { ignore = true; };
  }, [userId, scope, reloadKey]);

  async function publishPost() {
    if (!postInput.trim() || posting) return;
    setPosting(true);
    await supabase.from("activities").insert({ user_id: session.user.id, type: "post", data: { content: postInput.trim() } });
    setPostInput("");
    setPosting(false);
    setReloadKey(k => k + 1);
  }

  const likePending = useRef(new Set());

  async function notify(toUserId, type, data) {
    if (toUserId === userId) return;
    await supabase.from("notifications").insert({ user_id: toUserId, type, data: { from_name: profile?.full_name, from_id: userId, ...data } });
  }

  // Mise à jour immédiate à l'écran, annulée si Supabase refuse
  async function toggleLike(activity) {
    const id = activity.id;
    if (likePending.current.has(id)) return;
    likePending.current.add(id);
    const current = likes[id] || { count: 0, mine: false };
    setLikes(p => ({ ...p, [id]: { count: current.count + (current.mine ? -1 : 1), mine: !current.mine } }));
    const { error } = current.mine
      ? await supabase.from("activity_likes").delete().eq("activity_id", id).eq("user_id", userId)
      : await supabase.from("activity_likes").insert({ activity_id: id, user_id: userId });
    likePending.current.delete(id);
    if (error) { setLikes(p => ({ ...p, [id]: current })); return; }
    if (!current.mine) notify(activity.user_id, "activity_like", { activity_id: id });
  }

  function toggleComment(id) { setOpenComment(p => ({ ...p, [id]: !p[id] })); }

  async function addComment(activity) {
    const id = activity.id;
    const text = (commentInputs[id] || "").trim();
    if (!text) return;
    setCommentInputs(p => ({ ...p, [id]: "" }));
    const { data, error } = await supabase.from("activity_comments").insert({ activity_id: id, user_id: userId, content: text }).select(COMMENT_COLUMNS).single();
    if (error) { setCommentInputs(p => ({ ...p, [id]: text })); return; }
    setComments(p => ({ ...p, [id]: [...(p[id] || []), data] }));
    notify(activity.user_id, "activity_comment", { activity_id: id, excerpt: text.slice(0, 80) });
  }

  async function deleteComment(activityId, commentId) {
    const { error } = await supabase.from("activity_comments").delete().eq("id", commentId);
    if (!error) setComments(p => ({ ...p, [activityId]: (p[activityId] || []).filter(c => c.id !== commentId) }));
  }

  const visible = activities.filter(a => {
    if (filter === "all") return true;
    if (filter === "activite") return ACTIVITY_TYPES.includes(a.type);
    if (filter === "moments") return MOMENT_TYPES.includes(a.type);
    if (filter === "badges") return BADGE_TYPES.includes(a.type);
    return true;
  });



  return (
    <div>
      {/* Encadré publier */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Avatar name={profile?.full_name} size={36} />
          <div style={{ flex: 1 }}>
            <textarea
              value={postInput}
              onChange={e => setPostInput(e.target.value)}
              placeholder="Partage une pensée, une analyse, une question…"
              style={{ width: "100%", background: "none", border: "none", outline: "none", color: T.text, fontFamily: "inherit", fontSize: 14, resize: "none", lineHeight: 1.5, minHeight: 60 }}
            />
            {postInput.trim() && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={publishPost} disabled={posting} style={{ background: T.accent, border: "none", borderRadius: 999, padding: "6px 18px", fontSize: 13, fontWeight: 700, color: T.onAccent, cursor: "pointer", fontFamily: "inherit" }}>
                  {posting ? "…" : "Publier"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scope */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["amis", "👥 Amis"], ["verio", "🌍 Verio"]].map(([id, label]) => (
          <button key={id} onClick={() => { if (id !== scope) { setLoading(true); setScope(id); } }} style={{ padding: "5px 14px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${scope === id ? T.accent : T.border}`, background: scope === id ? T.accentBg : "none", color: scope === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${filter === f.id ? T.accent : T.border}`, background: filter === f.id ? T.accentBg : "none", color: filter === f.id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "2rem" }}>Chargement…</div>}

      {!loading && visible.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: "2.5rem 1rem" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>
            {scope === "amis" && friendIds.length <= 1 ? "Ajoute des amis pour voir leurs investissements" : "Aucune activité dans cette catégorie"}
          </div>
          <div style={{ fontSize: 13, color: T.textFaint, lineHeight: 1.6 }}>
            {scope === "amis" && friendIds.length <= 1 ? "Va dans Explore pour trouver des investisseurs" : "Les activités apparaîtront ici automatiquement"}
          </div>
        </div>
      )}

      {visible.map(activity => {
        const meta = activity.type === "post"
          ? { tag: "Post", tagBg: "rgba(175,169,236,0.1)", tagColor: T.purple, title: null, sub: null, stat: null }
          : getActivityMeta(activity);
        const isMe = activity.user_id === session.user.id;
        const activityComments = comments[activity.id] || [];
        const like = likes[activity.id] || { count: 0, mine: false };

        return (
          <div key={activity.id} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Avatar name={activity.author?.full_name} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, cursor: "pointer" }} onClick={() => onViewProfile && onViewProfile(activity.user_id)}>
                  {activity.author?.full_name}
                  {isMe && <span style={{ fontSize: 11, color: T.textFaint, marginLeft: 6 }}>· moi</span>}
                </div>
                <div style={{ fontSize: 12, color: T.textFaint }}>{timeAgo(activity.created_at)}</div>
              </div>
              <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: meta.tagBg, color: meta.tagColor }}>{meta.tag}</span>
            </div>

            {activity.type === "post" ? (
              <div style={{ fontSize: 14, color: T.text, lineHeight: 1.6, marginBottom: 12 }}>
                {activity.data?.content}
              </div>
            ) : (
              <div style={{ borderLeft: `2px solid ${T.border}`, paddingLeft: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.4 }}>{meta.title}</div>
                {meta.sub && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 3 }}>{meta.sub}</div>}
                {meta.stat && <span style={{ display: "inline-block", marginTop: 8, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500, background: meta.tagBg, color: meta.tagColor }}>{meta.stat}</span>}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => toggleLike(activity)} style={{ ...btnAct, ...(like.mine ? { borderColor: T.accent, color: T.accent } : {}) }}>
                👍 {like.mine ? "Liké" : "Like"}{like.count > 0 ? ` · ${like.count}` : ""}
              </button>
              <button onClick={() => toggleComment(activity.id)} style={btnAct}>
                💬 {activityComments.length > 0 ? activityComments.length : "Commenter"}
              </button>
            </div>

            {openComment[activity.id] && (
              <div style={{ marginTop: 12, borderTop: `0.5px solid ${T.border}`, paddingTop: 10 }}>
                {activityComments.map(c => (
                  <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <Avatar name={c.author?.full_name} size={26} />
                    <div style={{ background: T.bgSubtle, borderRadius: 8, padding: "7px 10px", flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, cursor: "pointer" }} onClick={() => onViewProfile && onViewProfile(c.user_id)}>{c.author?.full_name || "Investisseur"}</div>
                        <div style={{ fontSize: 11, color: T.textFaint, flex: 1 }}>{timeAgo(c.created_at)}</div>
                        {(c.user_id === userId || isMe) && (
                          <button onClick={() => deleteComment(activity.id, c.id)} title="Supprimer" style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: T.text, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.content}</div>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Avatar name={profile?.full_name} size={26} />
                  <input
                    value={commentInputs[activity.id] || ""}
                    onChange={e => setCommentInputs(p => ({ ...p, [activity.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addComment(activity)}
                    placeholder="Commenter…"
                    maxLength={1000}
                    style={{ flex: 1, padding: "7px 10px", fontSize: 13, borderRadius: 8, border: `0.5px solid ${T.border}`, background: T.bgCard, color: T.text, fontFamily: "inherit" }}
                  />
                  <button onClick={() => addComment(activity)} style={{ ...btnAct, padding: "7px 12px" }}>↵</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
