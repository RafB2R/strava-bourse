import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { T as TLive } from "../theme";
import Avatar from "./Avatar";
import Icon from "./Icon";
import Medal from "./Medal";
import { t } from "../i18n";

const FILTERS = [
  { id: "performance", label: "Performance", icon: "up" },
  { id: "regularite", label: "Régularité", icon: "flame" },
  { id: "diversification", label: "Diversification", icon: "globe" },
  { id: "contribution", label: "Contribution", icon: "handshake" },
  { id: "badges", label: "Badges", icon: "award" },
];


const card = (T) => ({ background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, boxShadow: T.cardShadow, padding: "1.25rem", marginBottom: 12 });

// Stats de classement (vue member_stats, une seule requête) pour mes amis et moi,
// ou pour tous les membres selon le périmètre
async function fetchRanking(userId, scope) {
  let query = supabase.from("member_stats").select("id, full_name, username, city, strategy, investing_since, streak_mois, perf, score_diversif, nb_badges, contribution");
  if (scope === "amis") {
    const { data } = await supabase.from("friendships").select("requester_id, receiver_id").eq("status", "accepted").or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
    const ids = [userId];
    if (data) data.forEach(f => { if (f.requester_id !== userId) ids.push(f.requester_id); if (f.receiver_id !== userId) ids.push(f.receiver_id); });
    query = query.in("id", ids);
  }
  const { data: stats } = await query.limit(50);
  return (stats || []).map(s => ({
    ...s,
    perf: s.perf === null ? null : Number(s.perf),
    scoreDiversif: Number(s.score_diversif),
    streak: Number(s.streak_mois),
    nbBadges: Number(s.nb_badges),
    contribution: Number(s.contribution),
    isMe: s.id === userId,
  }));
}

export default function Classements({ session , T: TProp }) {
  const T = TProp || TLive;
  const [filter, setFilter] = useState("performance");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("amis");
  const userId = session.user.id;

  useEffect(() => {
    let ignore = false;
    fetchRanking(userId, scope).then(list => {
      if (ignore) return;
      setUsers(list);
      setLoading(false);
    });
    return () => { ignore = true; };
  }, [userId, scope]);

  // Le tri dépend seulement de `filter` : pas besoin de recharger quand il change
  const sorted = [...users].sort((a, b) => {
    if (filter === "performance") return (b.perf ?? -Infinity) - (a.perf ?? -Infinity);
    if (filter === "regularite") return b.streak - a.streak;
    if (filter === "diversification") return b.scoreDiversif - a.scoreDiversif;
    if (filter === "contribution") return b.contribution - a.contribution;
    if (filter === "badges") return b.nbBadges - a.nbBadges;
    return 0;
  });

  const rankIcon = i => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

  function getValue(u) {
    if (filter === "performance") return { val: u.perf !== null ? `${u.perf >= 0 ? "+" : ""}${u.perf.toFixed(1)}%` : "—", color: u.perf === null ? T.textFaint : u.perf >= 0 ? T.up : T.red };
    if (filter === "regularite") return { val: u.streak > 0 ? t("{n} mois", { n: u.streak }) : "—", icon: u.streak > 0 ? "flame" : null, color: T.yellow };
    if (filter === "diversification") return { val: `${u.scoreDiversif}/100`, color: u.scoreDiversif >= 70 ? T.accent : u.scoreDiversif >= 40 ? T.yellow : T.red };
    if (filter === "contribution") return { val: u.contribution > 0 ? `${u.contribution}` : "—", icon: u.contribution > 0 ? "comment" : null, color: T.purple };
    if (filter === "badges") return { val: `${u.nbBadges}`, icon: "award", color: T.gold };
    return { val: "—", color: T.textFaint };
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: T.textFaint, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><Icon name="trophy" size={14} />{t("Classements Verio")}</div>

      {/* Scope */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["amis", t("Amis"), "users"], ["global", t("Global"), "globe"]].map(([id, label, icon]) => (
          <button key={id} onClick={() => { if (id !== scope) { setLoading(true); setScope(id); } }} style={{ padding: "5px 14px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${scope === id ? T.accent : T.border}`, background: scope === id ? T.accentBg : "none", color: scope === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name={icon} size={14} />{label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${filter === f.id ? T.accent : T.border}`, background: filter === f.id ? T.accentBg : "none", color: filter === f.id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Icon name={f.icon} size={13} />{t(f.label)}
          </button>
        ))}
      </div>

      <div style={card(T)}>
        {loading && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1.5rem" }}>{t("Chargement…")}</div>}

        {!loading && users.length === 0 && (
          <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1.5rem" }}>
            {scope === "amis" ? t("Ajoute des amis pour te comparer") : t("Aucun utilisateur trouvé")}
          </div>
        )}

        {sorted.map((u, i) => {
          const { val, icon, color } = getValue(u);
          return (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i === 0 ? "none" : `0.5px solid ${T.border}`, background: u.isMe ? T.accentBg : "none", borderRadius: 8, paddingLeft: u.isMe ? 8 : 0 }}>
              <div style={{ fontSize: 18, minWidth: 28, textAlign: "center" }}>
                {rankIcon(i) ? <Medal tier={rankIcon(i)} size={20} T={T} /> : <span style={{ fontSize: 13, color: T.textFaint, fontWeight: 600 }}>{i + 1}</span>}
              </div>
              <Avatar userId={u.id} name={u.full_name} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: u.isMe ? T.accent : T.text }}>
                  {u.full_name}
                  {u.isMe && <span style={{ fontSize: 11, color: T.textFaint, marginLeft: 6 }}>· {t("moi")}</span>}
                </div>
                <div style={{ fontSize: 12, color: T.textFaint }}>
                  {u.strategy && <span style={{ marginRight: 8 }}>{t(u.strategy)}</span>}
                  {u.city && <span>{u.city}</span>}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color, textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>{icon && <Icon name={icon} size={14} />}{val}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
