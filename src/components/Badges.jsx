import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const CATS = [
  {
    id: "milestones", icon: "📅", name: "Milestones", desc: "Le temps est ton meilleur allié.",
    levels: [
      { medal: "🥉", name: "1 an investisseur", desc: "Membre depuis 1 an", target: 1 },
      { medal: "🥈", name: "5 ans investisseur", desc: "Membre depuis 5 ans", target: 5 },
      { medal: "🥇", name: "10 ans investisseur", desc: "Membre depuis 10 ans", target: 10 },
      { medal: "💎", name: "Compounder", desc: "25 ans d'investissement — le badge le plus rare", target: 25 },
    ],
    getValue: (d) => d.years,
    unit: "ans",
  },
  {
    id: "builder", icon: "🏛️", name: "Builder", desc: "Construis un vrai portefeuille, brique par brique.",
    levels: [
      { medal: "🥉", name: "Premier portefeuille", desc: "1er investissement ajouté", target: 1 },
      { medal: "🥈", name: "En construction", desc: "10 investissements", target: 10 },
      { medal: "🥇", name: "Architecte", desc: "50 investissements", target: 50 },
      { medal: "💎", name: "Master Builder", desc: "100 investissements", target: 100 },
    ],
    getValue: (d) => d.positions,
    unit: "positions",
  },
  {
    id: "explorer", icon: "🌍", name: "Explorer", desc: "Découvre les marchés du monde entier.",
    levels: [
      { medal: "🥉", name: "Premier ETF", desc: "Premier ETF dans le portefeuille", target: 1 },
      { medal: "🥈", name: "Diversifié", desc: "3 types d'actifs différents", target: 3 },
      { medal: "🥇", name: "Global Investor", desc: "5 types d'actifs différents", target: 5 },
      { medal: "💎", name: "Portefeuille mondial", desc: "8 types d'actifs ou plus", target: 8 },
    ],
    getValue: (d) => d.types,
    unit: "types",
  },
  {
    id: "diversification", icon: "📊", name: "Diversification", desc: "Ne jamais mettre tous ses œufs dans le même panier.",
    levels: [
      { medal: "🥉", name: "Premiers pas", desc: "3 positions différentes", target: 3 },
      { medal: "🥈", name: "Équilibré", desc: "5 positions différentes", target: 5 },
      { medal: "🥇", name: "Bien réparti", desc: "8 positions différentes", target: 8 },
      { medal: "💎", name: "Portefeuille complet", desc: "10 positions ou plus", target: 10 },
    ],
    getValue: (d) => d.positions,
    unit: "positions",
  },
  {
    id: "climber", icon: "🏔️", name: "Climber", desc: "La progression, pas le montant.",
    levels: [
      { medal: "🥉", name: "Premiers gains", desc: "+10% de performance totale", target: 10 },
      { medal: "🥈", name: "En route", desc: "+50% de performance totale", target: 50 },
      { medal: "🥇", name: "Double mise", desc: "+100% de performance totale", target: 100 },
      { medal: "💎", name: "x10", desc: "+1000% de performance totale", target: 1000 },
    ],
    getValue: (d) => d.perf,
    unit: "%",
  },
  {
    id: "community", icon: "🤝", name: "Community", desc: "Investir mieux, ensemble.",
    levels: [
      { medal: "🥉", name: "Premier pas", desc: "Rejoindre un club", target: 1 },
      { medal: "🥈", name: "Membre actif", desc: "Membre de 3 clubs", target: 3 },
      { medal: "🥇", name: "Contributeur", desc: "Fondateur d'un club", target: 5 },
      { medal: "💎", name: "Mentor", desc: "Club de 100 membres", target: 10 },
    ],
    getValue: (d) => d.clubs,
    unit: "clubs",
  },
];

const HIDDEN_BADGES_DEF = [
  { id: "night_owl", icon: "🌙", name: "Night Owl", desc: "Premier investissement de nuit", soon: true },
  { id: "birthday", icon: "🎂", name: "Birthday Investor", desc: "Investi le jour de ton anniversaire" },
  { id: "xmas", icon: "🎄", name: "Christmas Investor", desc: "Investi le 25 décembre", soon: true },
  { id: "never_panic", icon: "🧘", name: "Never Panic", desc: "Traverser un bear market sans toucher son allocation", soon: true },
  { id: "diamond_hands", icon: "💎", name: "Diamond Hands", desc: "Garder une position plus de 10 ans", soon: true },
  { id: "monday", icon: "📆", name: "Monday Investor", desc: "Investir chaque premier lundi du mois pendant un an", soon: true },
];

const IDENTITIES = [
  { id: "builder_id", icon: "🏛️", name: "Builder", desc: "Tu construis patiemment, brique par brique.", condition: (d) => d.positions >= 10 },
  { id: "explorer_id", icon: "🧭", name: "Explorer", desc: "Tu explores les marchés du monde.", condition: (d) => d.types >= 5 },
  { id: "scholar_id", icon: "📚", name: "Scholar", desc: "Tu apprends avant d'investir.", condition: (d) => d.clubs >= 2 },
  { id: "mentor_id", icon: "🤝", name: "Mentor", desc: "Tu aides les autres à progresser.", condition: (d) => d.clubs >= 5 },
  { id: "compounder_id", icon: "📈", name: "Long-Term Investor", desc: "Tu penses en années, pas en jours.", condition: (d) => d.years >= 5 },
  { id: "global_id", icon: "🌍", name: "Global Investor", desc: "Ton portefeuille traverse les frontières.", condition: (d) => d.types >= 6 },
];

const MEDAL_COLORS = { "🥉": "#CD7F32", "🥈": "#C0C0C0", "🥇": "#FFD700", "💎": "#B9F2FF" };

function getUnlocked(cat, val) {
  if (val === null || val === undefined) return [];
  return cat.levels.filter(l => val >= l.target);
}

function getNext(cat, val) {
  if (val === null || val === undefined) return cat.levels[0];
  return cat.levels.find(l => val < l.target) || null;
}

function getProgress(cat, val) {
  if (val === null || val === undefined) return 0;
  const next = getNext(cat, val);
  if (!next) return 100;
  const idx = cat.levels.indexOf(next);
  const prev = idx > 0 ? cat.levels[idx - 1].target : 0;
  return Math.min(((val - prev) / (next.target - prev)) * 100, 100);
}

export default function Badges({ session, profile }) {
  const [data, setData] = useState({ perf: null, types: 0, positions: 0, clubs: 0, years: null, brokers: 0, totalPct: 0 });
  const [flipped, setFlipped] = useState({});
  const [unlockedBadgeIds, setUnlockedBadgeIds] = useState([]);
  const [activeTab, setActiveTab] = useState("trophees");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: entries } = await supabase.from("portfolio_entries").select("performance, percentage, type, broker").eq("user_id", session.user.id);
    const { count: clubCount } = await supabase.from("club_members").select("*", { count: "exact", head: true }).eq("user_id", session.user.id);

    // Charger badges débloqués
    const { data: unlockedBadges } = await supabase.from("user_badges").select("badge_id, unlocked_at").eq("user_id", session.user.id);
    const unlockedIds = (unlockedBadges || []).map(b => b.badge_id);

    // Vérifier Birthday
    if (profile?.date_naissance && !unlockedIds.includes("birthday")) {
      const today = new Date();
      const birth = new Date(profile.date_naissance);
      if (today.getDate() === birth.getDate() && today.getMonth() === birth.getMonth()) {
        await supabase.from("user_badges").insert({ user_id: session.user.id, badge_id: "birthday" });
        unlockedIds.push("birthday");
        await supabase.from("activities").insert({ user_id: session.user.id, type: "badge", data: { badge_id: "birthday", badge_name: "Birthday Investor", badge_medal: "🎂" } });
      }
    }




    let perf = null, types = 0, positions = 0, brokers = 0, totalPct = 0;

    if (entries && entries.length > 0) {
      positions = entries.length;
      types = new Set(entries.map(e => e.type)).size;
      brokers = new Set(entries.filter(e => e.broker).map(e => e.broker)).size;
      totalPct = entries.reduce((s, e) => s + Number(e.percentage), 0);
      const avecPerf = entries.filter(e => e.performance !== null);
      const tPct = avecPerf.reduce((s, e) => s + Number(e.percentage), 0);
      if (tPct > 0) perf = avecPerf.reduce((s, e) => s + Number(e.performance) * Number(e.percentage) / tPct, 0);
    }

    const years = profile?.investing_since ? new Date().getFullYear() - Number(profile.investing_since) : null;

    // Calculer streak réel depuis les activités
    const { data: acts } = await supabase
      .from("activities")
      .select("created_at")
      .eq("user_id", session.user.id)
      .in("type", ["new_position", "renforcement", "rebalancement"])
      .order("created_at", { ascending: false });

    let streakMois = 0;
    if (acts && acts.length > 0) {
      const moisInvestis = new Set(acts.map(a => {
        const d = new Date(a.created_at);
        return `${d.getFullYear()}-${d.getMonth()}`;
      }));
      const now = new Date();
      let current = new Date(now.getFullYear(), now.getMonth(), 1);
      while (true) {
        const key = `${current.getFullYear()}-${current.getMonth()}`;
        if (moisInvestis.has(key)) { streakMois++; current.setMonth(current.getMonth() - 1); }
        else break;
      }
    }

    setData({ perf, types, positions, clubs: clubCount || 0, years, brokers, totalPct, dcaMonths: streakMois });

    // Synchroniser les badges débloqués en base
    const vals = {
      milestones: years,
      builder: positions,
      explorer: types,
      climber: perf,
      diversification: positions,
      community: clubCount || 0,
      dca: streakMois,
    };
    const CATS_SYNC = [
      { id: "milestones", levels: [{ target: 1, medal: "🥉" }, { target: 5, medal: "🥈" }, { target: 10, medal: "🥇" }, { target: 25, medal: "💎" }] },
      { id: "builder", levels: [{ target: 1, medal: "🥉" }, { target: 10, medal: "🥈" }, { target: 50, medal: "🥇" }, { target: 100, medal: "💎" }] },
      { id: "explorer", levels: [{ target: 1, medal: "🥉" }, { target: 3, medal: "🥈" }, { target: 5, medal: "🥇" }, { target: 8, medal: "💎" }] },
      { id: "climber", levels: [{ target: 10, medal: "🥉" }, { target: 50, medal: "🥈" }, { target: 100, medal: "🥇" }, { target: 1000, medal: "💎" }] },
      { id: "diversification", levels: [{ target: 3, medal: "🥉" }, { target: 5, medal: "🥈" }, { target: 8, medal: "🥇" }, { target: 10, medal: "💎" }] },
      { id: "community", levels: [{ target: 1, medal: "🥉" }, { target: 3, medal: "🥈" }, { target: 5, medal: "🥇" }, { target: 10, medal: "💎" }] },
      { id: "dca", levels: [{ target: 3, medal: "🥉" }, { target: 12, medal: "🥈" }, { target: 36, medal: "🥇" }, { target: 120, medal: "💎" }] },
    ];

    const toSync = [];
    for (const cat of CATS_SYNC) {
      const val = vals[cat.id];
      if (val === null || val === undefined) continue;
      for (const level of cat.levels) {
        if (val >= level.target) {
          const badgeId = `${cat.id}_${level.medal}`;
          if (!unlockedIds.includes(badgeId)) toSync.push({ user_id: session.user.id, badge_id: badgeId });
        }
      }
    }
    if (toSync.length > 0) {
      await supabase.from("user_badges").upsert(toSync, { onConflict: "user_id,badge_id" });
      toSync.forEach(b => unlockedIds.push(b.badge_id));
      // Notifier pour chaque nouveau badge
      const notifBadges = toSync.map(b => ({
        user_id: session.user.id,
        type: "badge_unlocked",
        data: { badge_id: b.badge_id, badge_name: b.badge_id.split("_")[0], badge_medal: b.badge_id.split("_")[1] }
      }));
      if (notifBadges.length > 0) await supabase.from("notifications").insert(notifBadges);
    }
    setUnlockedBadgeIds([...unlockedIds]);
  }

  function toggle(id) { setFlipped(p => ({ ...p, [id]: !p[id] })); }

  const unlockedTotal = CATS.reduce((sum, cat) => sum + getUnlocked(cat, cat.getValue(data)).length, 0);
  const myIdentities = IDENTITIES.filter(id => id.condition(data));

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["trophees", `🏅 Trophées (${unlockedTotal})`], ["identite", `✨ Identité`], ["cachés", "🔮 Cachés"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${activeTab === id ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: activeTab === id ? "rgba(159,225,203,0.1)" : "none", color: activeTab === id ? "#9FE1CB" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "trophees" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {CATS.map(cat => {
            const val = cat.getValue(data);
            const unlocked = getUnlocked(cat, val);
            const next = getNext(cat, val);
            const progress = getProgress(cat, val);
            const topBadge = unlocked.length ? unlocked[unlocked.length - 1] : null;
            const isFlipped = flipped[cat.id];

            return (
              <div key={cat.id} onClick={() => toggle(cat.id)} style={{ height: 160, cursor: "pointer", perspective: "800px" }}>
                <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transition: "transform 0.5s ease", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: 14, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px 10px", background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 26, marginBottom: 6 }}>{cat.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", textAlign: "center", lineHeight: 1.3 }}>{cat.name}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      {cat.levels.map(l => <span key={l.medal} style={{ fontSize: 14, opacity: (val !== null && val >= l.target) ? 1 : 0.2 }}>{l.medal}</span>)}
                    </div>
                    {topBadge && <div style={{ marginTop: 8, fontSize: 11, color: MEDAL_COLORS[topBadge.medal] }}>{topBadge.medal} {topBadge.name}</div>}
                    {!topBadge && <div style={{ marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>En cours…</div>}
                  </div>

                  <div style={{ position: "absolute", inset: 0, borderRadius: 14, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", padding: "10px 10px 8px", background: "#1e2235", border: "0.5px solid rgba(159,225,203,0.15)", overflow: "hidden" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#9FE1CB", textAlign: "center", width: "100%", marginBottom: 8 }}>{cat.icon} {cat.name}</div>
                    {cat.levels.map(l => {
                      const done = val !== null && val >= l.target;
                      return (
                        <div key={l.medal} style={{ display: "flex", alignItems: "center", gap: 5, width: "100%", marginBottom: 4 }}>
                          <span style={{ fontSize: 12 }}>{l.medal}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: done ? MEDAL_COLORS[l.medal] : "rgba(255,255,255,0.35)" }}>{l.name}</div>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{l.desc}</div>
                          </div>
                          {done && <span style={{ fontSize: 10, color: "#9FE1CB" }}>✓</span>}
                        </div>
                      );
                    })}
                    {next && (
                      <>
                        <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                          <div style={{ width: `${progress.toFixed(0)}%`, height: "100%", background: MEDAL_COLORS[next.medal], borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "center", width: "100%", marginTop: 2 }}>{val ?? 0} / {next.target} {cat.unit}</div>
                      </>
                    )}
                    {!next && <div style={{ fontSize: 10, color: "#FFD700", textAlign: "center", width: "100%", marginTop: 4 }}>💎 Max atteint !</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "identite" && (
        <div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 16, lineHeight: 1.6 }}>
            Ton identité d'investisseur se construit avec le temps. Elle ne se choisit pas — elle se révèle.
          </div>
          {myIdentities.length === 0 && (
            <div style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "2rem", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🌱</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>Ton identité se construit</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Continue d'investir pour révéler qui tu es</div>
            </div>
          )}
          {myIdentities.map(id => (
            <div key={id.id} style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(159,225,203,0.2)", borderRadius: 14, padding: "1.25rem", marginBottom: 10, display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(159,225,203,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{id.icon}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#9FE1CB", marginBottom: 4 }}>{id.name}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{id.desc}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Identités à débloquer</div>
            {IDENTITIES.filter(id => !id.condition(data)).map(id => (
              <div key={id.id} style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "1rem 1.25rem", marginBottom: 8, display: "flex", gap: 12, alignItems: "center", opacity: 0.45 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{id.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>{id.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{id.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "cachés" && (
        <div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 16, lineHeight: 1.6 }}>
            Ces badges se débloquent dans des moments inattendus. Tu ne sais pas quand — jusqu'à ce que ça arrive.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {HIDDEN_BADGES_DEF.map(b => {
              const isUnlocked = unlockedBadgeIds.includes(b.id);
              const isSoon = b.soon && !isUnlocked;
              return (
                <div key={b.id} style={{ background: "rgba(255,255,255,0.04)", border: `0.5px solid ${isUnlocked ? "rgba(159,225,203,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 14, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: isUnlocked ? 1 : isSoon ? 0.3 : 0.5 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: isUnlocked ? "rgba(159,225,203,0.1)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {isUnlocked ? b.icon : "🔮"}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isUnlocked ? "#9FE1CB" : "rgba(255,255,255,0.4)", textAlign: "center", lineHeight: 1.3 }}>
                    {isUnlocked ? b.name : isSoon ? "Bientôt" : "???"}
                  </div>
                  {isUnlocked && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>{b.desc}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
