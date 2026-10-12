// Pièces jointes « marché » des posts : valeur citée, graphique, répartition du portefeuille
import { supabase } from "./supabase";
import { t } from "./i18n";

export const CHART_PERIODS = [
  { id: "1mo", label: "1M" },
  { id: "6mo", label: "6M" },
  { id: "1y", label: t("1A") },
  { id: "5y", label: t("5A") },
];

const SYMBOL = /^[A-Za-z0-9.^=-]{1,20}$/;

export async function searchAssets(q) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = res.ok ? await res.json() : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Cours du moment, gardés une minute (une même valeur peut apparaître dans plusieurs posts)
const quoteCache = new Map();
export function fetchQuote(symbol) {
  const hit = quoteCache.get(symbol);
  if (hit && Date.now() - hit.at < 60000) return hit.promise;
  const promise = loadQuote(symbol);
  quoteCache.set(symbol, { at: Date.now(), promise });
  return promise;
}

async function loadQuote(symbol) {
  try {
    const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
    const data = res.ok ? await res.json() : null;
    return data?.price ? data : null;
  } catch {
    return null;
  }
}

// Valeur citée dans un post : { symbol, name, type, chart: période ou null } (vérifiée avant affichage)
export function cleanAsset(a) {
  if (!a || typeof a.symbol !== "string" || !SYMBOL.test(a.symbol)) return null;
  const chart = CHART_PERIODS.some(p => p.id === a.chart) ? a.chart : null;
  return { symbol: a.symbol, name: String(a.name || a.symbol).slice(0, 80), type: String(a.type || "").slice(0, 12), chart };
}

// Répartition actuelle de mon portefeuille, en % uniquement (jamais de montant)
// mode « classes » : par classe d'actifs · « positions » : les 8 plus grosses lignes, le reste regroupé
export async function myAllocation(mode) {
  const { data } = await supabase.rpc("get_my_portfolio_entries");
  const entries = (data || []).filter(e => Number(e.percentage) > 0);
  if (entries.length === 0) return [];
  const groups = {};
  for (const e of entries) {
    const key = mode === "classes" ? (e.exposition || e.type || "Autre") : (e.label || "Position");
    groups[key] = (groups[key] || 0) + Number(e.percentage);
  }
  const total = Object.values(groups).reduce((s, v) => s + v, 0);
  let rows = Object.entries(groups).map(([label, v]) => ({ label: label.slice(0, 40), pct: Math.round((v / total) * 1000) / 10 }))
    .sort((a, b) => b.pct - a.pct);
  if (rows.length > 8) {
    const rest = rows.slice(7).reduce((s, r) => s + r.pct, 0);
    rows = [...rows.slice(0, 7), { label: "Autres", pct: Math.round(rest * 10) / 10 }];
  }
  return rows;
}

export function cleanAllocation(a) {
  if (!a || !Array.isArray(a.rows)) return null;
  const rows = a.rows.filter(r => r && typeof r.label === "string" && Number.isFinite(Number(r.pct)))
    .slice(0, 8).map(r => ({ label: r.label.slice(0, 40), pct: Math.max(0, Math.min(100, Number(r.pct))) }));
  return rows.length ? { mode: a.mode === "positions" ? "positions" : "classes", rows } : null;
}

// Noms de plus en plus courts pour la recherche : les noms complets de fonds et d'ETF
// (« Amundi CAC 40 UCITS ETF - S EUR Acc », « … Small A (C) ») ne sont pas reconnus tels quels
export function nameVariants(label) {
  const base = String(label || "").trim();
  const out = [base];
  let v = base.split(/\s[-–]\s/)[0];                        // avant « - S EUR Acc »
  out.push(v);
  v = v.replace(/\([^)]*\)/g, " ")                            // (C), (D), (Acc)
    .replace(/\b(UCITS|ETF|SICAV|FCP|Acc|Dist|Capitalisation|Distribution|Hedged|EUR|USD|C|D|A|I|R|S|P)\b\.?/gi, " ")
    .replace(/\s+/g, " ").trim();
  out.push(v);
  out.push(v.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));  // sans accents
  return [...new Set(out)].filter(x => x.length >= 3);
}

// Places européennes d'abord (un ETF est souvent coté à Paris, Amsterdam, Milan…)
const EURO_LISTING = /\.(PA|DE|F|AS|MI|BR|MC|LS|VI|HE|IR)$|^FUND-/;

// Valeur cotée correspondant à une position (ISIN d'abord, sinon son nom, puis des versions
// plus courtes du nom) ; null si introuvable. Par le nom, on peut tomber sur une autre part
// du même fonds : même évolution, pas forcément le même prix (le cours de la position, lui,
// n'est actualisé que par l'ISIN exact).
export async function resolveAsset({ isin, label }) {
  const queries = [(isin || "").trim(), ...nameVariants(label)].filter(x => x.length >= 2);
  for (const q of [...new Set(queries)]) {
    const results = await searchAssets(q);
    if (results.length) return results.find(r => EURO_LISTING.test(r.symbol)) || results[0];
  }
  return null;
}
