// Revenus des positions (dividendes, coupons) et rendements sur 12 mois glissants.
import { supabase } from "./supabase";

const DAY = 24 * 3600 * 1000;

// Coupon pour une obligation, dividende sinon
export function incomeTypeFor(entry) {
  return entry.type === "Obligation directe" || entry.exposition === "Obligations" ? "coupon" : "dividende";
}

// Mes revenus (la table n'est lisible que par son propriétaire)
export async function fetchMyIncome() {
  const { data } = await supabase
    .from("portfolio_income")
    .select("id, entry_id, type, amount, received_at")
    .order("received_at", { ascending: false })
    .order("id", { ascending: false });
  return data || [];
}

const pct = (part, whole) => (whole > 0 ? (part / whole) * 100 : null);

/**
 * entries : positions (avec prix_achat, prix_actuel, nombre_parts)
 * incomes : versements { entry_id, amount, received_at }
 * Renvoie par position et pour tout le portefeuille :
 *   total12 (reçu sur 12 mois), yield (sur la valeur actuelle), yoc (sur le prix de revient)
 */
export function incomeStats(entries, incomes, today = new Date()) {
  const since = today.getTime() - 365 * DAY;
  const byEntry = {};
  let total12 = 0, value = 0, cost = 0;

  for (const e of entries) {
    const list = incomes.filter(i => String(i.entry_id) === String(e.id));
    const recent = list.filter(i => new Date(i.received_at).getTime() >= since);
    const sum = recent.reduce((s, i) => s + Number(i.amount), 0);
    const parts = Number(e.nombre_parts) || 0;
    const v = parts && e.prix_actuel ? parts * Number(e.prix_actuel) : 0;
    const c = parts && e.prix_achat ? parts * Number(e.prix_achat) : 0;
    byEntry[e.id] = {
      list,
      total12: sum,
      totalAll: list.reduce((s, i) => s + Number(i.amount), 0),
      yield: sum > 0 ? pct(sum, v) : null,
      yoc: sum > 0 ? pct(sum, c) : null,
    };
    total12 += sum;
    if (sum > 0) { value += v; cost += c; }
  }

  const portfolioValue = entries.reduce((s, e) => s + (Number(e.nombre_parts) && e.prix_actuel ? Number(e.nombre_parts) * Number(e.prix_actuel) : 0), 0);
  return {
    byEntry,
    total12,
    count12: incomes.filter(i => new Date(i.received_at).getTime() >= since).length,
    // Rendement de tout le portefeuille (positions sans revenu comprises)
    portfolioYield: total12 > 0 ? pct(total12, portfolioValue) : null,
    // Rendement des seules positions qui versent des revenus
    payersYield: total12 > 0 ? pct(total12, value) : null,
    payersYoc: total12 > 0 ? pct(total12, cost) : null,
  };
}

export const fmtYield = v => (v === null || v === undefined ? "—" : `${v.toFixed(v < 10 ? 2 : 1).replace(".", ",")} %`);

// Dividendes versés sur 12 mois par chaque titre, d'après Yahoo (route /api/dividends)
export async function fetchDividendInfo(isins) {
  const list = [...new Set(isins.filter(Boolean).map(i => i.trim().toUpperCase()))];
  if (list.length === 0) return {};
  try {
    const res = await fetch(`/api/dividends?isins=${encodeURIComponent(list.join(","))}`);
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

const positionValue = e => (Number(e.nombre_parts) > 0 && e.prix_actuel ? Number(e.nombre_parts) * Number(e.prix_actuel) : 0);

/**
 * Prévision de dividendes sur un an : rendement de chaque titre (dividendes
 * des 12 derniers mois ÷ cours) appliqué à la valeur de la position.
 * info : réponse de /api/dividends, ou null tant qu'elle n'est pas arrivée.
 */
export function dividendForecast(entries, info) {
  const rows = entries.map(e => {
    const value = positionValue(e);
    const d = e.isin && info ? info[e.isin.trim().toUpperCase()] : undefined;
    const status = !e.isin ? "sans_isin" : !info ? "chargement" : !d ? "introuvable" : "ok";
    const yieldPct = status === "ok" ? d.yield : null;
    const annual = yieldPct !== null && value > 0 ? (value * yieldPct) / 100 : null;
    return { entry: e, value, status, yield: yieldPct, annual, payments: d?.payments || [] };
  });
  const total = rows.reduce((s, r) => s + (r.annual || 0), 0);
  const portfolioValue = rows.reduce((s, r) => s + r.value, 0);
  const payers = rows
    .filter(r => r.annual > 0)
    .sort((a, b) => b.annual - a.annual)
    .map(r => ({ ...r, share: (r.annual / total) * 100 }));
  return {
    rows,
    payers,
    total,
    // Rendement de tout le portefeuille : les positions sans donnée comptent pour 0
    yield: portfolioValue > 0 ? (total / portfolioValue) * 100 : null,
    missingIsin: rows.filter(r => r.status === "sans_isin").length,
    notFound: rows.filter(r => r.status === "introuvable").length,
    loading: rows.some(r => r.status === "chargement"),
  };
}
