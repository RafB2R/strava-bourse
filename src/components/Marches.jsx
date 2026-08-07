import { useState, useEffect } from "react";

const card = { background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "1.25rem", marginBottom: 12 };
const sectionLabel = { fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 500, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" };

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

const EARNINGS = [
  { date: "12 Aug", company: "Apple", ticker: "AAPL", consensus: "BPA estimé : $1.35" },
  { date: "13 Aug", company: "NVIDIA", ticker: "NVDA", consensus: "BPA estimé : $0.64" },
  { date: "14 Aug", company: "Walmart", ticker: "WMT", consensus: "BPA estimé : $0.65" },
  { date: "19 Aug", company: "LVMH", ticker: "MC.PA", consensus: "RN estimé : 7.2Md€" },
  { date: "20 Aug", company: "TotalEnergies", ticker: "TTE.PA", consensus: "BNA estimé : 2.1Md€" },
  { date: "21 Aug", company: "Airbus", ticker: "AIR.PA", consensus: "EBIT estimé : 1.8Md€" },
];

const SECTEURS = [
  { name: "Technologie", change: "+1.24%", up: true },
  { name: "Santé", change: "+0.42%", up: true },
  { name: "Finance", change: "-0.18%", up: false },
  { name: "Énergie", change: "+0.87%", up: true },
  { name: "Consommation", change: "-0.31%", up: false },
  { name: "Industrie", change: "+0.15%", up: true },
  { name: "Immobilier", change: "-0.52%", up: false },
  { name: "Matériaux", change: "+0.33%", up: true },
];

async function fetchQuote(symbol) {
  try {
    const proxy = "https://corsproxy.io/?";
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const res = await fetch(proxy + encodeURIComponent(url));
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.previousClose || meta.chartPreviousClose;
    const change = prev ? ((price - prev) / prev) * 100 : null;
    return { price, change, currency: meta.currency };
  } catch { return null; }
}

function QuoteCard({ symbol, name, flag, unit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuote(symbol).then(d => { setData(d); setLoading(false); });
  }, [symbol]);

  const formatPrice = (p, currency) => {
    if (!p) return "—";
    if (p > 1000) return p.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
    if (p > 10) return p.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
    return p.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
  };

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
        {flag && <span style={{ marginRight: 4 }}>{flag}</span>}{name}
      </div>
      {loading ? (
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.2)" }}>…</div>
      ) : (
        <>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>
            {formatPrice(data?.price)}{unit ? ` ${unit}` : ""}
          </div>
          {data?.change !== null && data?.change !== undefined && (
            <div style={{ fontSize: 12, fontWeight: 500, color: data.change >= 0 ? "#9FE1CB" : "#F08080", marginTop: 2 }}>
              {data.change >= 0 ? "+" : ""}{data.change.toFixed(2)}%
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Marches() {
  const [lastUpdate, setLastUpdate] = useState(new Date());

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
          Mis à jour à {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <button onClick={() => setLastUpdate(new Date())} style={{ background: "none", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" }}>
          ⟳ Actualiser
        </button>
      </div>

      {/* Indices */}
      <div style={card}>
        <div style={sectionLabel}>📊 Indices</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {INDICES.map(idx => <QuoteCard key={idx.symbol} {...idx} />)}
        </div>
      </div>

      {/* Secteurs */}
      <div style={card}>
        <div style={sectionLabel}>🏭 Secteurs S&P 500</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {SECTEURS.map(s => (
            <div key={s.name} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{s.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: s.up ? "#9FE1CB" : "#F08080" }}>{s.change}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 10, textAlign: "center" }}>Données indicatives — temps réel bientôt</div>
      </div>

      {/* Taux */}
      <div style={card}>
        <div style={sectionLabel}>🏦 Taux obligataires</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {TAUX.map(t => <QuoteCard key={t.symbol} {...t} unit="%" />)}
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>🇫🇷 OAT 10 ans</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>3.12%</div>
            <div style={{ fontSize: 12, color: "#9FE1CB", marginTop: 2 }}>+0.02%</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>🇩🇪 Bund 10 ans</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>2.41%</div>
            <div style={{ fontSize: 12, color: "#F08080", marginTop: 2 }}>-0.01%</div>
          </div>
        </div>
      </div>

      {/* Forex */}
      <div style={card}>
        <div style={sectionLabel}>💱 Devises</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {FOREX.map(f => <QuoteCard key={f.symbol} {...f} />)}
        </div>
      </div>

      {/* Matières premières */}
      <div style={card}>
        <div style={sectionLabel}>🥇 Matières premières</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {MATIERES.map(m => <QuoteCard key={m.symbol} {...m} />)}
        </div>
      </div>

      {/* Résultats d'entreprises */}
      <div style={card}>
        <div style={sectionLabel}>📅 Résultats à venir</div>
        {EARNINGS.map((e, i) => (
          <div key={e.ticker} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : "0.5px solid rgba(255,255,255,0.06)" }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#9FE1CB", fontWeight: 600 }}>{e.date.split(" ")[0]}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{e.date.split(" ")[1]}</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{e.company}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{e.consensus}</div>
            </div>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{e.ticker}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
