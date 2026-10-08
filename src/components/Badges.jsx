import { useState } from "react";
import { T as TLive } from "../theme";
import { BADGE_CATEGORIES, HIDDEN_BADGES, EMPTY_METRICS } from "../badges";
import Icon from "./Icon";
import Medal from "./Medal";
import { t } from "../i18n";

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

  if (!badgeState) return <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "2rem" }}>{t("Chargement des badges…")}</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["trophees", t("Trophées ({n})", { n: unlockedTotal }), "award"], ["cachés", t("Cachés"), "sparkles"]].map(([id, label, icon]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${activeTab === id ? T.accent : T.border}`, background: activeTab === id ? T.accentBg : "none", color: activeTab === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name={icon} size={14} />{label}
          </button>
        ))}
      </div>

      {activeTab === "trophees" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {BADGE_CATEGORIES.map(cat => {
            const val = metrics[cat.metric];
            const isEarned = isEarnedIn(cat);
            const unlocked = cat.levels.filter(isEarned);
            const { next, progress } = getNextAndProgress(cat, val, isEarned);
            const topBadge = unlocked.length ? unlocked[unlocked.length - 1] : null;
            const isFlipped = flipped[cat.id];

            return (
              <div key={cat.id} onClick={() => toggle(cat.id)} style={{ height: 220, cursor: "pointer", perspective: "800px" }}>
                <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transition: "transform 0.5s ease", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: 14, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px 10px", background: T.bgCard, border: `0.5px solid ${T.border}` }}>
                    <div style={{ marginBottom: 6, color: T.accent }}><Icon emoji={cat.icon} size={26} /></div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.text, textAlign: "center", lineHeight: 1.3 }}>{cat.name}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      {cat.levels.map(l => <Medal key={l.medal} tier={l.medal} size={17} T={T} dim={!isEarned(l)} />)}
                    </div>
                    {topBadge && <div style={{ marginTop: 8, fontSize: 11, color: T.medals[topBadge.medal], display: "flex", alignItems: "center", gap: 4 }}><Medal tier={topBadge.medal} size={13} T={T} />{topBadge.name}</div>}
                    {!topBadge && <div style={{ marginTop: 8, fontSize: 10, color: T.textFaint }}>{t("En cours…")}</div>}
                  </div>

                  <div style={{ position: "absolute", inset: 0, borderRadius: 14, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", padding: "10px 10px 8px", background: T.bgSecondary, border: `0.5px solid ${T.accentBorder}`, overflowY: "auto" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.accent, textAlign: "center", width: "100%", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Icon emoji={cat.icon} size={13} />{cat.name}</div>
                    {cat.levels.map(l => {
                      const done = isEarned(l);
                      return (
                        <div key={l.medal} style={{ display: "flex", alignItems: "center", gap: 5, width: "100%", marginBottom: 4 }}>
                          <Medal tier={l.medal} size={14} T={T} dim={!done} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: done ? T.medals[l.medal] : T.textMuted }}>{l.name}</div>
                            <div style={{ fontSize: 9, color: T.textFaint }}>{l.desc}</div>
                          </div>
                          {done && <Icon name="check" size={12} style={{ color: T.accent }} />}
                        </div>
                      );
                    })}
                    {next && (
                      <>
                        <div style={{ width: "100%", height: 3, background: T.bgSubtle, borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                          <div style={{ width: `${progress.toFixed(0)}%`, height: "100%", background: T.medals[next.medal], borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: 9, color: T.textFaint, textAlign: "center", width: "100%", marginTop: 2 }}>{val === null || val === undefined ? 0 : Math.round(val * 10) / 10} / {next.target} {cat.unit}</div>
                      </>
                    )}
                    {!next && <div style={{ fontSize: 10, color: T.gold, textAlign: "center", width: "100%", marginTop: 4 }}>{t("Max atteint !")}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "cachés" && (
        <div>
          <div style={{ fontSize: 13, color: T.textFaint, marginBottom: 16, lineHeight: 1.6 }}>
            {t("Ces badges se débloquent dans des moments inattendus. Tu ne sais pas quand — jusqu'à ce que ça arrive.")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {HIDDEN_BADGES.map(b => {
              const isUnlocked = earnedIds.has(b.id);
              const isSoon = b.soon && !isUnlocked;
              return (
                <div key={b.id} style={{ background: T.bgCard, border: `0.5px ${isUnlocked ? "solid" : "dashed"} ${isUnlocked ? T.accentBorder : T.borderStrong}`, borderRadius: 14, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: isUnlocked ? T.accentBg : T.bgSubtle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, opacity: isUnlocked ? 1 : 0.6 }}>
                    <Icon emoji={isUnlocked ? b.icon : "🔮"} size={22} style={{ color: isUnlocked ? T.accent : T.textFaint }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isUnlocked ? T.accent : T.textFaint, textAlign: "center", lineHeight: 1.3 }}>
                    {isUnlocked ? b.name : isSoon ? t("Bientôt") : "???"}
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
