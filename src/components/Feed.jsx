import { useState, useEffect } from "react";
import ProfilPublic from "./ProfilPublic";
import { supabase } from "../supabase";
import { themes } from "../App";

const PALETTE = ["rgba(159,225,203,0.12)|#9FE1CB","rgba(240,153,123,0.12)|#F0997B","rgba(175,169,236,0.12)|#AFA9EC","rgba(123,184,240,0.12)|#7BB8F0","rgba(240,203,123,0.12)|#F0CB7B"];
function Avatar({ name, size = 36 }) {
  const initials = name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2) : "?";
  const [bg, color] = PALETTE[name?.charCodeAt(0) % PALETTE.length || 0].split("|");
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
const MOMENT_TYPES = ["portfolio_complete","premier_etf","premiere_action","premier_dividende","dca_1m","dca_3m","dca_6m","dca_1a","10_positions","nouveau_plus_haut","anniversaire_1a","anniversaire_3a","anniversaire_5a"];
const BADGE_TYPES = ["badge"];

function getActivityMeta(activity) {
  const d = activity.data || {};
  const name = activity.author?.full_name || "Quelqu'un";
  const map = {
    new_position: { tag: "Nouvelle position", tagBg: "rgba(123,184,240,0.1)", tagColor: "#7BB8F0", title: `${name} a ajouté une nouvelle position`, sub: d.label, stat: `${d.exposition || d.vehicule || ""}${d.broker ? ` · ${d.broker}` : ""}${d.percentage ? ` · ${d.percentage}%` : ""}` },
    renforcement: { tag: "Renforcement", tagBg: "rgba(159,225,203,0.1)", tagColor: "#9FE1CB", title: `${name} a renforcé une position`, sub: d.label, stat: "" },
    vente: { tag: "Vente", tagBg: "rgba(240,153,123,0.1)", tagColor: "#F0997B", title: `${name} a vendu une position`, sub: d.label, stat: "" },
    allegement: { tag: "Allègement", tagBg: "rgba(240,153,123,0.1)", tagColor: "#F0997B", title: `${name} a allégé une position`, sub: d.label, stat: "" },
    dividende: { tag: "Dividende 💰", tagBg: "rgba(240,203,123,0.1)", tagColor: "#F0CB7B", title: `${name} a reçu un dividende`, sub: d.label, stat: "" },
    coupon: { tag: "Coupon", tagBg: "rgba(240,203,123,0.1)", tagColor: "#F0CB7B", title: `${name} a reçu un coupon`, sub: d.label, stat: "" },
    versement: { tag: "Versement", tagBg: "rgba(159,225,203,0.1)", tagColor: "#9FE1CB", title: `${name} a effectué un versement`, sub: d.broker, stat: "" },
    retrait: { tag: "Retrait", tagBg: "rgba(240,153,123,0.1)", tagColor: "#F0997B", title: `${name} a effectué un retrait`, sub: d.broker, stat: "" },
    rebalancement: { tag: "Rééquilibrage", tagBg: "rgba(240,203,123,0.1)", tagColor: "#F0CB7B", title: `${name} a rééquilibré son portefeuille`, sub: "", stat: "" },
    suppression_position: { tag: "Position supprimée", tagBg: "rgba(128,128,128,0.1)", tagColor: "#888", title: `${name} a supprimé une position`, sub: d.label, stat: "" },
    new_broker: { tag: "Nouveau broker", tagBg: "rgba(175,169,236,0.1)", tagColor: "#AFA9EC", title: `${name} a ajouté un broker`, sub: d.broker, stat: "" },
    portfolio_complete: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} a complété son portefeuille à 100%`, sub: "", stat: "100% alloué" },
    premier_etf: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} a acheté son premier ETF`, sub: d.label, stat: "" },
    premier_dividende: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} a reçu son premier dividende`, sub: "", stat: "" },
    dca_1m: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} atteint 1 mois d'investissement régulier`, sub: "", stat: "1 mois" },
    dca_3m: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} atteint 3 mois d'investissement régulier`, sub: "", stat: "3 mois" },
    dca_6m: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} atteint 6 mois d'investissement régulier`, sub: "", stat: "6 mois" },
    dca_1a: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} atteint 1 an d'investissement régulier`, sub: "", stat: "12 mois" },
    "10_positions": { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} détient maintenant 10 positions`, sub: "", stat: "10 positions" },
    nouveau_plus_haut: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} atteint un nouveau plus haut`, sub: "", stat: "" },
    anniversaire_1a: { tag: "Anniversaire 🎂", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} fête 1 an en tant qu'investisseur`, sub: "", stat: "1 an" },
    anniversaire_3a: { tag: "Anniversaire 🎂", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} fête 3 ans en tant qu'investisseur`, sub: "", stat: "3 ans" },
    anniversaire_5a: { tag: "Anniversaire 🎂", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} fête 5 ans en tant qu'investisseur`, sub: "", stat: "5 ans" },
    badge: { tag: "Badge 🏅", tagBg: "rgba(240,215,0,0.08)", tagColor: "#FFD700", title: `${name} a débloqué un badge`, sub: d.badge_name, stat: d.badge_medal ? `${d.badge_medal} ${d.badge_name}` : "" },
  };
  return map[activity.type] || { tag: "Activité", tagBg: "rgba(128,128,128,0.1)", tagColor: "#888", title: `${name} a eu une activité`, sub: "", stat: "" };
}

const FILTERS = [
  { id: "all", label: "Tout" },
  { id: "activite", label: "Activité" },
  { id: "moments", label: "Moments" },
  { id: "badges", label: "Badges 🏅" },
];

export default function Feed({ session, T: TProp }) {
  const T = TProp || themes[localStorage.getItem("verio-theme") || "light"];
  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: "1.25rem", marginBottom: 12 };
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
  const [selectedUser, setSelectedUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => { loadProfile(); loadFriendsAndActivities(); }, []);
  useEffect(() => { loadFriendsAndActivities(); }, [scope]);

  async function loadProfile() {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
    setProfile(data);
  }

  async function loadFriendsAndActivities() {
    setLoading(true);
    const { data: friendships } = await supabase.from("friendships").select("requester_id, receiver_id").eq("status", "accepted").or(`requester_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`);
    const ids = [session.user.id];
    if (friendships) friendships.forEach(f => {
      if (f.requester_id !== session.user.id) ids.push(f.requester_id);
      if (f.receiver_id !== session.user.id) ids.push(f.receiver_id);
    });
    setFriendIds(ids);
    let query = supabase.from("activities").select("*, author:profiles!activities_user_id_fkey(full_name, username)").order("created_at", { ascending: false }).limit(100);
    if (scope === "amis") query = query.in("user_id", ids);
    const { data } = await query;
    setActivities(data || []);
    setLoading(false);
  }

  async function publishPost() {
    if (!postInput.trim() || posting) return;
    setPosting(true);
    await supabase.from("activities").insert({ user_id: session.user.id, type: "post", data: { content: postInput.trim() } });
    setPostInput("");
    setPosting(false);
    loadFriendsAndActivities();
  }

  function toggleLike(id) { setLikes(p => ({ ...p, [id]: !p[id] })); }
  function toggleComment(id) { setOpenComment(p => ({ ...p, [id]: !p[id] })); }
  function addComment(id) {
    const text = (commentInputs[id] || "").trim();
    if (!text) return;
    setComments(p => ({ ...p, [id]: [...(p[id] || []), { text, name: "Moi" }] }));
    setCommentInputs(p => ({ ...p, [id]: "" }));
  }

  const visible = activities.filter(a => {
    if (filter === "all") return true;
    if (filter === "activite") return ACTIVITY_TYPES.includes(a.type);
    if (filter === "moments") return MOMENT_TYPES.includes(a.type);
    if (filter === "badges") return BADGE_TYPES.includes(a.type);
    return true;
  });

  if (selectedUser) return <ProfilPublic userId={selectedUser} session={session} T={T} onBack={() => setSelectedUser(null)} />;

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
                <button onClick={publishPost} disabled={posting} style={{ background: T.accent, border: "none", borderRadius: 999, padding: "6px 18px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
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
          <button key={id} onClick={() => setScope(id)} style={{ padding: "5px 14px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${scope === id ? T.accent : T.border}`, background: scope === id ? T.accentBg : "none", color: scope === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
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
          ? { tag: "Post", tagBg: "rgba(175,169,236,0.1)", tagColor: "#AFA9EC", title: null, sub: null, stat: null }
          : getActivityMeta(activity);
        const isMe = activity.user_id === session.user.id;
        const myComments = comments[activity.id] || [];

        return (
          <div key={activity.id} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Avatar name={activity.author?.full_name} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, cursor: "pointer" }} onClick={() => setSelectedUser(activity.user_id)}>
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
              <button onClick={() => toggleLike(activity.id)} style={{ ...btnAct, ...(likes[activity.id] ? { borderColor: T.accent, color: T.accent } : {}) }}>
                👍 {likes[activity.id] ? "Liké" : "Like"}
              </button>
              <button onClick={() => toggleComment(activity.id)} style={btnAct}>
                💬 {myComments.length > 0 ? myComments.length : "Commenter"}
              </button>
            </div>

            {openComment[activity.id] && (
              <div style={{ marginTop: 12, borderTop: `0.5px solid ${T.border}`, paddingTop: 10 }}>
                {myComments.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <Avatar name={c.name} size={26} />
                    <div style={{ background: T.bgCard, borderRadius: 8, padding: "7px 10px", flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>{c.text}</div>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Avatar name="Moi" size={26} />
                  <input
                    value={commentInputs[activity.id] || ""}
                    onChange={e => setCommentInputs(p => ({ ...p, [activity.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addComment(activity.id)}
                    placeholder="Commenter…"
                    style={{ flex: 1, padding: "7px 10px", fontSize: 13, borderRadius: 8, border: `0.5px solid ${T.border}`, background: T.bgCard, color: T.text, fontFamily: "inherit" }}
                  />
                  <button onClick={() => addComment(activity.id)} style={{ ...btnAct, padding: "7px 12px" }}>↵</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
