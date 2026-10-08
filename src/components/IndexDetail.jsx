import { useState, useEffect } from "react";
import { T as TLive } from "../theme";
import Flag from "./Flag";
import Icon from "./Icon";
import { PERIODS, DEFAULT_PERIOD, TOP5_UPDATED, INDICES, fetchChart, fmtChange, periodPhrase } from "../indices";
import { supabase } from "../supabase";
import { isFollowingAsset, setFollowingAsset, newsName } from "../assetFollows";
import NewsList from "./NewsList";
import { t, LOCALE } from "../i18n";

// 0 décimale au-delà de 1 000, 4 sous 10 (devises), 2 sinon
const fmtPrice = p => (p === null || p === undefined ? "—" : p.toLocaleString(LOCALE, { maximumFractionDigits: p > 1000 ? 0 : p < 10 ? 4 : 2 }));
// Valeur affichée selon le type : taux en %, sinon cours avec son unité ($/oz…)
const valueFormatter = index => (index.isRate
  ? v => (v === null || v === undefined ? "—" : `${v.toFixed(2).replace(".", ",")} %`)
  : v => `${fmtPrice(v)}${index.unit && v != null ? ` ${index.unit}` : ""}`);
// Variation d'un taux en points de pourcentage (la variation en % d'un taux n'a pas de sens)
const fmtPoints = d => `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(2).replace(".", ",")} pt`;

function fmtDate(ts, period) {
  const d = new Date(ts);
  if (period === "1d") return d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
  if (period === "5d") return d.toLocaleString(LOCALE, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
}

// Mini-courbe sans axe, pour la tuile d'un indice
export function Sparkline({ points, color, width = 96, height = 32 }) {
  if (!points || points.length < 2) return <div style={{ width, height }} />;
  const ys = points.map(p => p[1]);
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const d = points.map((p, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * width).toFixed(1)},${(height - 2 - ((p[1] - min) / span) * (height - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Courbe interactive : survol ou doigt pour lire la date et le cours
// « base » : clôture de la veille (1J), en pointillé, pour lire la variation du jour
function LineChart({ points, period, color, T, fmt = fmtPrice, base = null }) {
  const [hover, setHover] = useState(null);
  const W = 600, H = 220, padY = 12;
  const ys = points.map(p => p[1]).concat(base != null ? [base] : []);
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const x = i => (i / (points.length - 1)) * W;
  const y = v => H - padY - ((v - min) / span) * (H - padY * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const gradId = `grad-${color.replace(/[^a-z0-9]/gi, "")}`;

  function locate(clientX, target) {
    const rect = target.getBoundingClientRect();
    const i = Math.round(((clientX - rect.left) / rect.width) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  const h = hover !== null ? points[hover] : null;
  return (
    <div style={{ position: "relative" }}>
      <div style={{ height: 22, fontSize: 12, color: T.textMuted, marginBottom: 4 }}>
        {h ? <><strong style={{ color: T.text }}>{fmt(h[1])}</strong> · {fmtDate(h[0], period)}</> : <span style={{ color: T.textFaint }}>{t("Survole la courbe pour lire un point")}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={t("Évolution de l'indice sur la période")}
        style={{ width: "100%", height: 220, display: "block", touchAction: "pan-y", cursor: "crosshair" }}
        onMouseMove={e => locate(e.clientX, e.currentTarget)} onMouseLeave={() => setHover(null)}
        onTouchMove={e => locate(e.touches[0].clientX, e.currentTarget)} onTouchEnd={() => setHover(null)}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {base != null && <line x1="0" x2={W} y1={y(base)} y2={y(base)} stroke={T.textFaint} strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
        {h && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke={T.borderStrong} strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textFaint, marginTop: 4 }}>
        <span>{fmtDate(points[0][0], period)}</span>
        <span>{fmtDate(points[points.length - 1][0], period)}</span>
      </div>
      {base != null && <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4 }}>{t("Pointillés : clôture de la veille ({v})", { v: fmt(base) })}</div>}
    </div>
  );
}

// Fiche d'un indice (avec présentation et top 5) ou de n'importe quelle valeur
// (action, ETF… : seulement la courbe). « backLabel » : texte du bouton retour.
export default function IndexDetail({ index, onBack, T: TProp, backLabel = t("← Marchés"), initialPeriod = DEFAULT_PERIOD }) {
  const T = TProp || TLive;
  // « index.periods » : périodes proposées (historique mensuel des taux OAT et Bund : pas de 1J…)
  const periods = index.periods ? PERIODS.filter(p => index.periods.includes(p.id)) : PERIODS;
  const firstPeriod = [initialPeriod, DEFAULT_PERIOD, periods[0]?.id].find(id => periods.some(p => p.id === id));
  const [period, setPeriod] = useState(firstPeriod);
  const [company, setCompany] = useState(null); // poids lourd ouvert depuis la fiche de l'indice
  const top5 = index.top5 || [];
  const fmtValue = valueFormatter(index);
  const [chart, setChart] = useState(null); // { period, data }
  const [top, setTop] = useState(null); // { period, rows }
  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, boxShadow: T.cardShadow, borderRadius: 14, padding: "1.25rem", marginBottom: 12 };
  const sectionLabel = { fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 };

  useEffect(() => {
    let ignore = false;
    fetchChart(index.symbol, period).then(data => { if (!ignore) setChart({ period, data }); });
    Promise.all((index.top5 || []).map(async c => ({ ...c, data: await fetchChart(c.symbol, period) })))
      .then(rows => { if (!ignore) setTop({ period, rows }); });
    return () => { ignore = true; };
  }, [index, period]);

  // Société (action) : on peut la suivre, et la fiche montre ses chiffres clés et ses actualités
  const isCompany = index.type === "Action";
  // Un indice connu (CAC 40, S&P 500…) se suit aussi : ses actualités arrivent dans le fil
  const isIndex = INDICES.some(i => i.symbol === index.symbol);
  const canFollow = isCompany || isIndex;
  const [me, setMe] = useState(null);
  const [follow, setFollow] = useState({ symbol: null, on: false, busy: false, error: "" });
  const [keyFacts, setKeyFacts] = useState(null); // { symbol, year, ytd }

  useEffect(() => {
    if (!canFollow) return;
    let ignore = false;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const id = session?.user?.id;
      if (!id || ignore) return;
      const on = await isFollowingAsset(id, index.symbol).catch(() => false);
      if (!ignore) { setMe(id); setFollow({ symbol: index.symbol, on, busy: false, error: "" }); }
    });
    if (isCompany) Promise.all([fetchChart(index.symbol, "1y"), fetchChart(index.symbol, "ytd")])
      .then(([year, ytd]) => { if (!ignore) setKeyFacts({ symbol: index.symbol, year, ytd }); });
    return () => { ignore = true; };
  }, [canFollow, isCompany, index.symbol]);

  async function toggleFollow() {
    if (!me || follow.busy) return;
    const next = !follow.on;
    setFollow(f => ({ ...f, on: next, busy: true, error: "" }));
    const ok = await setFollowingAsset(me, { symbol: index.symbol, name: index.name, type: isIndex ? "Indice" : index.type }, next);
    setFollow(f => ({ ...f, on: ok ? next : !next, busy: false, error: ok ? "" : t("Impossible pour le moment.") }));
  }

  const facts = keyFacts?.symbol === index.symbol ? keyFacts : null;
  const followReady = follow.symbol === index.symbol;

  const data = chart?.period === period ? chart.data : null;
  const loading = chart?.period !== period;
  // Taux : écart en points entre le début et la fin de la période
  const rateDelta = index.isRate && data?.points?.length > 1 ? data.points[data.points.length - 1][1] - data.points[0][1] : null;
  const up = (rateDelta ?? data?.change ?? 0) >= 0;
  const color = up ? T.up : T.red;
  const periodInfo = PERIODS.find(p => p.id === period);

  if (company) return <IndexDetail index={company} T={T} backLabel={`← ${index.name}`} initialPeriod={period} onBack={() => setCompany(null)} />;

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 14, fontFamily: "inherit" }}>{backLabel}</button>

      {/* En-tête et encart explicatif */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{index.country && <Flag country={index.country} size={18} />}{index.name}</div>
          <div style={{ fontSize: 13, color: T.textFaint }}>{index.symbol.startsWith("RATE:") ? t("BCE · moyenne mensuelle") : index.symbol}{index.type ? ` · ${t(index.type)}` : ""}</div>
          {canFollow && followReady && (
            <button onClick={toggleFollow} disabled={follow.busy} aria-pressed={follow.on}
              title={follow.on ? t("Ne plus suivre") : t("Suivre : ses actualités arriveront dans ton fil")}
              style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                ...(follow.on ? { background: T.accentBg, border: `0.5px solid ${T.accentBorder}`, color: T.accent } : { background: T.accent, border: `0.5px solid ${T.accent}`, color: T.onAccent }) }}>
              {follow.on ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{t("Suivi")} <Icon name="check" size={13} /></span> : t("+ Suivre")}
            </button>
          )}
        </div>
        {follow.error && <div role="alert" style={{ fontSize: 12, color: T.red, marginTop: 6 }}>{follow.error}</div>}
        {index.summary && <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, margin: "10px 0 14px" }}>{index.summary}</div>}
        {index.facts && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 12 }}>
          {index.facts.map(([label, value]) => (
            <div key={label} style={{ background: T.bgSubtle, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{value}</div>
            </div>
          ))}
        </div>}
        {index.dividends && <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6, background: T.accentBg, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 6 }}><Icon name="idea" size={14} style={{ marginTop: 2 }} /><span>{index.dividends}</span></div>}
      </div>

      {/* Graphique */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.text }}>{fmtValue(data?.price)}</div>
          {data && <div style={{ fontSize: 15, fontWeight: 700, color }}>{rateDelta != null ? fmtPoints(rateDelta) : fmtChange(data.change)}</div>}
          {data && periodInfo && <div style={{ fontSize: 12, color: T.textFaint }}>{periodPhrase(periodInfo)}</div>}
        </div>
        {!index.isRate && data?.annualized != null && (period === "5y" || period === "10y" || period === "max") && (
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>{t("soit ≈ {value} par an", { value: fmtChange(data.annualized) })}</div>
        )}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "8px 0 14px" }}>
          {periods.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{ padding: "5px 11px", borderRadius: 999, fontSize: 12, fontFamily: "inherit", cursor: "pointer", border: `0.5px solid ${period === p.id ? T.accent : T.border}`, background: period === p.id ? T.accentBg : "none", color: period === p.id ? T.accent : T.textMuted, fontWeight: period === p.id ? 700 : 400 }}>
              {p.label}
            </button>
          ))}
        </div>
        {loading && <div style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: T.textFaint }}>{t("Chargement…")}</div>}
        {!loading && !data && <div style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: T.textFaint }}>{t("Données indisponibles pour le moment.")}</div>}
        {!loading && data && data.points.length > 1 && <LineChart key={period} points={data.points} period={period} color={color} T={T} fmt={fmtValue} base={period === "1d" ? data.previousClose ?? null : null} />}
      </div>

      {/* Société : chiffres clés (sur un an) et actualités */}
      {isCompany && facts && (facts.year || facts.ytd) && (
        <div style={card}>
          <div style={sectionLabel}><Icon name="pin" size={13} />{t("Chiffres clés")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
            {[
              [t("Depuis le 1er janvier"), facts.ytd ? fmtChange(facts.ytd.change) : "—", facts.ytd?.change == null ? T.text : facts.ytd.change >= 0 ? T.up : T.red],
              [t("Sur 1 an"), facts.year ? fmtChange(facts.year.change) : "—", facts.year?.change == null ? T.text : facts.year.change >= 0 ? T.up : T.red],
              [t("Plus haut 1 an"), facts.year ? fmtValue(facts.year.high) : "—", T.text],
              [t("Plus bas 1 an"), facts.year ? fmtValue(facts.year.low) : "—", T.text],
              [t("Dividende 12 mois"), facts.year?.dividends ? `${fmtPrice(facts.year.dividends)}${facts.year.currency ? ` ${facts.year.currency}` : ""}` : t("Aucun"), T.text],
              [t("Rendement"), facts.year?.dividendYield ? `${facts.year.dividendYield.toFixed(1).replace(".", ",")} %` : "—", T.text],
            ].map(([label, value, color]) => (
              <div key={label} style={{ background: T.bgSubtle, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8 }}>{t("Cours de clôture, dividendes versés sur les 12 derniers mois.")}</div>
        </div>
      )}
      {isCompany && (
        <div>
          <div style={{ ...sectionLabel, margin: "4px 4px 8px" }}><Icon name="news" size={13} />{t("Actualités")}</div>
          <NewsList query={`"${newsName(index.name)}"`} T={T} />
        </div>
      )}

      {/* Top 5 (indices seulement) */}
      {top5.length > 0 && <div style={card}>
        <div style={sectionLabel}><Icon name="trophy" size={13} />{t("Les poids lourds de l'indice")}</div>
        {top5.map((c, i) => {
          const row = top?.period === period ? top.rows[i] : null;
          const ch = row?.data?.change;
          return (
            <button key={c.symbol} onClick={() => { setCompany({ symbol: c.symbol, name: c.name, type: "Action" }); window.scrollTo(0, 0); }} aria-label={t("Ouvrir la fiche de {name}", { name: c.name })}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", width: "100%", background: "none", border: "none", borderTop: i === 0 ? "none" : `0.5px solid ${T.border}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: T.bgSubtle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: T.textMuted, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: T.textFaint }}>{c.symbol}</div>
              </div>
              {row?.data && <Sparkline points={row.data.points} color={ch >= 0 ? T.up : T.red} width={72} height={26} />}
              <div style={{ textAlign: "right", minWidth: 76 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: ch == null ? T.textFaint : ch >= 0 ? T.up : T.red }}>{row ? fmtChange(ch) : "…"}</div>
                <div style={{ fontSize: 10, color: T.textFaint }}>{periodInfo.long}</div>
              </div>
            </button>
          );
        })}
        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 10 }}>{t("Liste indicative des plus gros poids de l'indice, mise à jour en {date}.", { date: TOP5_UPDATED })}</div>
      </div>}
    </div>
  );
}
