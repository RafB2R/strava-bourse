import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { photoStats, simulate, RISK_FREE } from "../compare";
import Icon from "./Icon";

// Comparaison « Moi / ce membre » : un bloc sur une période au choix (simulation à
// répartition actuelle) et un bloc « photo » des positions d'aujourd'hui.
// Affichée dans la colonne de droite sur ordinateur, et sous « Comparer » sur mobile.

const PERIODS = [["1mo", "1M"], ["3mo", "3M"], ["ytd", "YTD"], ["1y", "1A"], ["5y", "5A"]];
const pct = v => `${v >= 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")} %`;
const num = v => v.toFixed(2).replace(".", ",");

// better : "high" (plus haut = mieux), "low" (plus bas = mieux) ou rien (pas de jugement)
const EVOLVING = [
  { key: "perf", label: "Performance", format: pct, better: "high" },
  { key: "vol", label: "Volatilité", format: v => `${v.toFixed(1).replace(".", ",")} %`, better: "low" },
  { key: "sharpe", label: "Ratio de Sharpe", format: num, better: "high" },
  { key: "drawdown", label: "Pire baisse", format: v => `${v.toFixed(1).replace(".", ",")} %`, better: "high" },
];
const PHOTO = [
  { key: "diversif", label: "Diversification", format: v => `${v}/100`, better: "high" },
  { key: "positions", label: "Positions", format: v => `${v}` },
  { key: "maxLine", label: "Plus grosse ligne", format: v => `${Math.round(v)} %`, better: "low" },
  { key: "classes", label: "Classes d'actifs", format: v => `${v}`, better: "high" },
  { key: "etf", label: "Part en ETF", format: v => `${Math.round(v)} %` },
];
const SOON = ["ESG", "Zones géographiques", "Frais des ETF"];

const ENTRY_COLUMNS = "id, label, type, exposition, percentage, broker";

function Row({ label, mine, theirs, format, better, T }) {
  const comparable = better && mine != null && theirs != null && mine !== theirs;
  const meBetter = comparable && (better === "high" ? mine > theirs : mine < theirs);
  const theyBetter = comparable && !meBetter;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 6, padding: "7px 0", borderTop: `0.5px solid ${T.border}`, alignItems: "center" }}>
      <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: meBetter ? T.up : T.text }}>{mine != null ? format(mine) : "—"}</div>
      <div style={{ textAlign: "center", fontSize: 10, color: T.textFaint, minWidth: 84 }}>{label}</div>
      <div style={{ textAlign: "left", fontSize: 13, fontWeight: 700, color: theyBetter ? T.up : T.text }}>{theirs != null ? format(theirs) : "—"}</div>
    </div>
  );
}

export default function Comparison({ myId, theirEntries, theirName, T }) {
  const [mine, setMine] = useState(null); // mes positions
  const [period, setPeriod] = useState("1y");
  const [sim, setSim] = useState({ period: null, mine: null, theirs: null });

  useEffect(() => {
    let ignore = false;
    supabase.from("portfolio_entries").select(`${ENTRY_COLUMNS}, isin`).eq("user_id", myId)
      .then(({ data, error }) => {
        if (!error) return data;
        // la colonne isin peut ne pas être lisible : on se contente du nom
        return supabase.from("portfolio_entries").select(ENTRY_COLUMNS).eq("user_id", myId).then(r => r.data);
      })
      .then(data => { if (!ignore) setMine(data || []); });
    return () => { ignore = true; };
  }, [myId]);

  useEffect(() => {
    if (!mine) return;
    let ignore = false;
    Promise.all([simulate(mine, period).catch(() => null), simulate(theirEntries, period).catch(() => null)])
      .then(([a, b]) => { if (!ignore) setSim({ period, mine: a, theirs: b }); });
    return () => { ignore = true; };
  }, [mine, theirEntries, period]);

  const ready = sim.period === period;
  const photoMine = photoStats(mine), photoTheirs = photoStats(theirEntries);
  const coverage = [ready && sim.mine?.coverage, ready && sim.theirs?.coverage].filter(v => v != null && v !== false);
  const section = { fontSize: 10, color: T.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: "12px 0 6px", display: "flex", alignItems: "center", gap: 5 };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 6, marginBottom: 4 }}>
        <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: T.text }}>Moi</div>
        <div style={{ minWidth: 84 }} />
        <div style={{ textAlign: "left", fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{theirName}</div>
      </div>

      <div style={section}><Icon name="timer" size={12} />Sur la période</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
        {PERIODS.map(([id, label]) => (
          <button key={id} onClick={() => setPeriod(id)} aria-pressed={period === id}
            style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontFamily: "inherit", cursor: "pointer", border: `0.5px solid ${period === id ? T.accent : T.border}`, background: period === id ? T.accentBg : "none", color: period === id ? T.accent : T.textMuted, fontWeight: period === id ? 700 : 400 }}>
            {label}
          </button>
        ))}
      </div>
      {!ready
        ? <div style={{ fontSize: 12, color: T.textFaint, textAlign: "center", padding: "12px 0" }}>Calcul en cours…</div>
        : EVOLVING.map(r => <Row key={r.key} T={T} {...r} mine={sim.mine?.[r.key]} theirs={sim.theirs?.[r.key]} />)}
      <div style={{ fontSize: 10, color: T.textFaint, lineHeight: 1.5, marginTop: 6 }}>
        Simulation : la répartition actuelle appliquée aux cours passés, pas la performance réelle.
        {coverage.length > 0 && ` Calculée sur ${coverage.join(" % et ")} % des portefeuilles.`} Sharpe avec un taux sans risque de {RISK_FREE} %.
      </div>

      <div style={section}><Icon name="camera" size={12} />Positions actuelles</div>
      {PHOTO.map(r => <Row key={r.key} T={T} {...r} mine={photoMine?.[r.key]} theirs={photoTheirs?.[r.key]} />)}
      {SOON.map(label => (
        <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 6, padding: "7px 0", borderTop: `0.5px solid ${T.border}`, alignItems: "center" }}>
          <div style={{ textAlign: "right", fontSize: 11, color: T.textFaint }}>bientôt</div>
          <div style={{ textAlign: "center", fontSize: 10, color: T.textFaint, minWidth: 84 }}>{label}</div>
          <div style={{ textAlign: "left", fontSize: 11, color: T.textFaint }}>bientôt</div>
        </div>
      ))}
    </div>
  );
}
