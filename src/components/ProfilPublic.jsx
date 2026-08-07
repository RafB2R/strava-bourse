import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const card = { background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "1.25rem", marginBottom: 12 };
const btnSm = { background: "none", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" };

const PALETTE = ["rgba(159,225,203,0.12)|#9FE1CB","rgba(240,153,123,0.12)|#F0997B","rgba(175,169,236,0.12)|#AFA9EC","rgba(123,184,240,0.12)|#7BB8F0"];
const EXP_COLORS = { Actions: "#1D9E75", Obligations: "#185FA5", Immobilier: "#7F77DD", "Multi-actifs": "#854F0B", Monétaire: "#888", Crypto: "#D85A30", "Matières premières": "#F0CB7B" };
const MEDAL_COLORS = { "🥉": "#CD7F32", "🥈": "#C0C0C0", "🥇": "#FFD700", "💎": "#B9F2FF" };

function Avatar({ name, size = 60 }) {
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

export default function ProfilPublic({ userId, session, onBack }) {
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [activities, setActivities] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("holdings");
  const [isFriend, setIsFriend] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => { loadAll(); }, [userId]);

  async function loadAll() {
    setLoading(true);

    const [{ data: p }, { data: e }, { data: a }, { data: b }, { data: f }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("portfolio_entries").select("*").eq("user_id", userId).order("percentage", { ascending: false }),
      supabase.from("activities").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("user_badges").select("badge_id, unlocked_at").eq("user_id", userId),
      supabase.from("friendships").select("*").or(`requester_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`).or(`requester_id.eq.${userId},receiver_id.eq.${userId}`),
    ]);

    setProfile(p);
    setEntries(e || []);
    setActivities(a || []);
    setBadges(b || []);

    if (f) {
      const rel = f.find(fr =>
        (fr.requester_id === session.user.id && fr.receiver_id === userId) ||
        (fr.requester_id === userId && fr.receiver_id === session.user.id)
      );
      if (rel?.status === "accepted") setIsFriend(true);
      else if (rel) setIsPending(true);
    }

    setLoading(false);
  }

  async function sendRequest() {
    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
    await supabase.from("friendships").insert({ requester_id: session.user.id, receiver_id: userId, status: "pending" });
    await supabase.from("notifications").insert({ user_id: userId, type: "friend_request", data: { from_name: me?.full_name, from_id: session.user.id } });
    setIsPending(true);
  }

  // Calcul perf globale
  const avecPerf = entries.filter(e => e.performance !== null);
  const totalPctPerf = avecPerf.reduce((s, e) => s + Number(e.percentage), 0);
  const perfGlobale = totalPctPerf > 0 ? avecPerf.reduce((s, e) => s + Number(e.performance) * Number(e.percentage) / totalPctPerf, 0) : null;

  // Allocation par exposition
  const byExpo = entries.reduce((acc, e) => { const k = e.exposition || e.type || "Autre"; acc[k] = (acc[k] || 0) + Number(e.percentage); return acc; }, {});

  // Activités avec meta
  function getActivityText(a) {
    const d = a.data || {};
    switch (a.type) {
      case "new_position": return `A ajouté ${d.label || "une position"}${d.broker ? ` sur ${d.broker}` : ""}`;
      case "renforcement": return `A renforcé ${d.label || "une position"}`;
      case "portfolio_complete": return "A complété son portefeuille à 100%";
      case "dca_1m": return "1 mois d'investissement régulier 🔥";
      case "dca_3m": return "3 mois d'investissement régulier 🔥";
      case "dca_6m": return "6 mois d'investissement régulier 🔥";
      case "dca_1a": return "1 an d'investissement régulier 🏆";
      case "badge": return `A débloqué le badge ${d.badge_medal || ""} ${d.badge_name || ""}`;
      case "new_broker": return `A ajouté ${d.broker || "un broker"}`;
      default: return "Activité";
    }
  }

  if (loading) return (
    <div style={{ textAlign: "center", padding: "3rem", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Chargement…</div>
  );

  if (!profile) return (
    <div style={{ textAlign: "center", padding: "3rem", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Profil introuvable</div>
  );

  return (
    <div>
      <button onClick={onBack} style={{ ...btnSm, marginBottom: 16 }}>← Retour</button>

      {/* Header profil */}
      <div style={card}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
          <Avatar name={profile.full_name} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{profile.full_name}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
              @{profile.username}{profile.city ? ` · ${profile.city}` : ""}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {profile.strategy && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(159,225,203,0.08)", color: "#9FE1CB" }}>{profile.strategy}</span>}
              {profile.streak_mois > 0 && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(240,203,123,0.1)", color: "#F0CB7B" }}>🔥 {profile.streak_mois} mois</span>}
              {profile.investing_since && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>Depuis {profile.investing_since}</span>}
            </div>
          </div>
          {userId !== session.user.id && (
            isFriend ? <span style={{ fontSize: 12, color: "#9FE1CB" }}>✓ Ami</span>
            : isPending ? <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>En attente</span>
            : <button onClick={sendRequest} style={{ ...btnSm, borderColor: "#9FE1CB", color: "#9FE1CB" }}>+ Suivre</button>
          )}
        </div>

        {profile.bio && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 14 }}>{profile.bio}</div>}

        {/* Stats rapides */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{entries.length}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Positions</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: perfGlobale !== null ? (perfGlobale >= 0 ? "#9FE1CB" : "#F08080") : "rgba(255,255,255,0.3)" }}>
              {perfGlobale !== null ? `${perfGlobale >= 0 ? "+" : ""}${perfGlobale.toFixed(1)}%` : "—"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Performance</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{badges.length}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Badges</div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
        {[["holdings", "Holdings"], ["activite", "Activité"], ["badges", "Badges"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 4px", fontSize: 13, fontWeight: tab === id ? 600 : 400, background: "none", border: "none", borderBottom: `2px solid ${tab === id ? "#9FE1CB" : "transparent"}`, color: tab === id ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Holdings */}
      {tab === "holdings" && (
        <div>
          {/* Allocation */}
          {Object.keys(byExpo).length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Exposition réelle</div>
              {Object.entries(byExpo).sort((a,b) => b[1]-a[1]).map(([expo, pct]) => (
                <div key={expo} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{expo}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: EXP_COLORS[expo] || "#888", borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Positions */}
          <div style={card}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Positions ({entries.length})</div>
            {entries.length === 0 && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "1rem" }}>Aucune position publique</div>}
            {entries.map((e, i) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i === 0 ? "none" : "0.5px solid rgba(255,255,255,0.06)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: EXP_COLORS[e.exposition] || "#888", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{e.label}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{e.exposition || e.type}{e.broker ? ` · ${e.broker}` : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{e.percentage}%</div>
                  {e.performance !== null && <div style={{ fontSize: 12, fontWeight: 600, color: e.performance >= 0 ? "#9FE1CB" : "#F08080" }}>{e.performance >= 0 ? "+" : ""}{Number(e.performance).toFixed(1)}%</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activité */}
      {tab === "activite" && (
        <div>
          {activities.length === 0 && <div style={{ ...card, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "2rem" }}>Aucune activité</div>}
          {activities.map(a => (
            <div key={a.id} style={{ ...card, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(159,225,203,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                {a.type === "badge" ? "🏅" : a.type.includes("dca") ? "🔥" : a.type === "new_position" ? "📈" : "⚡"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#fff", lineHeight: 1.4 }}>{getActivityText(a)}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>{timeAgo(a.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Badges */}
      {tab === "badges" && (
        <div>
          {badges.length === 0 && <div style={{ ...card, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "2rem" }}>Aucun badge débloqué</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {badges.map(b => {
              const [cat, medal] = b.badge_id.split("_");
              return (
                <div key={b.badge_id} style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 22 }}>{medal || "🏅"}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: MEDAL_COLORS[medal] || "#9FE1CB", textAlign: "center", lineHeight: 1.3 }}>{cat}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
