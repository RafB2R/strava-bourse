import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const card = { background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "1.25rem", marginBottom: 12 };
const btnAct = { background: "none", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" };

const PALETTE = ["rgba(159,225,203,0.12)|#9FE1CB", "rgba(240,153,123,0.12)|#F0997B", "rgba(175,169,236,0.12)|#AFA9EC", "rgba(123,184,240,0.12)|#7BB8F0", "rgba(240,203,123,0.12)|#F0CB7B"];
function Avatar({ name, size = 36 }) {
  const initials = name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?";
  const [bg, color] = PALETTE[name?.charCodeAt(0) % PALETTE.length || 0].split("|");
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 700, flexShrink: 0 }}>{initials}</div>;
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

const ACTIVITY_TYPES = ["new_position", "renforcement", "vente", "allegement", "dividende", "coupon", "versement", "retrait", "rebalancement", "suppression_position", "new_broker"];
const MOMENT_TYPES = ["portfolio_complete", "premier_etf", "premiere_action", "premier_dividende", "dca_1m", "dca_3m", "dca_6m", "dca_1a", "10_positions", "nouveau_plus_haut", "anniversaire_1a", "anniversaire_3a", "anniversaire_5a"];
const BADGE_TYPES = ["badge"];

const FILTERS = [
  { id: "all", label: "Tout" },
  { id: "activite", label: "Activité" },
  { id: "moments", label: "Moments" },
  { id: "badges", label: "Badges 🏅" },
];

function getActivityMeta(activity) {
  const d = activity.data || {};
  const name = activity.author?.full_name || "Quelqu'un";

  const map = {
    new_position: { tag: "Nouvelle position", tagBg: "rgba(123,184,240,0.1)", tagColor: "#7BB8F0", title: `${name} a ajouté une nouvelle position`, sub: d.label, stat: `${d.exposition || d.vehicule || ""}${d.broker ? ` · ${d.broker}` : ""}${d.percentage ? ` · ${d.percentage}%` : ""}` },
    renforcement: { tag: "Renforcement", tagBg: "rgba(159,225,203,0.1)", tagColor: "#9FE1CB", title: `${name} a renforcé une position`, sub: d.label, stat: `${d.exposition || ""}${d.broker ? ` · ${d.broker}` : ""}` },
    vente: { tag: "Vente", tagBg: "rgba(240,153,123,0.1)", tagColor: "#F0997B", title: `${name} a vendu une position`, sub: d.label, stat: d.broker || "" },
    allegement: { tag: "Allègement", tagBg: "rgba(240,153,123,0.1)", tagColor: "#F0997B", title: `${name} a allégé une position`, sub: d.label, stat: "" },
    dividende: { tag: "Dividende reçu 💰", tagBg: "rgba(240,203,123,0.1)", tagColor: "#F0CB7B", title: `${name} a reçu un dividende`, sub: d.label, stat: d.montant ? `+${d.montant} €` : "" },
    coupon: { tag: "Coupon reçu", tagBg: "rgba(240,203,123,0.1)", tagColor: "#F0CB7B", title: `${name} a reçu un coupon`, sub: d.label, stat: d.montant ? `+${d.montant} €` : "" },
    versement: { tag: "Versement", tagBg: "rgba(159,225,203,0.1)", tagColor: "#9FE1CB", title: `${name} a effectué un versement`, sub: d.broker, stat: "" },
    retrait: { tag: "Retrait", tagBg: "rgba(240,153,123,0.1)", tagColor: "#F0997B", title: `${name} a effectué un retrait`, sub: d.broker, stat: "" },
    rebalancement: { tag: "Rééquilibrage", tagBg: "rgba(240,203,123,0.1)", tagColor: "#F0CB7B", title: `${name} a rééquilibré son portefeuille`, sub: d.detail, stat: "" },
    suppression_position: { tag: "Position supprimée", tagBg: "rgba(255,255,255,0.05)", tagColor: "rgba(255,255,255,0.4)", title: `${name} a supprimé une position`, sub: d.label, stat: "" },
    new_broker: { tag: "Nouveau broker", tagBg: "rgba(175,169,236,0.1)", tagColor: "#AFA9EC", title: `${name} a ajouté un broker`, sub: d.broker, stat: d.broker },
    portfolio_complete: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} a complété son portefeuille à 100%`, sub: "Portefeuille entièrement alloué", stat: "100% alloué" },
    premier_etf: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} a acheté son premier ETF`, sub: d.label, stat: "" },
    premiere_action: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} a acheté sa première action`, sub: d.label, stat: "" },
    premier_dividende: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} a reçu son premier dividende`, sub: "", stat: "" },
    dca_1m: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} atteint 1 mois d'investissement régulier`, sub: "Série DCA démarrée", stat: "1 mois" },
    dca_3m: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} atteint 3 mois d'investissement régulier`, sub: "Série DCA en cours", stat: "3 mois" },
    dca_6m: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} atteint 6 mois d'investissement régulier`, sub: "Discipline exemplaire", stat: "6 mois" },
    dca_1a: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} atteint 1 an d'investissement régulier`, sub: "Un an sans s'arrêter", stat: "12 mois" },
    "10_positions": { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} détient maintenant 10 positions`, sub: "Portefeuille bien diversifié", stat: "10 positions" },
    nouveau_plus_haut: { tag: "Moment 🌟", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} atteint un nouveau plus haut`, sub: "Record de portefeuille", stat: d.valeur ? `${d.valeur} €` : "" },
    anniversaire_1a: { tag: "Anniversaire 🎂", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} fête 1 an en tant qu'investisseur`, sub: "1 an de parcours", stat: "1 an" },
    anniversaire_3a: { tag: "Anniversaire 🎂", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} fête 3 ans en tant qu'investisseur`, sub: "3 ans de discipline", stat: "3 ans" },
    anniversaire_5a: { tag: "Anniversaire 🎂", tagBg: "rgba(240,215,0,0.1)", tagColor: "#FFD700", title: `${name} fête 5 ans en tant qu'investisseur`, sub: "5 ans — Long-Term Investor", stat: "5 ans" },
    badge: { tag: "Badge débloqué 🏅", tagBg: "rgba(240,215,0,0.08)", tagColor: "#FFD700", title: `${name} a débloqué un badge`, sub: d.badge_name, stat: d.badge_medal ? `${d.badge_medal} ${d.badge_name}` : "" },
  };

  return map[activity.type] || {
    tag: "Activité", tagBg: "rgba(255,255,255,0.05)", tagColor: "rgba(255,255,255,0.4)",
    title: `${name} a eu une activité`, sub: "", stat: "",
  };
}

export default function Feed({ session }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState({});
  const [openComment, setOpenComment] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [friendIds, setFriendIds] = useState([]);

  useEffect(() => { loadFriendsAndActivities(); }, []);

  async function loadFriendsAndActivities() {
    setLoading(true);
    const { data: friendships } = await supabase
      .from("friendships")
      .select("requester_id, receiver_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`);

    const ids = [session.user.id];
    if (friendships) {
      friendships.forEach(f => {
        if (f.requester_id !== session.user.id) ids.push(f.requester_id);
        if (f.receiver_id !== session.user.id) ids.push(f.receiver_id);
      });
    }
    setFriendIds(ids);

    const { data } = await supabase
      .from("activities")
      .select("*, author:profiles!activities_user_id_fkey(full_name, username)")
      .in("user_id", ids)
      .order("created_at", { ascending: false })
      .limit(100);
    setActivities(data || []);
    setLoading(false);
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

  return (
    <div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>
        ⚡ Activités de ton réseau
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${filter === f.id ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: filter === f.id ? "rgba(159,225,203,0.1)" : "none", color: filter === f.id ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "2rem" }}>Chargement…</div>}

      {!loading && visible.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: "2.5rem 1rem" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
            {friendIds.length <= 1 ? "Ajoute des amis pour voir leurs investissements" : "Aucune activité dans cette catégorie"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
            {friendIds.length <= 1 ? "Va dans Profil → Réseau pour trouver des investisseurs" : "Les activités apparaîtront ici automatiquement"}
          </div>
        </div>
      )}

      {visible.map(activity => {
        const meta = getActivityMeta(activity);
        const isMe = activity.user_id === session.user.id;
        const myComments = comments[activity.id] || [];

        return (
          <div key={activity.id} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Avatar name={activity.author?.full_name} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                  {activity.author?.full_name}
                  {isMe && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: 6 }}>· moi</span>}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{timeAgo(activity.created_at)}</div>
              </div>
              <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: meta.tagBg, color: meta.tagColor }}>{meta.tag}</span>
            </div>

            <div style={{ borderLeft: "2px solid rgba(255,255,255,0.08)", paddingLeft: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", lineHeight: 1.4 }}>{meta.title}</div>
              {meta.sub && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{meta.sub}</div>}
              {meta.stat && <span style={{ display: "inline-block", marginTop: 8, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500, background: meta.tagBg, color: meta.tagColor }}>{meta.stat}</span>}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => toggleLike(activity.id)} style={{ ...btnAct, ...(likes[activity.id] ? { borderColor: "#9FE1CB", color: "#9FE1CB" } : {}) }}>
                👍 {likes[activity.id] ? "Liké" : "Like"}
              </button>
              <button onClick={() => toggleComment(activity.id)} style={btnAct}>
                💬 Commenter · {myComments.length}
              </button>
            </div>

            {openComment[activity.id] && (
              <div style={{ marginTop: 12, borderTop: "0.5px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                {myComments.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <Avatar name={c.name} size={26} />
                    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "7px 10px", flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{c.text}</div>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Avatar name="Moi" size={26} />
                  <input
                    value={commentInputs[activity.id] || ""}
                    onChange={e => setCommentInputs(p => ({ ...p, [activity.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addComment(activity.id)}
                    placeholder="Ajouter un commentaire…"
                    style={{ flex: 1, padding: "7px 10px", fontSize: 13, borderRadius: 8, border: "0.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#f0f0f0", fontFamily: "inherit" }}
                  />
                  <button onClick={() => addComment(activity.id)} style={{ ...btnAct, padding: "7px 12px" }}>Envoyer</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
