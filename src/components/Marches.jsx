import { useState, useEffect } from "react";
import { T as TLive } from "../theme";
import { INDICES, fetchChart, fmtChange, detailFor } from "../indices";
import IndexDetail, { Sparkline } from "./IndexDetail";
import EarningsCalendar from "./EarningsCalendar";
import { useDetailView } from "../useDetailView";
import Flag from "./Flag";
import { supabase } from "../supabase";
import { fetchFollowedAssets } from "../assetFollows";

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
  { symbol: "HG=F", name: "Cuivre", unit: "$/lb" },
];

const CRYPTO = [
  { symbol: "BTC-USD", name: "Bitcoin", unit: "$" },
  { symbol: "ETH-USD", name: "Ethereum", unit: "$" },
  { symbol: "SOL-USD", name: "Solana", unit: "$" },
  { symbol: "BNB-USD", name: "BNB", unit: "$" },
];

// Taux américains : cotés en continu (Yahoo), affichés en % avec une variation en points
const TAUX = [
  { symbol: "^TNX", name: "US 10 ans", country: "us", isRate: true, summary: "Taux auquel l'État américain emprunte sur 10 ans. C'est la référence mondiale des taux longs : quand il monte, les actions de croissance et l'immobilier souffrent souvent." },
  { symbol: "^TYX", name: "US 30 ans", country: "us", isRate: true, summary: "Taux auquel l'État américain emprunte sur 30 ans, sensible aux anticipations d'inflation et à la dette publique à long terme." },
];

// Taux européens : historique mensuel officiel de la BCE (pas de cotation en continu disponible)
const TAUX_EUROPE = {
  fr: { symbol: "RATE:fr", name: "OAT 10 ans", country: "fr", isRate: true, periods: ["1y", "5y", "10y", "max"], summary: "Taux auquel l'État français emprunte sur 10 ans. Courbe : moyenne mensuelle officielle publiée par la BCE." },
  de: { symbol: "RATE:de", name: "Bund 10 ans", country: "de", isRate: true, periods: ["1y", "5y", "10y", "max"], summary: "Taux auquel l'État allemand emprunte sur 10 ans, la référence de la zone euro. Courbe : moyenne mensuelle officielle publiée par la BCE." },
};

// Fiches connues de l'écran Marchés, retrouvées par leur symbole après une actualisation
const KNOWN = [...TAUX, ...Object.values(TAUX_EUROPE), ...FOREX, ...MATIERES, ...CRYPTO];
const MARCHES_URL = {
  urlKey: "marches",
  toUrl: v => ({ symbol: v.symbol, name: v.name, type: v.type }),
  fromUrl: d => KNOWN.find(k => k.symbol === d.symbol) || detailFor(d),
};

// Earnings chargés dynamiquement via /api/earnings

// Secteurs chargés dynamiquement via /api/sectors

async function fetchQuote(symbol) {
  try {
    const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Case d'une cotation (devise, matière première, crypto, taux US) ; ouvre sa fiche au clic
function QuoteCard({ item, T, onOpen }) {
  const { symbol, name, country, unit, isRate } = item;
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

  // Taux : variation en points (la variation en % d'un taux n'a pas de sens)
  const points = isRate && data?.price && data?.change != null ? data.price - data.price / (1 + data.change / 100) : null;
  return (
    <button onClick={() => onOpen(item)} aria-label={`Voir la fiche ${name}`}
      style={{ background: T.bgSubtle, border: "none", borderRadius: 12, padding: "12px 14px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", width: "100%", minWidth: 0 }}>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>
        {country && <Flag country={country} size={12} />}{name}
      </div>
      {loading ? (
        <div style={{ fontSize: 14, color: T.textFaint }}>…</div>
      ) : (
        <>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>
            {isRate ? (data?.price ? `${data.price.toFixed(2).replace(".", ",")} %` : "—") : `${formatPrice(data?.price)}${unit && data?.price ? ` ${unit}` : ""}`}
          </div>
          {data?.change !== null && data?.change !== undefined && (
            <div style={{ fontSize: 12, fontWeight: 500, color: data.change >= 0 ? T.accent : T.red, marginTop: 2 }}>
              {points != null
                ? `${points >= 0 ? "+" : "−"}${Math.abs(points).toFixed(2).replace(".", ",")} pt sur un jour`
                : fmtChange(data.change)}
            </div>
          )}
        </>
      )}
    </button>
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
function RateTile({ country, name, rates, T, onOpen }) {
  const r = rates?.[country];
  return (
    <button onClick={() => onOpen(TAUX_EUROPE[country])} aria-label={`Voir la fiche ${name}`}
      style={{ background: T.bgSubtle, border: "none", borderRadius: 12, padding: "12px 14px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", width: "100%", minWidth: 0 }}>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}><Flag country={country} size={12} />{name}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{r ? `${r.value.toFixed(2).replace(".", ",")} %` : rates ? "—" : "…"}</div>
      {r?.change != null && <div style={{ fontSize: 12, color: r.change >= 0 ? T.accent : T.red, marginTop: 2 }}>{r.change >= 0 ? "+" : "−"}{Math.abs(r.change).toFixed(2).replace(".", ",")} pt sur un {r.frequency === "daily" ? "jour" : "mois"}</div>}
      {r && <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>{fmtRateDate(r)}</div>}
    </button>
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
  // Fiche ouverte (indice, taux, devise…) ; au retour, on revient au même endroit de la page,
  // et une actualisation la rouvre (symbole gardé dans l'adresse)
  const [openIndex, openDetail, closeDetail] = useDetailView(MARCHES_URL);
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

  // Sociétés que je suis (rechargées en revenant d'une fiche, où on a pu en suivre une)
  const [followed, setFollowed] = useState([]);
  useEffect(() => {
    if (openIndex) return;
    let ignore = false;
    supabase.auth.getSession().then(({ data: { session } }) => session && fetchFollowedAssets(session.user.id))
      .then(list => { if (!ignore && list) setFollowed(list); }).catch(() => {});
    return () => { ignore = true; };
  }, [openIndex]);

  if (openIndex) return <IndexDetail index={openIndex} T={T} onBack={closeDetail} />;

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

      {followed.length > 0 && (
        <div style={card}>
          <div style={sectionLabel}>⭐ Sociétés suivies</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {followed.map(a => (
              <button key={a.symbol} onClick={() => openDetail(detailFor(a))} aria-label={`Voir la fiche ${a.name}`}
                style={{ padding: "6px 12px", borderRadius: 999, border: `0.5px solid ${T.border}`, background: T.bgSubtle, fontSize: 12, fontWeight: 600, color: T.text, cursor: "pointer", fontFamily: "inherit" }}>
                🏢 {a.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Indices */}
      <div style={card}>
        <div style={sectionLabel}>📊 Indices <span style={{ textTransform: "none", letterSpacing: 0 }}>· touche un indice pour le découvrir</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
          {INDICES.map(idx => <IndexTile key={idx.symbol} index={idx} T={T} onOpen={openDetail} />)}
        </div>
      </div>

      {/* Secteurs */}
      <div style={card}>
        <div style={sectionLabel}>🏭 Secteurs S&P 500</div>
        {loadingSecteurs && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem" }}>Chargement…</div>}
        {!loadingSecteurs && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {secteurs.map(s => (
              <button key={s.name} aria-label={`Voir la fiche du secteur ${s.name}`}
                onClick={() => openDetail({ symbol: s.symbol, name: s.name, type: `Secteur S&P 500 · ETF ${s.symbol}`, summary: `Suivi à travers l'ETF ${s.symbol}, qui réplique les entreprises du secteur « ${s.name} » de l'indice S&P 500.` })}
                style={{ background: T.bgSubtle, border: "none", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%", minWidth: 0 }}>
                <span style={{ fontSize: 12, color: T.textMuted }}>{s.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: s.change === null ? T.textFaint : s.change >= 0 ? T.accent : T.red }}>
                  {s.change === null ? "—" : fmtChange(s.change)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Taux */}
      <div style={card}>
        <div style={sectionLabel}>🏦 Taux obligataires</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {TAUX.map(t => <QuoteCard key={t.symbol} item={t} T={T} onOpen={openDetail} />)}
          <RateTile country="fr" name="OAT 10 ans" rates={rates} T={T} onOpen={openDetail} />
          <RateTile country="de" name="Bund 10 ans" rates={rates} T={T} onOpen={openDetail} />
        </div>
      </div>

      {/* Forex */}
      <div style={card}>
        <div style={sectionLabel}>💱 Devises</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {FOREX.map(f => <QuoteCard key={f.symbol} item={f} T={T} onOpen={openDetail} />)}
        </div>
      </div>

      {/* Matières premières */}
      <div style={card}>
        <div style={sectionLabel}>🥇 Matières premières</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {MATIERES.map(m => <QuoteCard key={m.symbol} item={m} T={T} onOpen={openDetail} />)}
        </div>
      </div>

      {/* Crypto */}
      <div style={card}>
        <div style={sectionLabel}>🪙 Crypto</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {CRYPTO.map(c => <QuoteCard key={c.symbol} item={c} T={T} onOpen={openDetail} />)}
        </div>
      </div>

      {/* Résultats d'entreprises : calendrier du mois et liste, chaque entreprise ouvre sa fiche */}
      <div style={card}>
        <div style={sectionLabel}>📅 Calendrier des résultats</div>
        <EarningsCalendar earnings={earnings} loading={loadingEarnings} T={T}
          onOpen={e => openDetail(detailFor({ symbol: e.symbol, name: e.name, type: "Action" }))} />
      </div>
    </div>
  );
}
