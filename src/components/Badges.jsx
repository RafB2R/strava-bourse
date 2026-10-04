import { useState } from "react";
import { T as TLive } from "../theme";
import { BADGE_CATEGORIES, HIDDEN_BADGES, IDENTITIES, MEDAL_COLORS, EMPTY_METRICS } from "../badges";

// Premier palier pas encore gagné et progression vers lui (les badges gagnés sont définitifs)
function getNextAndProgress(cat, value, isEarned) {
  const next = cat.levels.find(l => !isEarned(l));
  if (!next) return { next: null, progress: 100 };
  if (value === null || value === undefined) return { next, progress: 0 };
  const idx = cat.levels.indexOf(next);
  const prev = idx > 0 ? cat.levels[idx - 1].target : 0;
  return { next, progress: Math.max(0, Math.min(((value - prev) / (next.target - prev)) * 100, 100)) };
}

// badgeState : résultat de syncBadges() ({ metrics, badges }), chargé par Profil
export default function Badges({ badgeState, T: TProp }) {
  const T = TProp || TLive;
  const [flipped, setFlipped] = useState({});
  const [activeTab, setActiveTab] = useState("trophees");
  const metrics = badgeState?.metrics || EMPTY_METRICS;
  const earnedIds = new Set((badgeState?.badges || []).map(b => b.badge_id));
  const isEarnedIn = cat => level => earnedIds.has(`${cat.id}_${level.medal}`);

  function toggle(id) { setFlipped(p => ({ ...p, [id]: !p[id] })); }

  const unlockedTotal = BADGE_CATEGORIES.reduce((sum, cat) => sum + cat.levels.filter(isEarnedIn(cat)).length, 0);
  const myIdentities = IDENTITIES.filter(id => id.condition(metrics));

  if (!badgeState) return <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "2rem" }}>Chargement des badges…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["trophees", `🏅 Trophées (${unlockedTotal})`], ["identite", `✨ Identité`], ["cachés", "🔮 Cachés"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${activeTab === id ? T.accent : T.border}`, background: activeTab === id ? T.accentBg : "none", color: activeTab === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "trophees" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {BADGE_CATEGORIES.map(cat => {
            const val = metrics[cat.metric];
            const isEarned = isEarnedIn(cat);
            const unlocked = cat.levels.filter(isEarned);
            const { next, progress } = getNextAndProgress(cat, val, isEarned);
            const topBadge = unlocked.length ? unlocked[unlocked.length - 1] : null;
            const isFlipped = flipped[cat.id];

            return (
              <div key={cat.id} onClick={() => toggle(cat.id)} style={{ height: 160, cursor: "pointer", perspective: "800px" }}>
                <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transition: "transform 0.5s ease", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: 14, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px 10px", background: T.bgCard, border: `0.5px solid ${T.border}` }}>
                    <div style={{ fontSize: 26, marginBottom: 6 }}>{cat.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.text, textAlign: "center", lineHeight: 1.3 }}>{cat.name}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      {cat.levels.map(l => <span key={l.medal} style={{ fontSize: 14, opacity: isEarned(l) ? 1 : 0.2 }}>{l.medal}</span>)}
                    </div>
                    {topBadge && <div style={{ marginTop: 8, fontSize: 11, color: MEDAL_COLORS[topBadge.medal] }}>{topBadge.medal} {topBadge.name}</div>}
                    {!topBadge && <div style={{ marginTop: 8, fontSize: 10, color: T.textFaint }}>En cours…</div>}
                  </div>

                  <div style={{ position: "absolute", inset: 0, borderRadius: 14, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", padding: "10px 10px 8px", background: "#1e2235", border: "0.5px solid rgba(159,225,203,0.15)", overflow: "hidden" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.accent, textAlign: "center", width: "100%", marginBottom: 8 }}>{cat.icon} {cat.name}</div>
                    {cat.levels.map(l => {
                      const done = isEarned(l);
                      return (
                        <div key={l.medal} style={{ display: "flex", alignItems: "center", gap: 5, width: "100%", marginBottom: 4 }}>
                          <span style={{ fontSize: 12 }}>{l.medal}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: done ? MEDAL_COLORS[l.medal] : T.textMuted }}>{l.name}</div>
                            <div style={{ fontSize: 9, color: T.textFaint }}>{l.desc}</div>
                          </div>
                          {done && <span style={{ fontSize: 10, color: T.accent }}>✓</span>}
                        </div>
                      );
                    })}
                    {next && (
                      <>
                        <div style={{ width: "100%", height: 3, background: T.bgCard, borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                          <div style={{ width: `${progress.toFixed(0)}%`, height: "100%", background: MEDAL_COLORS[next.medal], borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: 9, color: T.textFaint, textAlign: "center", width: "100%", marginTop: 2 }}>{val === null || val === undefined ? 0 : Math.round(val * 10) / 10} / {next.target} {cat.unit}</div>
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
          <div style={{ fontSize: 13, color: T.textFaint, marginBottom: 16, lineHeight: 1.6 }}>
            Ton identité d'investisseur se construit avec le temps. Elle ne se choisit pas — elle se révèle.
          </div>
          {myIdentities.length === 0 && (
            <div style={{ background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: "2rem", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🌱</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>Ton identité se construit</div>
              <div style={{ fontSize: 13, color: T.textFaint }}>Continue d'investir pour révéler qui tu es</div>
            </div>
          )}
          {myIdentities.map(id => (
            <div key={id.id} style={{ background: T.bgCard, border: "0.5px solid rgba(159,225,203,0.2)", borderRadius: 14, padding: "1.25rem", marginBottom: 10, display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{id.icon}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.accent, marginBottom: 4 }}>{id.name}</div>
                <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{id.desc}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Identités à débloquer</div>
            {IDENTITIES.filter(id => !id.condition(metrics)).map(id => (
              <div key={id.id} style={{ background: T.border, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: "1rem 1.25rem", marginBottom: 8, display: "flex", gap: 12, alignItems: "center", opacity: 0.45 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.bgCard, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{id.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.textMuted }}>{id.name}</div>
                  <div style={{ fontSize: 12, color: T.textFaint }}>{id.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "cachés" && (
        <div>
          <div style={{ fontSize: 13, color: T.textFaint, marginBottom: 16, lineHeight: 1.6 }}>
            Ces badges se débloquent dans des moments inattendus. Tu ne sais pas quand — jusqu'à ce que ça arrive.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {HIDDEN_BADGES.map(b => {
              const isUnlocked = earnedIds.has(b.id);
              const isSoon = b.soon && !isUnlocked;
              return (
                <div key={b.id} style={{ background: T.bgCard, border: `0.5px solid ${isUnlocked ? "rgba(159,225,203,0.3)" : T.bgCard}`, borderRadius: 14, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: isUnlocked ? 1 : isSoon ? 0.3 : 0.5 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: isUnlocked ? T.accentBg : T.bgCard, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {isUnlocked ? b.icon : "🔮"}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isUnlocked ? T.accent : T.textMuted, textAlign: "center", lineHeight: 1.3 }}>
                    {isUnlocked ? b.name : isSoon ? "Bientôt" : "???"}
                  </div>
                  {isUnlocked && <div style={{ fontSize: 10, color: T.textFaint, textAlign: "center" }}>{b.desc}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
