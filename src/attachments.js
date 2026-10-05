// Pièces jointes « marché » des posts : valeur citée, graphique, répartition du portefeuille
import { supabase } from "./supabase";

export const CHART_PERIODS = [
  { id: "1mo", label: "1M" },
  { id: "6mo", label: "6M" },
  { id: "1y", label: "1A" },
  { id: "5y", label: "5A" },
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

export async function fetchQuote(symbol) {
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
