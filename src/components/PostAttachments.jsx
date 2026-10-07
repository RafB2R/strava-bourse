import { useState, useEffect } from "react";
import { CHART_PERIODS, searchAssets, fetchQuote, myAllocation, cleanAsset, cleanAllocation } from "../attachments";
import { fetchChart, fmtChange } from "../indices";

// Pièces jointes « marché » d'un post : valeur citée (avec ou sans graphique), répartition en %

const box = T => ({ border: `0.5px solid ${T.border}`, borderRadius: 12, background: T.bgSubtle, padding: "12px 14px", marginBottom: 12 });
const chip = (T, active) => ({ padding: "4px 10px", borderRadius: 999, fontSize: 12, border: `0.5px solid ${active ? T.accent : T.border}`, background: active ? T.accentBg : "none", color: active ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" });
const fmtPrice = (v, currency) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: v < 10 ? 3 : 2 })}${currency ? ` ${currency === "EUR" ? "€" : currency === "USD" ? "$" : currency}` : ""}`;

function AreaChart({ points, color }) {
  if (!points || points.length < 2) return null;
  const W = 300, H = 90;
  const ys = points.map(p => p[1]);
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const x = i => (i / (points.length - 1)) * W;
  const y = v => H - 4 - ((v - min) / span) * (H - 8);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" style={{ width: "100%", height: 90, display: "block", marginTop: 10 }}>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={color} opacity="0.12" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

// Valeur citée : cours du moment et, si demandé, courbe sur la période choisie
// « onOpen » : clic sur la carte → fiche de la valeur (courbe, périodes)
export function AssetCard({ asset: raw, T, onOpen }) {
  const asset = cleanAsset(raw);
  const [quote, setQuote] = useState(null);
  const [chart, setChart] = useState(null);
  const symbol = asset?.symbol, period = asset?.chart;

  useEffect(() => {
    if (!symbol) return;
    let ignore = false;
    fetchQuote(symbol).then(q => { if (!ignore) setQuote(q); });
    if (period) fetchChart(symbol, period).then(c => { if (!ignore) setChart(c); });
    return () => { ignore = true; };
  }, [symbol, period]);

  if (!asset) return null;
  const up = (quote?.change ?? 0) >= 0;
  const periodUp = (chart?.change ?? 0) >= 0;
  const periodLabel = CHART_PERIODS.find(p => p.id === period)?.label;
  const clickable = onOpen ? { role: "button", tabIndex: 0, onClick: () => onOpen(asset), onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(asset); } }, "aria-label": `Voir la fiche de ${asset.name}` } : {};
  return (
    <div {...clickable} style={{ ...box(T), ...(onOpen ? { cursor: "pointer" } : {}) }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>$</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</div>
          <div style={{ fontSize: 12, color: T.textFaint }}>{asset.symbol}{asset.type ? ` · ${asset.type}` : ""}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {quote ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{fmtPrice(quote.price, asset.type === "Indice" ? null : quote.currency)}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: up ? T.accent : T.red }}>{fmtChange(quote.change)} auj.</div>
            </>
          ) : <div style={{ fontSize: 12, color: T.textFaint }}>Cours…</div>}
        </div>
      </div>
      {period && (
        chart?.points?.length > 1 ? (
          <>
            <AreaChart points={chart.points} color={periodUp ? T.accent : T.red} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textFaint, marginTop: 4 }}>
              <span>Sur {periodLabel === "1A" ? "1 an" : periodLabel === "5A" ? "5 ans" : periodLabel === "6M" ? "6 mois" : "1 mois"}</span>
              <span style={{ fontWeight: 700, color: periodUp ? T.accent : T.red }}>{fmtChange(chart.change)}</span>
            </div>
          </>
        ) : <div style={{ height: 90, marginTop: 10, borderRadius: 8, background: T.bgCard, opacity: 0.6 }} />
      )}
      {onOpen && <div style={{ fontSize: 12, fontWeight: 600, color: T.accent, marginTop: 8, textAlign: "right" }}>Voir la fiche ›</div>}
    </div>
  );
}

const ALLOC_COLORS = T => [T.accent, T.blue, T.purple, T.orange, T.yellow, T.gold, T.red, T.textFaint];

// Répartition partagée : barre empilée et légende, en % uniquement
export function AllocationCard({ allocation: raw, T, title }) {
  const allocation = cleanAllocation(raw);
  if (!allocation) return null;
  const colors = ALLOC_COLORS(T);
  return (
    <div style={box(T)}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8 }}>
        {title || (allocation.mode === "positions" ? "🥧 Ma répartition par position" : "🥧 Ma répartition par classe d'actifs")}
      </div>
      <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", marginBottom: 10 }}>
        {allocation.rows.map((r, i) => <div key={r.label} title={`${r.label} : ${r.pct} %`} style={{ width: `${r.pct}%`, background: colors[i % colors.length] }} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "4px 12px" }}>
        {allocation.rows.map((r, i) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
            <span style={{ flex: 1, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <span style={{ color: T.textMuted, fontWeight: 600 }}>{String(r.pct).replace(".", ",")} %</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const panel = T => ({ marginTop: 8, padding: 10, borderRadius: 10, border: `0.5px solid ${T.border}`, background: T.bgSubtle });
const closeBtn = T => ({ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 12 });

// Graphique à joindre : recherche de la valeur (nom, ticker ou ISIN) et période
export function AssetPicker({ T, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [chart, setChart] = useState("1y");

  useEffect(() => {
    if (query.trim().length < 2) return;
    let ignore = false;
    const t = setTimeout(() => searchAssets(query.trim()).then(r => { if (!ignore) setResults(r); }), 300);
    return () => { ignore = true; clearTimeout(t); };
  }, [query]);

  const shown = query.trim().length >= 2 ? results : null;
  return (
    <div style={panel(T)}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: T.textMuted }}>📈 Joindre un graphique</span>
        <button onClick={onClose} aria-label="Fermer" style={closeBtn(T)}>✕</button>
      </div>
      <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="TotalEnergies, CW8, FR0000120271…" aria-label="Rechercher une valeur"
        style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 8, border: `0.5px solid ${T.border}`, background: T.bgCard, color: T.text, fontFamily: "inherit" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <span style={{ fontSize: 12, color: T.textMuted }}>Période :</span>
        {CHART_PERIODS.map(p => <button key={p.id} onClick={() => setChart(p.id)} style={chip(T, chart === p.id)}>{p.label}</button>)}
      </div>
      {shown === null && query.trim().length >= 2 && <div style={{ fontSize: 12, color: T.textFaint, marginTop: 8 }}>Recherche…</div>}
      {shown?.length === 0 && <div style={{ fontSize: 12, color: T.textFaint, marginTop: 8 }}>Aucune valeur trouvée.</div>}
      {shown?.map(r => (
        <button key={r.symbol} onClick={() => onPick({ symbol: r.symbol, name: r.name, type: r.type, chart })}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", borderTop: `0.5px solid ${T.border}`, padding: "8px 2px", cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            <span style={{ display: "block", fontSize: 11, color: T.textFaint }}>{r.symbol} · {r.type}{r.exchange ? ` · ${r.exchange}` : ""}</span>
          </span>
          <span style={{ fontSize: 12, color: T.accent, fontWeight: 700 }}>Ajouter</span>
        </button>
      ))}
    </div>
  );
}

// Choix de la répartition à partager (calculée depuis mon portefeuille, en %)
export function AllocationPicker({ T, onPick, onClose }) {
  const [mode, setMode] = useState("classes");
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let ignore = false;
    myAllocation(mode).then(r => { if (!ignore) setRows(r); });
    return () => { ignore = true; };
  }, [mode]);

  return (
    <div style={panel(T)}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: T.textMuted }}>🥧 Partager ma répartition <span style={{ fontWeight: 400 }}>· en % uniquement, jamais de montant</span></span>
        <button onClick={onClose} aria-label="Fermer" style={closeBtn(T)}>✕</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button onClick={() => { setRows(null); setMode("classes"); }} style={chip(T, mode === "classes")}>Par classe d'actifs</button>
        <button onClick={() => { setRows(null); setMode("positions"); }} style={chip(T, mode === "positions")}>Par position</button>
      </div>
      {rows === null && <div style={{ fontSize: 12, color: T.textFaint }}>Calcul…</div>}
      {rows?.length === 0 && <div style={{ fontSize: 12, color: T.textFaint }}>Ajoute des positions dans ton portefeuille pour partager ta répartition.</div>}
      {rows?.length > 0 && (
        <>
          <AllocationCard allocation={{ mode, rows }} T={T} title="Aperçu" />
          <button onClick={() => onPick({ mode, rows })} style={{ background: T.accent, border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: T.onAccent, cursor: "pointer", fontFamily: "inherit" }}>Joindre au post</button>
        </>
      )}
    </div>
  );
}

// Rappel de la pièce jointe choisie, dans l'encadré de publication
export function AttachedChip({ T, icon, label, onRemove }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "6px 10px", borderRadius: 8, border: `0.5px solid ${T.accent}`, background: T.accentBg, minWidth: 0 }}>
      <span>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <button onClick={onRemove} aria-label="Retirer" style={closeBtn(T)}>✕</button>
    </div>
  );
}
