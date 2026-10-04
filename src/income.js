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
