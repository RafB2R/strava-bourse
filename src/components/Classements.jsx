import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const FILTERS = [
  { id: "performance", label: "📈 Performance" },
  { id: "regularite", label: "🔥 Régularité" },
  { id: "diversification", label: "🌍 Diversification" },
  { id: "contribution", label: "🤝 Contribution" },
  { id: "badges", label: "🏅 Badges" },
];

const PALETTE = ["rgba(159,225,203,0.12)|#9FE1CB","rgba(240,153,123,0.12)|#F0997B","rgba(175,169,236,0.12)|#AFA9EC","rgba(123,184,240,0.12)|#7BB8F0","rgba(240,203,123,0.12)|#F0CB7B"];
function Avatar({ name, size = 36 }) {
  const initials = name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2) : "?";
  const [bg, color] = PALETTE[name?.charCodeAt(0) % PALETTE.length || 0].split("|");
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size*0.33, fontWeight: 700, flexShrink: 0 }}>{initials}</div>;
}

const card = { background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "1.25rem", marginBottom: 12 };

export default function Classements({ session }) {
  const [filter, setFilter] = useState("performance");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("amis");
  const [friendIds, setFriendIds] = useState([]);

  useEffect(() => { loadFriends(); }, []);
  useEffect(() => { loadRanking(); }, [filter, scope, friendIds]);

  async function loadFriends() {
    const { data } = await supabase.from("friendships").select("requester_id, receiver_id").eq("status", "accepted").or(`requester_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`);
    const ids = [session.user.id];
    if (data) data.forEach(f => { if (f.requester_id !== session.user.id) ids.push(f.requester_id); if (f.receiver_id !== session.user.id) ids.push(f.receiver_id); });
    setFriendIds(ids);
  }

  async function loadRanking() {
    setLoading(true);
    let query = supabase.from("profiles").select("id, full_name, username, city, strategy, streak_mois, investing_since");
    if (scope === "amis" && friendIds.length > 0) query = query.in("id", friendIds);
    const { data: profiles } = await query.limit(50);
    if (!profiles) { setLoading(false); return; }

    const enriched = await Promise.all(profiles.map(async p => {
      const { data: entries } = await supabase.from("portfolio_entries").select("performance, percentage, exposition, type, broker").eq("user_id", p.id);
      const { data: badges } = await supabase.from("user_badges").select("badge_id").eq("user_id", p.id);
      const { count: postCount } = await supabase.from("club_posts").select("*", { count: "exact", head: true }).eq("user_id", p.id);
      const { count: replyCount } = await supabase.from("club_replies").select("*", { count: "exact", head: true }).eq("user_id", p.id);

      let perf = null;
      let scoreDiversif = 0;
      if (entries && entries.length > 0) {
        const avecPerf = entries.filter(e => e.performance !== null);
        const totalPct = avecPerf.reduce((s, e) => s + Number(e.percentage), 0);
        if (totalPct > 0) perf = avecPerf.reduce((s, e) => s + Number(e.performance) * Number(e.percentage) / totalPct, 0);
        const nbExpo = new Set(entries.map(e => e.exposition || e.type)).size;
        const nbBrokers = new Set(entries.filter(e => e.broker).map(e => e.broker)).size;
        const maxPos = Math.max(...entries.map(e => Number(e.percentage)));
        scoreDiversif = Math.min(nbExpo * 15, 40) + Math.min(nbBrokers * 10, 20) + (maxPos <= 30 ? 25 : maxPos <= 50 ? 15 : 5) + Math.min(entries.length * 3, 15);
      }

      return {
        ...p,
        perf,
        scoreDiversif,
        streak: p.streak_mois || 0,
        nbBadges: (badges || []).length,
        contribution: (postCount || 0) + (replyCount || 0),
        isMe: p.id === session.user.id,
      };
    }));

    const sorted = [...enriched].sort((a, b) => {
      if (filter === "performance") return (b.perf ?? -Infinity) - (a.perf ?? -Infinity);
      if (filter === "regularite") return b.streak - a.streak;
      if (filter === "diversification") return b.scoreDiversif - a.scoreDiversif;
      if (filter === "contribution") return b.contribution - a.contribution;
      if (filter === "badges") return b.nbBadges - a.nbBadges;
      return 0;
    });

    setUsers(sorted);
    setLoading(false);
  }

  const rankIcon = i => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

  function getValue(u) {
    if (filter === "performance") return { val: u.perf !== null ? `${u.perf >= 0 ? "+" : ""}${u.perf.toFixed(1)}%` : "—", color: u.perf === null ? "rgba(255,255,255,0.25)" : u.perf >= 0 ? "#9FE1CB" : "#F08080" };
    if (filter === "regularite") return { val: u.streak > 0 ? `🔥 ${u.streak} mois` : "—", color: "#F0CB7B" };
    if (filter === "diversification") return { val: `${u.scoreDiversif}/100`, color: u.scoreDiversif >= 70 ? "#9FE1CB" : u.scoreDiversif >= 40 ? "#F0CB7B" : "#F08080" };
    if (filter === "contribution") return { val: u.contribution > 0 ? `💬 ${u.contribution}` : "—", color: "#AFA9EC" };
    if (filter === "badges") return { val: `🏅 ${u.nbBadges}`, color: "#FFD700" };
    return { val: "—", color: "rgba(255,255,255,0.3)" };
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>🏆 Classements Verio</div>

      {/* Scope */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["amis", "👥 Amis"], ["global", "🌍 Global"]].map(([id, label]) => (
          <button key={id} onClick={() => setScope(id)} style={{ padding: "5px 14px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${scope === id ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: scope === id ? "rgba(159,225,203,0.1)" : "none", color: scope === id ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${filter === f.id ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: filter === f.id ? "rgba(159,225,203,0.1)" : "none", color: filter === f.id ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={card}>
        {loading && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "1.5rem" }}>Chargement…</div>}

        {!loading && users.length === 0 && (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "1.5rem" }}>
            {scope === "amis" ? "Ajoute des amis pour te comparer 🙂" : "Aucun utilisateur trouvé"}
          </div>
        )}

        {users.map((u, i) => {
          const { val, color } = getValue(u);
          return (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i === 0 ? "none" : "0.5px solid rgba(255,255,255,0.06)", background: u.isMe ? "rgba(159,225,203,0.03)" : "none", borderRadius: 8, paddingLeft: u.isMe ? 8 : 0 }}>
              <div style={{ fontSize: 18, minWidth: 28, textAlign: "center" }}>
                {rankIcon(i) || <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>{i + 1}</span>}
              </div>
              <Avatar name={u.full_name} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: u.isMe ? "#9FE1CB" : "#fff" }}>
                  {u.full_name}
                  {u.isMe && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: 6 }}>· moi</span>}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                  {u.strategy && <span style={{ marginRight: 8 }}>{u.strategy}</span>}
                  {u.city && <span>{u.city}</span>}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color, textAlign: "right" }}>{val}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
