import { useState, useEffect } from "react";
import { supabase, PUBLIC_PROFILE_COLUMNS } from "../supabase";
import { T as TLive } from "../theme";
import { getBadgeInfo, badgeFromData, MEDAL_COLORS } from "../badges";

const PALETTE = ["rgba(159,225,203,0.12)|#9FE1CB","rgba(240,153,123,0.12)|#F0997B","rgba(175,169,236,0.12)|#AFA9EC","rgba(123,184,240,0.12)|#7BB8F0"];
const EXP_COLORS = { Actions: "#1D9E75", Obligations: "#185FA5", Immobilier: "#7F77DD", "Multi-actifs": "#854F0B", Monétaire: "#888", Crypto: "#D85A30", "Matières premières": "#F0CB7B" };
// Colonnes visibles par les autres membres : jamais prix_achat ni nombre_parts
const PUBLIC_ENTRY_COLUMNS = "id, label, type, exposition, percentage, performance, broker";


// Palette de couleurs distinctes pour les positions individuelles
const POSITION_COLORS = [
  "#1D9E75", "#185FA5", "#D85A30", "#7F77DD", "#F0CB7B",
  "#E84393", "#00B4D8", "#F77F00", "#4CC9F0", "#A8DADC",
];

function PieChart({ data, T }) {
  // data = [{ label, value, color }]
  const [hovered, setHovered] = useState(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  const innerR = 32;

  const slices = data.map((d, i) => {
    const pct = d.value / total;
    const before = data.slice(0, i).reduce((s, x) => s + x.value, 0) / total;
    const startAngle = -Math.PI / 2 + before * 2 * Math.PI;
    const endAngle = startAngle + pct * 2 * Math.PI;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const xi1 = cx + innerR * Math.cos(startAngle);
    const yi1 = cy + innerR * Math.sin(startAngle);
    const xi2 = cx + innerR * Math.cos(endAngle);
    const yi2 = cy + innerR * Math.sin(endAngle);
    const large = pct > 0.5 ? 1 : 0;
    const path = [
      `M ${xi1} ${yi1}`,
      `L ${x1} ${y1}`,
      `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
      `L ${xi2} ${yi2}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${xi1} ${yi1}`,
      "Z"
    ].join(" ");
    return { ...d, path, pct, midAngle: (startAngle + endAngle) / 2 };
  });

  const hov = hovered !== null ? slices[hovered] : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path
            key={i}
            d={s.path}
            fill={s.color}
            opacity={hovered === null || hovered === i ? 1 : 0.4}
            stroke={T.bgSecondary || T.text}
            strokeWidth={2}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer", transition: "opacity 0.15s" }}
          />
        ))}
        {/* Centre */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill={T.text} fontSize={hov ? 13 : 12} fontWeight={700}>
          {hov ? `${Math.round(hov.pct * 100)}%` : `${data.length}`}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill={T.textFaint} fontSize={9}>
          {hov ? hov.label.split(" ")[0] : "positions"}
        </text>
      </svg>
      {/* Légende */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, opacity: hovered === null || hovered === i ? 1 : 0.4, transition: "opacity 0.15s", cursor: "pointer" }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 12, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>{Math.round(s.pct * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

// Profil, positions (colonnes publiques), activités, badges et lien d'amitié avec moi
async function fetchPublicProfile(userId, myId) {
  const [{ data: p }, { data: e }, { data: a }, { data: b }, { data: f }] = await Promise.all([
    supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("id", userId).single(),
    supabase.from("portfolio_entries").select(PUBLIC_ENTRY_COLUMNS).eq("user_id", userId).order("percentage", { ascending: false }),
    supabase.from("activities").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    supabase.from("user_badges").select("badge_id, unlocked_at").eq("user_id", userId),
    supabase.from("friendships").select("*").or(`requester_id.eq.${myId},receiver_id.eq.${myId}`).or(`requester_id.eq.${userId},receiver_id.eq.${userId}`),
  ]);
  const rel = (f || []).find(fr =>
    (fr.requester_id === myId && fr.receiver_id === userId) ||
    (fr.requester_id === userId && fr.receiver_id === myId)
  );
  return {
    profile: p,
    entries: e || [],
    activities: a || [],
    badges: b || [],
    relation: rel ? (rel.status === "accepted" ? "accepted" : "pending") : null,
  };
}

// Stats côte à côte (moi / ce membre) pour le widget de comparaison du desktop
async function fetchCompareStats(myId, userId) {
  const { data } = await supabase
    .from("member_stats")
    .select("id, perf, score_diversif, streak_mois, nb_badges")
    .in("id", [myId, userId]);
  if (!data) return null;
  const toStats = row => row && {
    perf: row.perf === null ? null : Number(row.perf),
    diversif: Number(row.score_diversif),
    streak: Number(row.streak_mois),
    badges: Number(row.nb_badges),
  };
  return {
    mine: toStats(data.find(d => d.id === myId)),
    theirs: toStats(data.find(d => d.id === userId)),
  };
}

export default function ProfilPublic({ userId, session, onBack, T: TProp, onCompareData }) {
  const T = TProp || TLive;
  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: "1.25rem", marginBottom: 12 };
  const btnSm = { background: "none", border: `0.5px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" };

  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [activities, setActivities] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("holdings");
  const [isFriend, setIsFriend] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [compareStats, setCompareStats] = useState(null);

  const myId = session.user.id;

  // Le parent remonte ce composant (key=userId) à chaque changement de profil,
  // donc l'état repart de zéro sans reset manuel.
  useEffect(() => {
    let ignore = false;
    fetchPublicProfile(userId, myId).then(r => {
      if (ignore) return;
      setProfile(r.profile);
      setEntries(r.entries);
      setActivities(r.activities);
      setBadges(r.badges);
      setIsFriend(r.relation === "accepted");
      setIsPending(r.relation === "pending");
      setLoading(false);
    });
    fetchCompareStats(myId, userId).then(stats => { if (!ignore && stats) setCompareStats(stats); });
    return () => { ignore = true; };
  }, [userId, myId]);

  async function sendRequest() {
    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
    await supabase.from("friendships").insert({ requester_id: session.user.id, receiver_id: userId, status: "pending" });
    await supabase.from("notifications").insert({ user_id: userId, type: "friend_request", data: { from_name: me?.full_name, from_id: session.user.id } });
    setIsPending(true);
  }

  const avecPerf = entries.filter(e => e.performance !== null);
  const totalPctPerf = avecPerf.reduce((s, e) => s + Number(e.percentage), 0);
  const perfGlobale = totalPctPerf > 0 ? avecPerf.reduce((s, e) => s + Number(e.performance) * Number(e.percentage) / totalPctPerf, 0) : null;

  // Envoyer les données de comparaison vers App
  useEffect(() => {
    if (profile && compareStats && onCompareData) {
      onCompareData({ profile, ...compareStats });
    }
  }, [profile, compareStats, onCompareData]);

  // Nettoyer à la fermeture
  useEffect(() => {
    return () => { if (onCompareData) onCompareData(null); };
  }, [onCompareData]);

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
      case "badge": { const info = badgeFromData(d); return `A débloqué le badge ${info.medal} ${info.name}`; }
      case "new_broker": return `A ajouté ${d.broker || "un broker"}`;
      default: return "Activité";
    }
  }

  if (loading) return <div style={{ textAlign: "center", padding: "3rem", color: T.textFaint, fontSize: 13 }}>Chargement…</div>;
  if (!profile) return <div style={{ textAlign: "center", padding: "3rem", color: T.textFaint, fontSize: 13 }}>Profil introuvable</div>;

  return (
    <div>
      <button onClick={onBack} style={{ ...btnSm, marginBottom: 16 }}>← Retour</button>

      <div style={card}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
          <Avatar name={profile.full_name} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 2 }}>{profile.full_name}</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 6 }}>
              @{profile.username}{profile.city ? ` · ${profile.city}` : ""}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {profile.strategy && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: T.accentBg, color: T.accent }}>{profile.strategy}</span>}
              {profile.streak_mois > 0 && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: "rgba(240,203,123,0.1)", color: "#F0CB7B" }}>🔥 {profile.streak_mois} mois</span>}
              {profile.investing_since && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, background: T.bgCard, color: T.textMuted }}>Depuis {profile.investing_since}</span>}
            </div>
          </div>
          {userId !== session.user.id && (
            isFriend ? <span style={{ fontSize: 12, color: T.accent }}>✓ Ami</span>
            : isPending ? <span style={{ fontSize: 12, color: T.textFaint }}>En attente</span>
            : <button onClick={sendRequest} style={{ ...btnSm, borderColor: T.accent, color: T.accent }}>+ Suivre</button>
          )}
        </div>

        {profile.bio && <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, marginBottom: 14 }}>{profile.bio}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            ["Positions", entries.length, T.text],
            ["Performance", perfGlobale !== null ? `${perfGlobale >= 0 ? "+" : ""}${perfGlobale.toFixed(1)}%` : "—", perfGlobale !== null ? (perfGlobale >= 0 ? T.accent : T.red) : T.textFaint],
            ["Badges", badges.length, T.text],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: T.bgCard, borderRadius: 10, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color }}>{val}</div>
              <div style={{ fontSize: 11, color: T.textFaint }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `0.5px solid ${T.border}` }}>
        {[["holdings", "Holdings"], ["activite", "Activité"], ["badges", "Badges"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 4px", fontSize: 13, fontWeight: tab === id ? 600 : 400, background: "none", border: "none", borderBottom: `2px solid ${tab === id ? T.accent : "transparent"}`, color: tab === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "holdings" && (
        <div>
          {entries.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>Allocation</div>
              <PieChart
                T={T}
                data={entries.map((e, i) => ({
                  label: e.label,
                  value: Number(e.percentage),
                  color: POSITION_COLORS[i % POSITION_COLORS.length],
                }))}
              />
            </div>
          )}
          <div style={card}>
            <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Positions ({entries.length})</div>
            {entries.length === 0 && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem" }}>Aucune position publique</div>}
            {entries.map((e, i) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i === 0 ? "none" : `0.5px solid ${T.border}` }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: EXP_COLORS[e.exposition] || "#888", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{e.label}</div>
                  <div style={{ fontSize: 11, color: T.textFaint }}>{e.exposition || e.type}{e.broker ? ` · ${e.broker}` : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, color: T.textMuted }}>{e.percentage}%</div>
                  {e.performance !== null && <div style={{ fontSize: 12, fontWeight: 600, color: e.performance >= 0 ? T.accent : T.red }}>{e.performance >= 0 ? "+" : ""}{Number(e.performance).toFixed(1)}%</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "activite" && (
        <div>
          {activities.length === 0 && <div style={{ ...card, textAlign: "center", color: T.textFaint, fontSize: 13, padding: "2rem" }}>Aucune activité</div>}
          {activities.map(a => (
            <div key={a.id} style={{ ...card, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                {a.type === "badge" ? "🏅" : a.type.includes("dca") ? "🔥" : a.type === "new_position" ? "📈" : "⚡"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.4 }}>{getActivityText(a)}</div>
                <div style={{ fontSize: 11, color: T.textFaint, marginTop: 3 }}>{timeAgo(a.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "badges" && (
        <div>
          {badges.length === 0 && <div style={{ ...card, textAlign: "center", color: T.textFaint, fontSize: 13, padding: "2rem" }}>Aucun badge débloqué</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {badges.map(b => {
              const info = getBadgeInfo(b.badge_id);
              return (
                <div key={b.badge_id} style={{ background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 22 }}>{info.medal}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: MEDAL_COLORS[info.medal] || T.accent, textAlign: "center", lineHeight: 1.3 }}>{info.name}</div>
                  {info.category && <div style={{ fontSize: 10, color: T.textFaint, textAlign: "center" }}>{info.icon} {info.category}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
