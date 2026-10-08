import { resolveAsset } from "./attachments";
import { fetchChart } from "./indices";

// Comparaison de deux portefeuilles, en % uniquement (jamais de montants).
//  - photoStats : ce que disent les positions actuelles (diversification, plus grosse ligne…)
//  - simulate : performance, volatilité, ratio de Sharpe et pire baisse sur une période,
//    en SIMULATION : la répartition actuelle appliquée aux cours passés (l'historique
//    réel des portefeuilles n'existe pas encore ; il viendra avec Powens).

export const RISK_FREE = 2; // taux sans risque (% par an) pour le ratio de Sharpe

// Même formule que la vue member_stats (score sur 100)
export function photoStats(entries) {
  if (!entries?.length) return null;
  const total = entries.reduce((s, e) => s + Number(e.percentage), 0) || 1;
  const share = e => (Number(e.percentage) / total) * 100;
  const classes = new Set(entries.map(e => e.exposition || e.type || "")).size;
  const brokers = new Set(entries.map(e => e.broker).filter(Boolean)).size;
  const maxLine = Math.max(...entries.map(share));
  const diversif = Math.min(classes * 15, 40) + Math.min(brokers * 10, 20)
    + (maxLine <= 30 ? 25 : maxLine <= 50 ? 15 : 5) + Math.min(entries.length * 3, 15);
  const etf = entries.filter(e => e.type === "ETF").reduce((s, e) => s + share(e), 0);
  return { diversif, positions: entries.length, maxLine, classes, etf };
}

// Valeur cotée d'une position, retrouvée par son ISIN (si connu) ou son nom ; gardée en mémoire
const symbols = new Map();
function symbolFor(entry) {
  const key = `${entry.isin || ""}|${entry.label}`;
  if (!symbols.has(key)) symbols.set(key, resolveAsset({ isin: entry.isin, label: entry.label }).then(a => a?.symbol || null).catch(() => null));
  return symbols.get(key);
}

const charts = new Map();
function chartFor(symbol, period) {
  const key = `${symbol}|${period}`;
  if (!charts.has(key)) charts.set(key, fetchChart(symbol, period));
  return charts.get(key);
}

const MAX_LINES = 12; // les plus grosses lignes suffisent à décrire le portefeuille

export async function simulate(entries, period) {
  const lines = [...(entries || [])].sort((a, b) => Number(b.percentage) - Number(a.percentage)).slice(0, MAX_LINES);
  const total = (entries || []).reduce((s, e) => s + Number(e.percentage), 0);
  if (!lines.length || !total) return null;
  const series = (await Promise.all(lines.map(async e => {
    const symbol = await symbolFor(e);
    const chart = symbol ? await chartFor(symbol, period) : null;
    const pts = chart?.points?.filter(p => p[1] > 0);
    return pts?.length > 1 ? { w: Number(e.percentage), pts } : null;
  }))).filter(Boolean);
  if (!series.length) return null;
  const covered = series.reduce((s, x) => s + x.w, 0);

  // Alignement par jour calendaire (Paris et New York ne clôturent pas à la même heure) :
  // chaque série est ramenée à 1 au départ et prolongée par sa dernière valeur connue
  // (jours fériés, places différentes) ; avant sa première cotation, elle compte pour 1.
  const day = t => new Date(t).toISOString().slice(0, 10);
  const byDay = series.map(s => new Map(s.pts.map(p => [day(p[0]), p[1] / s.pts[0][1]])));
  const days = [...new Set(series.flatMap(s => s.pts.map(p => day(p[0]))))].sort();
  const last = series.map(() => 1);
  const index = days.map(d => {
    let v = 0;
    series.forEach((s, k) => {
      const x = byDay[k].get(d);
      if (x !== undefined) last[k] = x;
      v += s.w * last[k];
    });
    return v / covered;
  });
  const grid = days.map(d => Date.parse(d));

  const returns = index.slice(1).map((v, i) => v / index[i] - 1);
  const years = (grid[grid.length - 1] - grid[0]) / (365.25 * 86400e3);
  const perYear = returns.length / Math.max(years, 1 / 365);
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const vol = Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(returns.length - 1, 1)) * Math.sqrt(perYear) * 100;
  const perf = (index[index.length - 1] - 1) * 100;
  const annual = (Math.pow(index[index.length - 1], 1 / Math.max(years, 1 / 365)) - 1) * 100;
  let peak = index[0], drawdown = 0;
  for (const v of index) { peak = Math.max(peak, v); drawdown = Math.min(drawdown, (v / peak - 1) * 100); }
  return {
    perf,
    vol,
    sharpe: vol > 0 ? (annual - RISK_FREE) / vol : null,
    drawdown,
    coverage: Math.round((covered / total) * 100),
  };
}
