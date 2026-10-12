import { useState, useEffect } from "react";
import { buildHistory, windowOf } from "../history";
import Icon from "./Icon";
import { t, LOCALE } from "../i18n";

// Courbe du portefeuille (privé) : valeur en € ou performance en %, jour par jour,
// reconstruite à partir des cours depuis la date d'achat de chaque position.

const WINDOWS = [["1mo", "1M"], ["3mo", "3M"], ["1y", "1A"], ["all", "Tout"]];
const eur = v => v.toLocaleString(LOCALE, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const pct = v => `${v >= 0 ? "+" : ""}${v.toFixed(2)} %`;
const date = d => new Date(`${d}T12:00:00`).toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });

// mode : « value » (€), « perf » (%) ou « base » (base 100 au premier point)
export function HistoryChart({ points, mode, T }) {
  const [hover, setHover] = useState(null);
  const W = 600, H = 160, pad = 10;
  const ys = points.map(p => (mode === "value" ? p.value : mode === "base" ? 100 * (1 + p.perf / 100) : p.perf));
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const x = i => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = v => H - pad - ((v - min) / span) * (H - pad * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(ys[i]).toFixed(1)}`).join(" ");
  const last = mode === "perf" ? ys[ys.length - 1] : ys[ys.length - 1] - ys[0];
  const color = last >= 0 ? T.up : T.red;
  const locate = (clientX, el) => {
    const r = el.getBoundingClientRect();
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(((clientX - r.left) / r.width) * (points.length - 1)))));
  };
  const h = hover !== null ? points[hover] : null;
  return (
    <div>
      <div style={{ height: 18, fontSize: 12, color: T.textMuted, marginBottom: 4 }}>
        {h ? <><strong style={{ color: T.text }}>{mode === "value" ? eur(h.value) : mode === "base" ? (100 * (1 + h.perf / 100)).toFixed(1) : pct(h.perf)}</strong> · {date(h.day)}</> : null}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={t("Évolution du portefeuille")}
        style={{ width: "100%", height: 160, display: "block", touchAction: "pan-y", cursor: "crosshair" }}
        onMouseMove={e => locate(e.clientX, e.currentTarget)} onMouseLeave={() => setHover(null)}
        onTouchMove={e => locate(e.touches[0].clientX, e.currentTarget)} onTouchEnd={() => setHover(null)}>
        <defs>
          <linearGradient id={`pf-hist-${mode}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {points.length > 1 && <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#pf-hist-${mode})`} />}
        {points.length > 1
          ? <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          : <circle cx={x(0)} cy={H / 2} r="4" fill={color} />}
        {h && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke={T.borderStrong} strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textFaint, marginTop: 4 }}>
        <span>{date(points[0].day)}</span>
        <span>{date(points[points.length - 1].day)}</span>
      </div>
    </div>
  );
}

export default function PortfolioHistory({ entries, T }) {
  const key = JSON.stringify((entries || []).map(e => [e.id, e.isin, e.label, e.percentage, e.nombre_parts, e.prix_actuel, e.date_achat, e.created_at]));
  const [state, setState] = useState({ key: null, history: null });
  const [win, setWin] = useState("all");
  const [mode, setMode] = useState("value");

  useEffect(() => {
    let ignore = false;
    buildHistory(entries).catch(() => null).then(history => { if (!ignore) setState({ key, history }); });
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const box = { borderRadius: 10, border: `0.5px dashed ${T.border}`, padding: "18px 12px", textAlign: "center", marginBottom: 10 };
  if (state.key !== key) return <div style={{ ...box, fontSize: 12, color: T.textFaint }}>{t("Calcul de l'historique…")}</div>;
  const history = state.history;
  const all = history?.points || [];
  if (!all.length) {
    return (
      <div style={box}>
        <div style={{ fontSize: 13, color: T.textMuted, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="up" size={14} />{t("Historique indisponible")}</div>
        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4 }}>{t("Ajoute l'ISIN de tes positions pour que Verio retrouve leurs cours.")}</div>
      </div>
    );
  }

  const points = windowOf(history, win);
  const hasValue = points.length > 0 && points.every(p => p.value !== null);
  const shownMode = hasValue ? mode : "perf";
  const lastP = points[points.length - 1];
  const chip = on => ({ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontFamily: "inherit", cursor: "pointer", border: `0.5px solid ${on ? T.accent : T.border}`, background: on ? T.accentBg : "none", color: on ? T.accent : T.textMuted, fontWeight: on ? 700 : 400 });

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {WINDOWS.map(([id, label]) => <button key={id} onClick={() => setWin(id)} aria-pressed={win === id} style={chip(win === id)}>{t(label)}</button>)}
        <span style={{ flex: 1 }} />
        {hasValue && [["value", "€"], ["perf", "%"]].map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)} aria-pressed={shownMode === id} aria-label={id === "value" ? t("Valeur") : t("Performance")} style={chip(shownMode === id)}>{label}</button>
        ))}
      </div>
      {points.length > 0 && lastP && (
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 2 }}>
          <span style={{ fontWeight: 700, color: lastP.perf >= 0 ? T.up : T.red }}>{pct(lastP.perf)}</span>{" "}
          {t("sur la période, hors apports")}
        </div>
      )}
      {points.length > 0 && <HistoryChart points={points} mode={shownMode} T={T} />}
      <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.5, marginTop: 6 }}>
        {all.length === 1
          ? t("La courbe démarre aujourd'hui. Indique la date d'achat de tes positions pour voir leur historique.")
          : t("Reconstruit à partir des cours, depuis la date d'achat de chaque position (sinon son ajout), avec tes parts actuelles.")}
        {history.coverage < 100 && ` ${t("Calculé sur {v} % du portefeuille (positions dont le cours est connu).", { v: history.coverage })}`}
      </div>
    </div>
  );
}
