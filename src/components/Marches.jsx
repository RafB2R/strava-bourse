import { useState, useEffect } from "react";
import { T as TLive } from "../theme";

// card défini dynamiquement avec T
// sectionLabel défini dynamiquement avec T

const INDICES = [
  { symbol: "^GSPC", name: "S&P 500", flag: "🇺🇸" },
  { symbol: "^FCHI", name: "CAC 40", flag: "🇫🇷" },
  { symbol: "^IXIC", name: "NASDAQ", flag: "🇺🇸" },
  { symbol: "^STOXX50E", name: "Euro Stoxx 50", flag: "🇪🇺" },
  { symbol: "^GDAXI", name: "DAX", flag: "🇩🇪" },
  { symbol: "^N225", name: "Nikkei 225", flag: "🇯🇵" },
];

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
  { symbol: "^TNX", name: "US 10 ans", flag: "🇺🇸" },
  { symbol: "^TYX", name: "US 30 ans", flag: "🇺🇸" },
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

function QuoteCard({ symbol, name, flag, unit, T }) {
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
        {flag && <span style={{ marginRight: 4 }}>{flag}</span>}{name}
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

export default function Marches({ T: TProp }) {
  const T = TProp || TLive;
  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, boxShadow: T.cardShadow, padding: "1.25rem", marginBottom: 12 };
  const sectionLabel = { fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" };
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [secteurs, setSecteurs] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [loadingSecteurs, setLoadingSecteurs] = useState(true);
  const [loadingEarnings, setLoadingEarnings] = useState(true);

  const [reloadKey, setReloadKey] = useState(0);

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
        <div style={sectionLabel}>📊 Indices</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {INDICES.map(idx => <QuoteCard key={idx.symbol} {...idx} T={T} />)}
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
          <div style={{ background: T.bgSubtle, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>🇫🇷 OAT 10 ans</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>3.12%</div>
            <div style={{ fontSize: 12, color: T.accent, marginTop: 2 }}>+0.02%</div>
          </div>
          <div style={{ background: T.bgSubtle, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>🇩🇪 Bund 10 ans</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>2.41%</div>
            <div style={{ fontSize: 12, color: T.red, marginTop: 2 }}>-0.01%</div>
          </div>
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
