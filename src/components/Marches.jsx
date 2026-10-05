import { useState, useEffect } from "react";
import { T as TLive } from "../theme";
import { INDICES, fetchChart, fmtChange } from "../indices";
import IndexDetail, { Sparkline } from "./IndexDetail";
import Flag from "./Flag";

// card défini dynamiquement avec T
// sectionLabel défini dynamiquement avec T

const FOREX = [
  { symbol: "EURUSD=X", name: "EUR/USD" },
  { symbol: "EURGBP=X", name: "EUR/GBP" },
  { symbol: "USDJPY=X", name: "USD/JPY" },
  { symbol: "EURCHF=X", name: "EUR/CHF" },
];

const MATIERES = [
  { symbol: "GC=F", name: "Or", unit: "$/oz" },
  { symbol: "SI=F", name: "Argent", unit: "$/oz" },
  { symbol: "CL=F", name: "Pétrole WTI", unit: "$/baril" },
  { symbol: "BTC-USD", name: "Bitcoin", unit: "$" },
];

const TAUX = [
  { symbol: "^TNX", name: "US 10 ans", country: "us" },
  { symbol: "^TYX", name: "US 30 ans", country: "us" },
];

// Earnings chargés dynamiquement via /api/earnings

// Secteurs chargés dynamiquement via /api/sectors

async function fetchQuote(symbol) {
  try {
    const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function QuoteCard({ symbol, name, country, unit, T }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuote(symbol).then(d => { setData(d); setLoading(false); });
  }, [symbol]);

  const formatPrice = (p) => {
    if (!p) return "—";
    if (p > 1000) return p.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
    if (p > 10) return p.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
    return p.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
  };

  return (
    <div style={{ background: T.bgSubtle, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>
        {country && <Flag country={country} size={12} />}{name}
      </div>
      {loading ? (
        <div style={{ fontSize: 14, color: T.textFaint }}>…</div>
      ) : (
        <>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>
            {formatPrice(data?.price)}{unit ? ` ${unit}` : ""}
          </div>
          {data?.change !== null && data?.change !== undefined && (
            <div style={{ fontSize: 12, fontWeight: 500, color: data.change >= 0 ? T.accent : T.red, marginTop: 2 }}>
              {data.change >= 0 ? "+" : ""}{data.change.toFixed(2)}%
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Liste JSON renvoyée par nos routes /api, ou [] en cas d'erreur
async function fetchJsonList(url) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const fmtRateDate = (r) => r.frequency === "daily"
  ? `Au ${new Date(`${r.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} · ${r.source}`
  : `Moyenne de ${new Date(`${r.date.slice(0, 7)}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} · ${r.source}`;

// Taux d'État à 10 ans (quotidien si disponible, sinon moyenne mensuelle BCE), variation en points
function RateTile({ country, name, rates, T }) {
  const r = rates?.[country];
  return (
    <div style={{ background: T.bgSubtle, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}><Flag country={country} size={12} />{name}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{r ? `${r.value.toFixed(2).replace(".", ",")} %` : rates ? "—" : "…"}</div>
      {r?.change != null && <div style={{ fontSize: 12, color: r.change >= 0 ? T.accent : T.red, marginTop: 2 }}>{r.change >= 0 ? "+" : "−"}{Math.abs(r.change).toFixed(2).replace(".", ",")} pt sur un {r.frequency === "daily" ? "jour" : "mois"}</div>}
      {r && <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>{fmtRateDate(r)}</div>}
    </div>
  );
}

// Tuile d'indice : cours, variation du jour et courbe sur 1 an ; ouvre le détail
function IndexTile({ index, onOpen, T }) {
  const [quote, setQuote] = useState(null);
  const [year, setYear] = useState(null);
  useEffect(() => {
    let ignore = false;
    fetchQuote(index.symbol).then(d => { if (!ignore) setQuote(d || {}); });
    fetchChart(index.symbol, "1y").then(d => { if (!ignore) setYear(d); });
    return () => { ignore = true; };
  }, [index.symbol]);
  const day = quote?.change;
  const yearUp = (year?.change ?? 0) >= 0;
  return (
    <button onClick={() => onOpen(index)} style={{ background: T.bgSubtle, border: "none", borderRadius: 12, padding: "12px 14px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, width: "100%", minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Flag country={index.country} size={12} />{index.name}</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{quote?.price ? quote.price.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : quote ? "—" : "…"}</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: day == null ? T.textFaint : day >= 0 ? T.accent : T.red, marginTop: 2 }}>{day == null ? "—" : fmtChange(day)} <span style={{ color: T.textFaint, fontWeight: 400 }}>auj.</span></div>
      </div>
      <div style={{ textAlign: "right" }}>
        <Sparkline points={year?.points} color={yearUp ? T.accent : T.red} width={72} height={30} />
        <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>{year ? `${fmtChange(year.change)} · 1 an` : "1 an"}</div>
      </div>
    </button>
  );
}

export default function Marches({ T: TProp }) {
  const T = TProp || TLive;
  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, boxShadow: T.cardShadow, padding: "1.25rem", marginBottom: 12 };
  const sectionLabel = { fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" };
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [openIndex, setOpenIndex] = useState(null);
  const [rates, setRates] = useState(null);
  const [secteurs, setSecteurs] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [loadingSecteurs, setLoadingSecteurs] = useState(true);
  const [loadingEarnings, setLoadingEarnings] = useState(true);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    fetch("/api/rates").then(r => (r.ok ? r.json() : {})).catch(() => ({})).then(d => { if (!ignore) setRates(d); });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    fetchJsonList("/api/sectors").then(list => { if (!ignore) { setSecteurs(list); setLoadingSecteurs(false); } });
    fetchJsonList("/api/earnings").then(list => { if (!ignore) { setEarnings(list); setLoadingEarnings(false); } });
    return () => { ignore = true; };
  }, [reloadKey]);

  function refresh() {
    setLastUpdate(new Date());
    setLoadingSecteurs(true);
    setLoadingEarnings(true);
    setReloadKey(k => k + 1);
  }

  if (openIndex) return <IndexDetail index={openIndex} T={T} onBack={() => setOpenIndex(null)} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: T.textFaint }}>
          Mis à jour à {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <button onClick={refresh} style={{ background: "none", border: `0.5px solid ${T.borderStrong}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
          ⟳ Actualiser
        </button>
      </div>

      {/* Indices */}
      <div style={card}>
        <div style={sectionLabel}>📊 Indices <span style={{ textTransform: "none", letterSpacing: 0 }}>· touche un indice pour le découvrir</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
          {INDICES.map(idx => <IndexTile key={idx.symbol} index={idx} T={T} onOpen={i => { setOpenIndex(i); window.scrollTo(0, 0); }} />)}
        </div>
      </div>

      {/* Secteurs */}
      <div style={card}>
        <div style={sectionLabel}>🏭 Secteurs S&P 500</div>
        {loadingSecteurs && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem" }}>Chargement…</div>}
        {!loadingSecteurs && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {secteurs.map(s => (
              <div key={s.name} style={{ background: T.bgSubtle, borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: T.textMuted }}>{s.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: s.change === null ? T.textFaint : s.change >= 0 ? T.accent : T.red }}>
                  {s.change === null ? "—" : `${s.change >= 0 ? "+" : ""}${s.change.toFixed(2)}%`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Taux */}
      <div style={card}>
        <div style={sectionLabel}>🏦 Taux obligataires</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {TAUX.map(t => <QuoteCard key={t.symbol} {...t} unit="%" T={T} />)}
          <RateTile country="fr" name="OAT 10 ans" rates={rates} T={T} />
          <RateTile country="de" name="Bund 10 ans" rates={rates} T={T} />
        </div>
      </div>

      {/* Forex */}
      <div style={card}>
        <div style={sectionLabel}>💱 Devises</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {FOREX.map(f => <QuoteCard key={f.symbol} {...f} T={T} />)}
        </div>
      </div>

      {/* Matières premières */}
      <div style={card}>
        <div style={sectionLabel}>🥇 Matières premières</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {MATIERES.map(m => <QuoteCard key={m.symbol} {...m} T={T} />)}
        </div>
      </div>

      {/* Résultats d'entreprises */}
      <div style={card}>
        <div style={sectionLabel}>📅 Résultats à venir</div>
        {loadingEarnings && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem" }}>Chargement…</div>}
        {!loadingEarnings && earnings.length === 0 && (
          <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem" }}>Aucun résultat à venir</div>
        )}
        {!loadingEarnings && earnings.map((e, i) => {
          const d = new Date(e.date);
          const day = d.getDate();
          const month = d.toLocaleString("fr-FR", { month: "short" });
          return (
            <div key={e.company + i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : `0.5px solid ${T.border}` }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: T.bgSubtle, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: T.accent, fontWeight: 700 }}>{day}</div>
                  <div style={{ fontSize: 9, color: T.textMuted }}>{month}</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{e.name || e.company}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{e.symbol}{e.eps !== null && !isNaN(e.eps) ? ` · BPA estimé : $${Number(e.eps).toFixed(2)}` : ""}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
