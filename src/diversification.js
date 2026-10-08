import { resolveAsset } from "./attachments";

// Diversification détaillée d'un portefeuille, en % (jamais de montants) :
//  - zones géographiques : une action ou une obligation en direct compte pour le pays de
//    la société (2 premières lettres de l'ISIN, sinon la place de cotation) ; un ETF ou un
//    fonds est réparti d'après l'indice qu'il suit, reconnu à son nom (MSCI World ≈ 72 %
//    États-Unis, S&P 500 = 100 % États-Unis…) ;
//  - taille des entreprises (sur la part en actions) : d'après le nom pour un ETF
//    (« Small Cap »…), d'après la capitalisation boursière pour une action ;
//  - types : actions en ETF / en direct / via des fonds, obligations en fonds / en direct,
//    crypto, immobilier…
// Ce sont des estimations : les répartitions d'indices sont arrondies et datées.

export const ZONES = ["France", "Europe (hors France)", "États-Unis", "Japon", "Pays émergents", "Autres pays développés", "Hors zone", "Non identifiée"];
export const CAPS = ["Grandes", "Moyennes", "Petites", "Non classées"];

// Répartition géographique approximative des grands indices (en %)
const WORLD = { "États-Unis": 72, "Europe (hors France)": 12.5, France: 2.5, Japon: 6, "Autres pays développés": 7 };
const ACWI = { "États-Unis": 64, "Europe (hors France)": 10.8, France: 2.2, Japon: 5, "Pays émergents": 10, "Autres pays développés": 8 };
const EUROPE = { France: 17, "Europe (hors France)": 83 };
const EUROZONE = { France: 33, "Europe (hors France)": 67 };

// Du plus précis au plus large : « MSCI World Small Cap » est d'abord un indice monde
const ZONE_RULES = [
  [/all[- ]?world|acwi|global all|monde.*[ée]merg|world.*emerg/i, ACWI],
  [/emerging|[ée]mergent|\bem\b|china|chine|india|\binde\b|brazil|br[ée]sil|taiwan|korea|cor[ée]e|latam|latin/i, { "Pays émergents": 100 }],
  [/japan|japon|nikkei|topix/i, { Japon: 100 }],
  [/\bcac\b|france|\bsbf\b/i, { France: 100 }],
  [/euro ?stoxx|\bemu\b|eurozone|zone euro|euro area|msci euro\b/i, EUROZONE],
  [/\bdax\b|germany|allemagne|ftse 100|\buk\b|united kingdom|royaume|ibex|\baex\b|\bsmi\b|swiss|suisse|italy|italie|spain|espagne/i, { "Europe (hors France)": 100 }],
  [/stoxx|europe|european/i, EUROPE],
  [/s&p|\bsp ?500\b|nasdaq|dow jones|russell|\busa?\b|u\.s\.|america|[ée]tats[- ]unis/i, { "États-Unis": 100 }],
  [/\beuro\b|\beurozone\b/i, EUROZONE], // fonds en euros (obligations d'État…), après « S&P 500 EUR hedged »
  [/world|monde|global|msci w/i, WORLD],
  [/pacific|pacifique|asia|asie|canada|australia|australie/i, { "Autres pays développés": 100 }],
];

// Pays de la société (préfixe ISIN) → zone
const EUROPE_CODES = ["DE", "NL", "BE", "IT", "ES", "PT", "IE", "LU", "AT", "FI", "GB", "CH", "SE", "DK", "NO", "GR", "PL", "CZ", "HU", "JE", "GG", "IM"];
const EMERGING_CODES = ["CN", "IN", "BR", "TW", "KR", "MX", "ZA", "ID", "TH", "MY", "PH", "CL", "PE", "CO", "TR", "SA", "AE", "QA", "HK", "KY"];
const OTHER_DEV_CODES = ["CA", "AU", "NZ", "SG", "IL", "BM"];
function zoneOfCountry(code) {
  if (!code) return null;
  if (code === "FR") return "France";
  if (code === "US") return "États-Unis";
  if (code === "JP") return "Japon";
  if (EUROPE_CODES.includes(code)) return "Europe (hors France)";
  if (EMERGING_CODES.includes(code)) return "Pays émergents";
  if (OTHER_DEV_CODES.includes(code)) return "Autres pays développés";
  return null;
}
// Place de cotation (suffixe Yahoo) → pays
const SUFFIX = {
  PA: "FR", DE: "DE", F: "DE", AS: "NL", BR: "BE", MI: "IT", MC: "ES", LS: "PT", L: "GB", IL: "GB", SW: "CH", ST: "SE",
  CO: "DK", OL: "NO", HE: "FI", VI: "AT", IR: "IE", T: "JP", HK: "HK", SS: "CN", SZ: "CN", NS: "IN", BO: "IN", SA: "BR",
  KS: "KR", KQ: "KR", TW: "TW", TO: "CA", V: "CA", AX: "AU", NZ: "NZ", SI: "SG", TA: "IL", MX: "MX", JO: "ZA",
};
const countryOfSymbol = symbol => {
  if (!symbol || /[-=^]/.test(symbol)) return null; // crypto, devises, indices
  const m = symbol.match(/\.([A-Z]{1,2})$/);
  return m ? SUFFIX[m[1]] || null : "US"; // sans suffixe : cotée aux États-Unis
};

// Taille d'un ETF ou d'un fonds d'après son nom
const CAP_RULES = [
  [/small|micro|petites? cap/i, { Petites: 100 }],
  [/mid ?cap|moyennes? cap/i, { Moyennes: 100 }],
  [/s&p 500|\bsp ?500\b|\bcac 40\b|euro ?stoxx 50|nasdaq[- ]?100|dow jones|\bdax\b|ftse 100|nikkei/i, { Grandes: 100 }],
];
const BROAD = { Grandes: 85, Moyennes: 15 }; // indice large (MSCI World, Stoxx 600…) : grandes et moyennes
// Capitalisation en dollars (ordre de grandeur suffisant pour classer)
const USD = { USD: 1, EUR: 1.08, GBP: 1.27, GBp: 0.0127, CHF: 1.12, SEK: 0.095, DKK: 0.145, NOK: 0.093, JPY: 0.0067, CAD: 0.73, AUD: 0.66, HKD: 0.128, CNY: 0.14, INR: 0.012, KRW: 0.00073, TWD: 0.031, BRL: 0.18 };
function capClass({ cap, currency }) {
  const usd = cap * (USD[currency] ?? 1);
  return usd >= 10e9 ? "Grandes" : usd >= 2e9 ? "Moyennes" : "Petites";
}

const matchRules = (rules, text) => rules.find(([re]) => re.test(text))?.[1] || null;
const isStock = e => /^Action/.test(e.type || ""); // « Action directe » (ou « Action », ancien libellé)
const isEquity = e => e.exposition === "Actions" || isStock(e);
const isDirect = e => isStock(e) || e.type === "Obligation directe";

// Type détaillé d'une position
export function typeOf(e) {
  if (e.type === "Crypto" || e.exposition === "Crypto") return "Crypto";
  if (e.type === "Obligation directe") return "Obligations · en direct";
  if (e.exposition === "Obligations") return "Obligations · fonds";
  if (e.type === "SCPI") return "Immobilier · SCPI";
  if (e.exposition === "Immobilier") return "Immobilier · fonds";
  if (isEquity(e)) return e.type === "ETF" ? "Actions · ETF" : isStock(e) ? "Actions · en direct" : "Actions · fonds";
  return e.exposition || "Autres";
}

// Valeur cotée (symbole et nom complet), gardée en mémoire
const assets = new Map();
function assetFor(e) {
  const key = `${e.isin || ""}|${e.label}`;
  if (!assets.has(key)) assets.set(key, resolveAsset({ isin: e.isin, label: e.label }).catch(() => null));
  return assets.get(key);
}
const caps = new Map();
async function fetchCaps(symbols) {
  const missing = symbols.filter(s => !caps.has(s));
  if (missing.length) {
    const data = await fetch(`/api/marketcap?symbols=${encodeURIComponent(missing.join(","))}`).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
    missing.forEach(s => caps.set(s, data?.[s] || null));
  }
  return Object.fromEntries(symbols.map(s => [s, caps.get(s)]));
}

const add = (acc, key, w) => { acc[key] = (acc[key] || 0) + w; };
const spread = (acc, weights, w) => Object.entries(weights).forEach(([k, p]) => add(acc, k, (w * p) / 100));
const rows = (acc, order, total) => order.filter(k => acc[k] > 0.05).map(k => [k, (acc[k] / total) * 100]);

export async function analyzeDiversification(entries) {
  const list = (entries || []).filter(e => Number(e.percentage) > 0);
  const total = list.reduce((s, e) => s + Number(e.percentage), 0);
  if (!list.length || !total) return null;

  // Ce qu'il faut chercher en ligne : le symbole des actions (pays si pas d'ISIN, capitalisation)
  // et le nom complet des ETF et fonds dont le nom saisi ne dit pas l'indice suivi
  const lookups = await Promise.all(list.map(e => {
    const direct = isDirect(e);
    const needsName = !direct && !["Crypto", "Matières premières"].includes(e.exposition) && e.type !== "Crypto" && e.type !== "SCPI" && !matchRules(ZONE_RULES, e.label || "");
    return (isStock(e) || (direct && !e.isin) || needsName) ? assetFor(e) : null;
  }));
  const stockSymbols = [...new Set(list.map((e, i) => (isStock(e) ? lookups[i]?.symbol : null)).filter(Boolean))];
  const capsBySymbol = stockSymbols.length ? await fetchCaps(stockSymbols) : {};

  const zones = {}, sizes = {}, types = {};
  let equity = 0, vol = 0;
  list.forEach((e, i) => {
    const w = Number(e.percentage);
    const asset = lookups[i];
    add(types, typeOf(e), w);

    // Zone
    let zone;
    if (e.type === "Crypto" || ["Crypto", "Matières premières"].includes(e.exposition)) zone = { "Hors zone": 100 };
    else if (e.type === "SCPI") zone = { France: 100 };
    else if (isDirect(e)) {
      const z = zoneOfCountry((e.isin || "").slice(0, 2).toUpperCase()) || zoneOfCountry(countryOfSymbol(asset?.symbol));
      zone = z ? { [z]: 100 } : null;
    } else zone = matchRules(ZONE_RULES, e.label || "") || matchRules(ZONE_RULES, asset?.name || "");
    spread(zones, zone || { "Non identifiée": 100 }, w);

    // Taille des entreprises (part en actions seulement)
    let size = null;
    if (isEquity(e)) {
      equity += w;
      if (isStock(e)) {
        const c = capsBySymbol[asset?.symbol];
        size = c ? { [capClass(c)]: 100 } : null;
      } else {
        const text = `${e.label || ""} ${asset?.name || ""}`;
        size = matchRules(CAP_RULES, text) || (zone && !zone["Non identifiée"] ? BROAD : null);
      }
      spread(sizes, size || { "Non classées": 100 }, w);
    }

    // Volatilité indicative (même barème que le profil de risque, affinée)
    const base = { Actions: 0.18, Crypto: 0.65, Immobilier: 0.12, Obligations: 0.05, Monétaire: 0.01, "Multi-actifs": 0.10, "Matières premières": 0.20 };
    let v = base[e.exposition] ?? base[e.type] ?? (isStock(e) ? 0.18 : 0.12);
    if (e.type === "Crypto") v = 0.65;
    if (isEquity(e)) {
      if (zone?.["Pays émergents"]) v += 0.04 * (zone["Pays émergents"] / 100);
      if (size?.Petites) v += 0.06 * (size.Petites / 100);
    }
    vol += v * (w / total);
  });

  return {
    zones: rows(zones, ZONES, total),
    sizes: equity ? rows(sizes, CAPS, equity) : [],
    equityPct: (equity / total) * 100,
    types: Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, w]) => [k, (w / total) * 100]),
    vol,
  };
}
