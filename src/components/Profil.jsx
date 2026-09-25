import { useState, useEffect } from "react";
import { themes } from "../App";
import { supabase } from "../supabase";
import Badges from "./Badges";
import KYC from "./KYC";
import ProfilPublicEmbed from "./ProfilPublic";

const STRATEGIES = ["ETF passif", "Stock picking", "Dividendes", "Value investing", "DCA", "Mixte"];

const BADGE_CATEGORIES = [
  {
    id: "dca",
    icon: "💰",
    name: "DCA — Régularité",
    levels: [
      { level: "bronze", medal: "🥉", name: "Premiers pas", desc: "3 mois de DCA consécutifs", target: 3, unit: "mois" },
      { level: "argent", medal: "🥈", name: "Investisseur régulier", desc: "1 an de DCA consécutif", target: 12, unit: "mois" },
      { level: "or", medal: "🥇", name: "Discipline exemplaire", desc: "3 ans de DCA consécutif", target: 36, unit: "mois" },
      { level: "diamant", medal: "💎", name: "Légende du DCA", desc: "10 ans de DCA consécutif", target: 120, unit: "mois" },
    ],
    current: 28,
  },
  {
    id: "performance",
    icon: "📈",
    name: "Performance",
    levels: [
      { level: "bronze", medal: "🥉", name: "Premier pas", desc: "Premier investissement réalisé", target: 1, unit: "" },
      { level: "argent", medal: "🥈", name: "En croissance", desc: "+10% de performance totale", target: 10, unit: "%" },
      { level: "or", medal: "🥇", name: "Solide rendement", desc: "+50% de performance totale", target: 50, unit: "%" },
      { level: "diamant", medal: "💎", name: "Double mise", desc: "+100% de performance totale", target: 100, unit: "%" },
    ],
    current: null, // sera calculé dynamiquement
  },
  {
    id: "diversification",
    icon: "🌍",
    name: "Diversification",
    levels: [
      { level: "bronze", medal: "🥉", name: "Premiers actifs", desc: "3 types d'actifs différents", target: 3, unit: "types" },
      { level: "argent", medal: "🥈", name: "Portefeuille varié", desc: "5 types d'actifs différents", target: 5, unit: "types" },
      { level: "or", medal: "🥇", name: "Bien diversifié", desc: "8 secteurs ou plus", target: 8, unit: "secteurs" },
      { level: "diamant", medal: "💎", name: "Diversification parfaite", desc: "10 types d'actifs + multi-broker", target: 10, unit: "types" },
    ],
    current: null,
  },
  {
    id: "discipline",
    icon: "🧊",
    name: "Discipline — Ne pas vendre",
    levels: [
      { level: "bronze", medal: "🥉", name: "Tiens bon", desc: "6 mois sans vendre", target: 6, unit: "mois" },
      { level: "argent", medal: "🥈", name: "Investisseur patient", desc: "1 an sans vendre", target: 12, unit: "mois" },
      { level: "or", medal: "🥇", name: "Mains de diamant", desc: "3 ans sans vendre", target: 36, unit: "mois" },
      { level: "diamant", medal: "💎", name: "Légende", desc: "5 ans sans vendre", target: 60, unit: "mois" },
    ],
    current: 8,
  },
  {
    id: "portefeuille",
    icon: "💼",
    name: "Portefeuille",
    levels: [
      { level: "bronze", medal: "🥉", name: "Premier placement", desc: "1ère position ajoutée", target: 1, unit: "position" },
      { level: "argent", medal: "🥈", name: "Portefeuille construit", desc: "5 positions différentes", target: 5, unit: "positions" },
      { level: "or", medal: "🥇", name: "Pleinement investi", desc: "Portefeuille alloué à 100%", target: 100, unit: "%" },
      { level: "diamant", medal: "💎", name: "Multi-broker", desc: "3 brokers ou plus", target: 3, unit: "brokers" },
    ],
    current: null,
  },
  {
    id: "communaute",
    icon: "👥",
    name: "Communauté",
    levels: [
      { level: "bronze", medal: "🥉", name: "Première contribution", desc: "Premier message posté dans un club", target: 1, unit: "message" },
      { level: "argent", medal: "🥈", name: "Membre actif", desc: "Membre de 3 clubs différents", target: 3, unit: "clubs" },
      { level: "or", medal: "🥇", name: "Fondateur", desc: "Créateur d'un club", target: 1, unit: "club créé" },
      { level: "diamant", medal: "💎", name: "Leader", desc: "Fondateur d'un club avec 100 membres", target: 100, unit: "membres" },
    ],
    current: null,
  },
];

const LEVEL_COLORS = {
  bronze: { bg: "rgba(205,127,50,0.12)", color: "#CD7F32", border: "rgba(205,127,50,0.3)" },
  argent: { bg: "rgba(192,192,192,0.12)", color: "#C0C0C0", border: "rgba(192,192,192,0.3)" },
  or: { bg: "rgba(255,215,0,0.12)", color: "#FFD700", border: "rgba(255,215,0,0.3)" },
  diamant: { bg: "rgba(185,242,255,0.12)", color: "#B9F2FF", border: "rgba(185,242,255,0.3)" },
};

const PALETTE = ["rgba(159,225,203,0.12)|#9FE1CB", "rgba(240,153,123,0.12)|#F0997B", "rgba(175,169,236,0.12)|#AFA9EC", "rgba(123,184,240,0.12)|#7BB8F0", "rgba(240,203,123,0.12)|#F0CB7B"];
function Avatar({ name, size = 36 }) {
  const initials = name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?";
  const [bg, color] = PALETTE[name?.charCodeAt(0) % PALETTE.length || 0].split("|");
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 700, flexShrink: 0 }}>{initials}</div>;
}

function StatsSection({ profile, session, friends, perf, T }) {
  const [friendPerfs, setFriendPerfs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => { if (friends.length > 0) loadFriendPerfs(); }, [friends]);

  async function loadFriendPerfs() {
    setLoading(true);
    const perfs = await Promise.all(friends.map(async f => {
      const { data } = await supabase.from("portfolio_entries").select("performance, percentage").eq("user_id", f.friend.id);
      let friendPerf = null;
      if (data && data.length > 0) {
        const avecPerf = data.filter(d => d.performance !== null);
        const totalPct = avecPerf.reduce((s, d) => s + Number(d.percentage), 0);
        if (totalPct > 0) friendPerf = avecPerf.reduce((s, d) => s + Number(d.performance) * Number(d.percentage) / totalPct, 0);
      }
      return { id: f.friend.id, name: f.friend.full_name, perf: friendPerf, me: false };
    }));
    setFriendPerfs(perfs);
    setLoading(false);
  }

  const ranking = [{ id: session.user.id, name: profile?.full_name, perf, me: true }, ...friendPerfs]
    .sort((a, b) => (b.perf ?? -Infinity) - (a.perf ?? -Infinity));

  if (selectedUser) {
    return <ProfilPublicEmbed userId={selectedUser} session={session} onBack={() => setSelectedUser(null)} />;
  }

  return (
    <div style={{ background: T.bgCard, border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "1.25rem", marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Classement amis</div>
      {loading && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem" }}>Chargement…</div>}
      {!loading && friends.length === 0 && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem 0" }}>Ajoute des amis pour voir le classement 🙂</div>}
      {!loading && ranking.map((f, i) => (
        <div key={i} onClick={() => !f.me && setSelectedUser(f.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i === 0 ? "none" : "0.5px solid rgba(255,255,255,0.06)", cursor: f.me ? "default" : "pointer" }}>
          <div style={{ fontSize: 13, color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : T.textFaint, minWidth: 20, fontWeight: 600 }}>{i + 1}</div>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
            {f.name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <div style={{ flex: 1, fontSize: 14, color: f.me ? T.text : T.accent }}>
            {f.name}{f.me && <span style={{ fontSize: 11, color: T.textFaint }}> · moi</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: f.perf === null ? T.textFaint : f.perf >= 0 ? T.accent : T.red }}>
            {f.perf === null ? "—" : `${f.perf >= 0 ? "+" : ""}${f.perf.toFixed(1)}%`}
          </div>
        </div>
      ))}
    </div>
  );
}

// card style sera généré dynamiquement avec T
// inp style sera généré dynamiquement avec T
// btn style sera généré dynamiquement avec T
// btnSm style sera généré dynamiquement avec T
// btnGreen style sera généré dynamiquement avec T
// btnRed style sera généré dynamiquement avec T
// sectionLabel style sera généré dynamiquement avec T

function getUnlockedLevel(category, current) {
  if (current === null) return null;
  let unlocked = null;
  for (const l of category.levels) {
    if (current >= l.target) unlocked = l;
    else break;
  }
  return unlocked;
}

function getNextLevel(category, current) {
  if (current === null) return category.levels[0];
  for (const l of category.levels) {
    if (current < l.target) return l;
  }
  return null;
}

function getProgress(category, current) {
  if (current === null) return 0;
  const next = getNextLevel(category, current);
  if (!next) return 100;
  const prev = category.levels[category.levels.indexOf(next) - 1];
  const from = prev ? prev.target : 0;
  return Math.min(((current - from) / (next.target - from)) * 100, 100);
}

export default function Profil({ profile: initialProfile, session, T: TProp }) {
  const T = TProp || themes[localStorage.getItem("verio-theme") || "light"];
  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: "1.25rem", marginBottom: 12 };
  const inp = { width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 10, border: `0.5px solid ${T.input.border}`, background: T.input.background, color: T.input.color, fontFamily: "inherit", marginBottom: 10, display: "block" };
  const btn = { background: T.accent, border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, color: T.text, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 };
  const btnSm = { background: "none", border: `0.5px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" };
  const btnGreen = { background: "none", border: `0.5px solid ${T.accent}`, borderRadius: 8, padding: "5px 10px", fontSize: 12, color: T.accent, cursor: "pointer", fontFamily: "inherit" };
  const btnRed = { background: "none", border: `0.5px solid ${T.red}`, borderRadius: 8, padding: "5px 10px", fontSize: 12, color: T.red, cursor: "pointer", fontFamily: "inherit" };
  const sectionLabel = { fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" };
  const [profile, setProfile] = useState(initialProfile || {});
  const [section, setSection] = useState("stats");
  const [editing, setEditing] = useState(false);
  const [streakMois, setStreakMois] = useState(profile?.streak_mois || 0);
  const [showKYC, setShowKYC] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({ positions: 0, perfPonderee: null, types: 0, brokers: 0, totalPct: 0 });
  const [selectedCat, setSelectedCat] = useState(null);
  const [friends, setFriends] = useState([]);
  const [selectedPublicUser, setSelectedPublicUser] = useState(null);
  const [pending, setPending] = useState([]);
  const [received, setReceived] = useState([]);
  const [myClubs, setMyClubs] = useState(0);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { if (initialProfile) setProfile(initialProfile); }, [initialProfile]);
  useEffect(() => { loadStats(); loadFriendships(); loadClubs(); updateStreak(); }, []);

  async function loadStats() {
    const { data } = await supabase.from("portfolio_entries").select("performance, percentage, type, broker").eq("user_id", session.user.id);
    if (data && data.length > 0) {
      const avecPerf = data.filter(d => d.performance !== null);
      const totalPct = avecPerf.reduce((s, d) => s + Number(d.percentage), 0);
      const perf = totalPct > 0 ? avecPerf.reduce((s, d) => s + (Number(d.performance) * Number(d.percentage)) / totalPct, 0) : null;
      const types = new Set(data.map(d => d.type)).size;
      const brokers = new Set(data.filter(d => d.broker).map(d => d.broker)).size;
      const allPct = data.reduce((s, d) => s + Number(d.percentage), 0);
      setStats({ positions: data.length, perfPonderee: perf, types, brokers, totalPct: allPct });
    }
  }


  async function updateStreak() {
    // Récupère toutes les activités d'investissement
    const { data: acts } = await supabase
      .from("activities")
      .select("created_at")
      .eq("user_id", session.user.id)
      .in("type", ["new_position", "renforcement", "rebalancement"])
      .order("created_at", { ascending: false });

    if (!acts || acts.length === 0) return;

    // Grouper par mois
    const moisInvestis = new Set(acts.map(a => {
      const d = new Date(a.created_at);
      return `${d.getFullYear()}-${d.getMonth()}`;
    }));

    // Calculer le streak depuis maintenant en remontant mois par mois
    let streak = 0;
    const now = new Date();
    let current = new Date(now.getFullYear(), now.getMonth(), 1);

    while (true) {
      const key = `${current.getFullYear()}-${current.getMonth()}`;
      if (moisInvestis.has(key)) {
        streak++;
        current.setMonth(current.getMonth() - 1);
      } else {
        break;
      }
    }

    // Mettre à jour en base si changé
    if (streak !== profile?.streak_mois) {
      await supabase.from("profiles").update({
        streak_mois: streak,
        streak_derniere_date: now.toISOString().split("T")[0],
      }).eq("id", session.user.id);
    }

    setStreakMois(streak);
  }

  async function loadFriendships() {
    const { data } = await supabase.from("friendships").select(`id, status, requester_id, receiver_id, requester:profiles!friendships_requester_id_fkey(id, full_name, username, city, strategy), receiver:profiles!friendships_receiver_id_fkey(id, full_name, username, city, strategy)`).or(`requester_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`);
    if (data) {
      setFriends(data.filter(f => f.status === "accepted").map(f => ({ ...f, friend: f.requester_id === session.user.id ? f.receiver : f.requester })));
      setPending(data.filter(f => f.status === "pending" && f.requester_id === session.user.id).map(f => ({ ...f, friend: f.receiver })));
      setReceived(data.filter(f => f.status === "pending" && f.receiver_id === session.user.id).map(f => ({ ...f, friend: f.requester })));
    }
  }

  async function loadClubs() {
    const { count } = await supabase.from("club_members").select("*", { count: "exact", head: true }).eq("user_id", session.user.id);
    setMyClubs(count || 0);
  }

  async function searchUsers(q) {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase.from("profiles").select("id, full_name, username, city, strategy").neq("id", session.user.id).or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).limit(5);
    setSearchResults(data || []);
    setSearching(false);
  }

  async function sendRequest(receiverId) {
    const { error } = await supabase.from("friendships").insert({ requester_id: session.user.id, receiver_id: receiverId, status: "pending" });
    if (error) setMessage("Demande déjà envoyée.");
    else { setMessage("Demande envoyée ✅"); setSearch(""); setSearchResults([]); loadFriendships(); }
    setTimeout(() => setMessage(""), 3000);
  }

  async function acceptRequest(id) { await supabase.from("friendships").update({ status: "accepted" }).eq("id", id); loadFriendships(); }
  async function declineRequest(id) { await supabase.from("friendships").delete().eq("id", id); loadFriendships(); }

  function startEdit() {
    setForm({ full_name: profile.full_name || "", username: profile.username || "", city: profile.city || "", bio: profile.bio || "", strategy: profile.strategy || "ETF passif", investing_since: profile.investing_since || "" });
    setEditing(true);
  }

  async function saveProfile() {
    setSaving(true);
    const { data, error } = await supabase.from("profiles").update({ full_name: form.full_name, username: form.username.toLowerCase().trim(), city: form.city, bio: form.bio, strategy: form.strategy, investing_since: form.investing_since || null }).eq("id", session.user.id).select().single();
    if (!error && data) { setProfile(data); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setEditing(false); setSaving(false);
  }

  // Calcul des valeurs actuelles pour chaque catégorie
  const categoryValues = {
    dca: 28, // statique pour l'instant
    performance: stats.perfPonderee,
    diversification: stats.types,
    discipline: 8, // statique pour l'instant
    portefeuille: stats.positions === 0 ? 0 : stats.positions >= 5 ? (stats.totalPct === 100 ? (stats.brokers >= 3 ? stats.brokers : 100) : stats.positions) : stats.positions,
    communaute: myClubs,
  };

  const initials = profile.full_name ? profile.full_name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?";
  const perf = stats.perfPonderee;
  const alreadyIds = [...friends, ...pending, ...received].map(f => f.friend?.id).filter(Boolean);

  const unlockedCount = BADGE_CATEGORIES.reduce((sum, cat) => {
    const val = categoryValues[cat.id];
    return sum + cat.levels.filter(l => val !== null && val >= l.target).length;
  }, 0);

  return (
    <div>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{profile.full_name || "—"}</div>
            <div style={{ fontSize: 13, color: T.textMuted }}>@{profile.username || "—"}{profile.city ? ` · ${profile.city}` : ""}</div>
            {profile.strategy && <span style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: T.accentBg, color: T.accent }}>{profile.strategy}</span>}
          </div>
          <button style={btnSm} onClick={startEdit}>✏️ Éditer</button>
        </div>

        {profile.bio && <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, marginBottom: 16, padding: "10px 12px", background: T.bgCard, borderRadius: 8 }}>{profile.bio}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            ["Positions", stats.positions, T.accent],
            ["Perf. totale", perf === null ? "—" : `${perf >= 0 ? "+" : ""}${perf.toFixed(2)}%`, perf === null ? T.textFaint : perf >= 0 ? T.accent : T.red],
            ["Depuis", profile.investing_since || "—", "rgba(255,255,255,0.7)"],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: T.bgCard, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
            </div>
          ))}
        </div>
        {saved && <div style={{ marginTop: 12, padding: "8px 12px", background: T.accentBg, borderRadius: 8, fontSize: 13, color: T.accent, textAlign: "center" }}>✅ Profil mis à jour !</div>}
      </div>

      {editing && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>✏️ Modifier mon profil</div>
          {[["Prénom et nom", "full_name", "Raphael Dupont"], ["Nom d'utilisateur", "username", "raphaeld"], ["Ville", "city", "Paris"]].map(([label, key, ph]) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>{label}</label>
              <input style={inp} placeholder={ph} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Bio</label>
          <textarea style={{ ...inp, height: 80, resize: "vertical" }} placeholder="Investisseur passif…" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Stratégie</label>
          <select style={{ ...inp, background: "rgba(255,255,255,0.05)" }} value={form.strategy} onChange={e => setForm({ ...form, strategy: e.target.value })}>
            {STRATEGIES.map(s => <option key={s} style={{ background: "#1e2130" }}>{s}</option>)}
          </select>
          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Investisseur depuis (année)</label>
          <input style={inp} placeholder="2018" type="number" value={form.investing_since} onChange={e => setForm({ ...form, investing_since: e.target.value })} />
          <div style={{ height: "0.5px", background: T.border, margin: "16px 0" }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>Profil investisseur</div>
          <button
            onClick={() => { setEditing(false); setShowKYC(true); }}
            style={{ width: "100%", padding: "10px", background: "rgba(159,225,203,0.06)", border: "0.5px solid rgba(159,225,203,0.2)", borderRadius: 10, fontSize: 13, color: T.accent, cursor: "pointer", fontFamily: "inherit", marginBottom: 14, textAlign: "left" }}
          >
            📋 Modifier mon profil investisseur →
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn} onClick={saveProfile} disabled={saving}>{saving ? "Enregistrement…" : "Sauvegarder"}</button>
            <button style={btnSm} onClick={() => setEditing(false)}>Annuler</button>
          </div>
        </div>
      )}

      {showKYC && (
        <KYC
          session={session}
          profile={profile}
          onComplete={() => { setShowKYC(false); window.location.reload(); }}
          onSkip={() => setShowKYC(false)}
        />
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["stats", "📊 Stats"], ["badges", `🏅 Badges (${unlockedCount})`], ["reseau", "👥 Réseau"]].map(([id, label]) => (
          <button key={id} onClick={() => setSection(id)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${section === id ? T.accent : "rgba(255,255,255,0.1)"}`, background: section === id ? T.accentBg : "none", color: section === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {section === "stats" && (
        <StatsSection profile={profile} session={session} friends={friends} perf={perf} T={T} />
      )}

      {section === "badges" && (
        <Badges session={session} profile={profile} />
      )}

      {section === "reseau" && (
        <div>
          <div style={card}>
            <div style={sectionLabel}>Rechercher un investisseur</div>
            <input style={inp} placeholder="Nom ou @username…" value={search} onChange={e => { setSearch(e.target.value); searchUsers(e.target.value); }} />
            {message && <div style={{ fontSize: 13, color: T.accent, marginBottom: 10 }}>{message}</div>}
            {searching && <div style={{ fontSize: 13, color: T.textFaint }}>Recherche…</div>}
            {searchResults.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
                <Avatar name={u.full_name} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{u.full_name}</div>
                  <div style={{ fontSize: 12, color: T.textFaint }}>@{u.username}</div>
                </div>
                {alreadyIds.includes(u.id) ? <span style={{ fontSize: 12, color: T.textFaint }}>Déjà ajouté</span> : <button style={btnGreen} onClick={() => sendRequest(u.id)}>+ Ajouter</button>}
              </div>
            ))}
            {search.length >= 2 && !searching && searchResults.length === 0 && <div style={{ fontSize: 13, color: T.textFaint }}>Aucun résultat</div>}
          </div>

          {received.length > 0 && (
            <div style={card}>
              <div style={sectionLabel}>Demandes reçues ({received.length})</div>
              {received.map(f => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <Avatar name={f.friend.full_name} size={34} />
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setSelectedPublicUser(f.friend.id)}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.accent }}>{f.friend.full_name}</div>
                    <div style={{ fontSize: 12, color: T.textFaint }}>@{f.friend.username}</div>
                  </div>
                  <button style={btnGreen} onClick={() => acceptRequest(f.id)}>✓</button>
                  <button style={btnRed} onClick={() => declineRequest(f.id)}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div style={card}>
            <div style={sectionLabel}>Mes amis ({friends.length})</div>
            {friends.length === 0 && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem 0" }}>Aucun ami encore 🙂</div>}
            {friends.map(f => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "0.5px solid rgba(255,255,255,0.06)", cursor: "pointer" }} onClick={() => setSelectedPublicUser(f.friend.id)}>
                <Avatar name={f.friend.full_name} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.accent }}>{f.friend.full_name}</div>
                  <div style={{ fontSize: 12, color: T.textFaint }}>@{f.friend.username}{f.friend.city ? ` · ${f.friend.city}` : ""}</div>
                  {f.friend.strategy && <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 999, background: T.accentBg, color: T.accent }}>{f.friend.strategy}</span>}
                </div>
                <button style={btnRed} onClick={() => declineRequest(f.id)}>Retirer</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
