import { useState, useEffect } from "react";
import { T as TLive } from "../theme";
import Flag from "./Flag";
import { PERIODS, DEFAULT_PERIOD, TOP5_UPDATED, fetchChart, fmtChange } from "../indices";

const fmtPrice = p => (p === null || p === undefined ? "—" : p.toLocaleString("fr-FR", { maximumFractionDigits: p > 1000 ? 0 : 2 }));

function fmtDate(ts, period) {
  const d = new Date(ts);
  if (period === "1d") return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (period === "5d") return d.toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
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
function LineChart({ points, period, color, T }) {
  const [hover, setHover] = useState(null);
  const W = 600, H = 220, padY = 12;
  const ys = points.map(p => p[1]);
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
        {h ? <><strong style={{ color: T.text }}>{fmtPrice(h[1])}</strong> · {fmtDate(h[0], period)}</> : <span style={{ color: T.textFaint }}>Survole la courbe pour lire un point</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Évolution de l'indice sur la période"
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
        {h && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke={T.borderStrong} strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textFaint, marginTop: 4 }}>
        <span>{fmtDate(points[0][0], period)}</span>
        <span>{fmtDate(points[points.length - 1][0], period)}</span>
      </div>
    </div>
  );
}

export default function IndexDetail({ index, onBack, T: TProp }) {
  const T = TProp || TLive;
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [chart, setChart] = useState(null); // { period, data }
  const [top, setTop] = useState(null); // { period, rows }
  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, boxShadow: T.cardShadow, borderRadius: 14, padding: "1.25rem", marginBottom: 12 };
  const sectionLabel = { fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" };

  useEffect(() => {
    let ignore = false;
    fetchChart(index.symbol, period).then(data => { if (!ignore) setChart({ period, data }); });
    Promise.all(index.top5.map(async c => ({ ...c, data: await fetchChart(c.symbol, period) })))
      .then(rows => { if (!ignore) setTop({ period, rows }); });
    return () => { ignore = true; };
  }, [index, period]);

  const data = chart?.period === period ? chart.data : null;
  const loading = chart?.period !== period;
  const up = (data?.change ?? 0) >= 0;
  const color = up ? T.accent : T.red;
  const periodInfo = PERIODS.find(p => p.id === period);

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 14, fontFamily: "inherit" }}>← Marchés</button>

      {/* En-tête et encart explicatif */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}><Flag country={index.country} size={18} />{index.name}</div>
          <div style={{ fontSize: 13, color: T.textFaint }}>{index.symbol}</div>
        </div>
        <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, margin: "10px 0 14px" }}>{index.summary}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 12 }}>
          {index.facts.map(([label, value]) => (
            <div key={label} style={{ background: T.bgSubtle, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6, background: T.accentBg, borderRadius: 10, padding: "10px 12px" }}>💡 {index.dividends}</div>
      </div>

      {/* Graphique */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.text }}>{fmtPrice(data?.price)}</div>
          {data && <div style={{ fontSize: 15, fontWeight: 700, color }}>{fmtChange(data.change)}</div>}
          {data && <div style={{ fontSize: 12, color: T.textFaint }}>sur {periodInfo.long}</div>}
        </div>
        {data?.annualized != null && (period === "5y" || period === "10y") && (
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>soit ≈ {fmtChange(data.annualized)} par an</div>
        )}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "8px 0 14px" }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{ padding: "5px 11px", borderRadius: 999, fontSize: 12, fontFamily: "inherit", cursor: "pointer", border: `0.5px solid ${period === p.id ? T.accent : T.border}`, background: period === p.id ? T.accentBg : "none", color: period === p.id ? T.accent : T.textMuted, fontWeight: period === p.id ? 700 : 400 }}>
              {p.label}
            </button>
          ))}
        </div>
        {loading && <div style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: T.textFaint }}>Chargement…</div>}
        {!loading && !data && <div style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: T.textFaint }}>Données indisponibles pour le moment.</div>}
        {!loading && data && data.points.length > 1 && <LineChart key={period} points={data.points} period={period} color={color} T={T} />}
      </div>

      {/* Top 5 */}
      <div style={card}>
        <div style={sectionLabel}>🏆 Les poids lourds de l'indice</div>
        {index.top5.map((c, i) => {
          const row = top?.period === period ? top.rows[i] : null;
          const ch = row?.data?.change;
          return (
            <div key={c.symbol} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : `0.5px solid ${T.border}` }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: T.bgSubtle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: T.textMuted, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: T.textFaint }}>{c.symbol}</div>
              </div>
              {row?.data && <Sparkline points={row.data.points} color={ch >= 0 ? T.accent : T.red} width={72} height={26} />}
              <div style={{ textAlign: "right", minWidth: 76 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: ch == null ? T.textFaint : ch >= 0 ? T.accent : T.red }}>{row ? fmtChange(ch) : "…"}</div>
                <div style={{ fontSize: 10, color: T.textFaint }}>{periodInfo.long}</div>
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 10 }}>Liste indicative des plus gros poids de l'indice, mise à jour en {TOP5_UPDATED}.</div>
      </div>
    </div>
  );
}
