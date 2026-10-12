import { symbolFor, chartFor } from "./compare";

// Historique du portefeuille, jour par jour, reconstruit à partir des cours de marché :
// chaque position compte depuis sa date d'achat (sinon depuis son ajout dans Verio),
// avec ses parts actuelles. Deux courbes :
//  - valeur (€, privée) : Σ parts × cours du jour, quand toutes les positions détenues
//    ont un nombre de parts et un prix actuel ;
//  - performance (%) : rendement pondéré jour après jour, sans compter les apports
//    (ajouter une position ne fait pas « monter » la performance).
// Le cours du jour est ramené au prix actuel saisi (cours du jour ÷ dernier cours), ce qui
// garde la devise de la saisie. Limite : les achats et ventes passés ne sont pas connus
// (on suppose les parts actuelles détenues depuis la date d'achat). Powens les apportera.

const DAY = 86400e3;
export const dayKey = ts => new Date(ts).toISOString().slice(0, 10);

export function entryStart(e) {
  const d = e.date_achat || e.created_at;
  return d ? String(d).slice(0, 10) : dayKey(Date.now());
}

export async function buildHistory(entries) {
  const list = (entries || []).filter(e => Number(e.percentage) > 0);
  if (!list.length) return null;
  const today = dayKey(Date.now());
  const first = list.map(entryStart).sort()[0];
  // Moins d'un an : un point par jour ; au-delà : un point par semaine sur 5 ans
  const period = Date.now() - Date.parse(first) <= 360 * DAY ? "1y" : "5y";

  const series = (await Promise.all(list.map(async e => {
    const symbol = await symbolFor(e);
    const chart = symbol ? await chartFor(symbol, period).catch(() => null) : null;
    const pts = chart?.points?.filter(p => p[1] > 0);
    if (!pts?.length) return null;
    const last = pts[pts.length - 1][1];
    const parts = Number(e.nombre_parts), price = Number(e.prix_actuel);
    return {
      entry: e,
      start: entryStart(e),
      weight: Number(e.percentage),
      unitValue: parts > 0 && price > 0 ? parts * price : null, // valeur au dernier cours
      byDay: new Map(pts.map(p => [dayKey(p[0]), p[1] / last])), // cours relatif au dernier
    };
  }))).filter(Boolean);
  const coverage = Math.round((series.reduce((s, x) => s + x.weight, 0) / list.reduce((s, e) => s + Number(e.percentage), 0)) * 100);
  if (!series.length) return { points: [], coverage, first };

  // Jours de cotation depuis la première date, plus aujourd'hui
  const days = [...new Set(series.flatMap(s => [...s.byDay.keys()]))].filter(d => d >= first).sort();
  if (!days.includes(today)) days.push(today);
  const lastFactor = series.map(() => null);
  const points = [];
  let perf = 1, prev = null; // prev : { values par position détenue }
  for (const d of days) {
    const held = [];
    series.forEach((s, k) => {
      const f = s.byDay.get(d);
      if (f !== undefined) lastFactor[k] = f;
      if (d >= s.start && lastFactor[k] !== null) held.push(k);
    });
    if (!held.length) continue;
    // Rendement du jour, pondéré par le poids de la veille (valeur si connue, sinon %)
    if (prev) {
      const common = held.filter(k => prev.factor[k] !== undefined);
      const w = k => (prev.allValued ? prev.value[k] : series[k].weight);
      const tw = common.reduce((s, k) => s + w(k), 0);
      if (tw > 0) perf *= 1 + common.reduce((s, k) => s + w(k) * (lastFactor[k] / prev.factor[k] - 1), 0) / tw;
    }
    const allValued = held.every(k => series[k].unitValue !== null);
    const value = {}, factor = {};
    held.forEach(k => { factor[k] = lastFactor[k]; if (allValued) value[k] = series[k].unitValue * lastFactor[k]; });
    const total = allValued ? held.reduce((s, k) => s + value[k], 0) : null;
    points.push({ day: d, value: total, perf: (perf - 1) * 100 });
    prev = { factor, value, allValued };
  }
  return { points, coverage, first, period };
}

// Points d'une fenêtre (« 1mo », « 3mo », « 1y », « all »), performance recalée à 0 au début
export function windowOf(history, win) {
  const pts = history?.points || [];
  if (!pts.length) return [];
  const from = win === "all" ? "" : dayKey(Date.now() - { "1mo": 31, "3mo": 92, "1y": 366 }[win] * DAY);
  const sel = pts.filter(p => p.day >= from);
  if (!sel.length) return [];
  const base = 1 + sel[0].perf / 100;
  return sel.map(p => ({ ...p, perf: ((1 + p.perf / 100) / base - 1) * 100 }));
}

// ---------------------------------------------------------------------------------------
// Profil public : performance en base 100 rejouée à partir des mouvements publiés (onglet
// Activité). Chaque mouvement fixe le nouveau poids de la valeur concernée à sa date, et les
// autres positions s'ajustent pour garder 100 % (comme dans le portefeuille). Rien d'autre
// n'est lu : ni montant, ni date d'achat.

const MOVES = { new_position: d => d.percentage, renforcement: d => d.apres, allegement: d => d.apres, vente: () => 0, suppression_position: () => 0 };
export const MOVE_TYPES = Object.keys(MOVES);

function applyMove(weights, label, target) {
  const others = [...weights.keys()].filter(k => k !== label);
  const sum = others.reduce((s, k) => s + weights.get(k), 0);
  const t = Math.max(0, Math.min(100, Number(target) || 0));
  const room = others.length ? 100 - t : 0;
  others.forEach(k => weights.set(k, sum > 0 ? (weights.get(k) * room) / sum : 0));
  if (t > 0) weights.set(label, others.length ? t : 100); else weights.delete(label);
  [...weights.keys()].forEach(k => { if (!(weights.get(k) > 0)) weights.delete(k); });
}

// Mouvements publiés → [{ day, label, target, before }], du plus ancien au plus récent.
// Les dates d'achat (privées, connues du propriétaire seulement) avancent le début d'une
// position : son premier mouvement passe à la date d'achat, ou un départ est ajouté à cette
// date avec son poids d'avant (premier mouvement = renforcement…) ou son poids actuel.
function movesFrom(activities, entries) {
  const moves = (activities || [])
    .filter(a => MOVES[a.type] && a.data?.label)
    .map(a => ({ day: dayKey(Date.parse(a.created_at)), label: a.data.label, target: MOVES[a.type](a.data), before: a.data.avant, type: a.type }))
    .filter(m => m.target !== undefined && m.target !== null)
    .sort((a, b) => a.day.localeCompare(b.day));
  for (const e of entries) {
    const bought = e.date_achat ? String(e.date_achat).slice(0, 10) : null;
    if (!bought) continue;
    const firstMove = moves.find(m => m.label === e.label);
    if (!firstMove) moves.push({ day: bought, label: e.label, target: Number(e.percentage) });
    else if (bought < firstMove.day) {
      if (firstMove.type === "new_position") firstMove.day = bought;
      else if (Number(firstMove.before) > 0) moves.push({ day: bought, label: e.label, target: Number(firstMove.before) });
    }
  }
  return moves.sort((a, b) => a.day.localeCompare(b.day));
}

async function pricesFor(labels, entries, first) {
  const byLabel = new Map(entries.map(e => [e.label, e]));
  const period = Date.now() - Date.parse(first) <= 360 * DAY ? "1y" : "5y";
  return new Map((await Promise.all(labels.map(async label => {
    const e = byLabel.get(label) || { label };
    const symbol = await symbolFor(e);
    const chart = symbol ? await chartFor(symbol, period).catch(() => null) : null;
    const pts = chart?.points?.filter(p => p[1] > 0);
    return pts?.length ? [label, new Map(pts.map(p => [dayKey(p[0]), p[1]]))] : null;
  }))).filter(Boolean));
}

// Rejoue jour par jour à partir de « first » : rendement du jour avec les poids de la veille,
// puis mouvements du jour (ils comptent à partir du lendemain)
function replay(first, weights, moves, prices) {
  const today = dayKey(Date.now());
  const days = [...new Set([...prices.values()].flatMap(m => [...m.keys()]))].filter(d => d >= first).sort();
  if (!days.includes(today)) days.push(today);
  const last = new Map();
  let perf = 1, mi = 0, prevPrice = null;
  const points = [];
  for (const d of days) {
    const price = new Map();
    for (const [label, m] of prices) { if (m.has(d)) last.set(label, m.get(d)); if (last.has(label)) price.set(label, last.get(label)); }
    if (prevPrice) {
      let tw = 0, r = 0;
      for (const [label, w] of weights) {
        if (!prevPrice.has(label) || !price.has(label)) continue;
        tw += w; r += w * (price.get(label) / prevPrice.get(label) - 1);
      }
      if (tw > 0) perf *= 1 + r / tw;
    }
    while (mi < moves.length && moves[mi].day <= d) { applyMove(weights, moves[mi].label, moves[mi].target); mi++; }
    points.push({ day: d, value: null, perf: (perf - 1) * 100 });
    prevPrice = price;
  }
  return points;
}

// activities : mouvements [{ type, data, created_at }] ; entries : positions actuelles (ISIN,
// date d'achat si connue ; une position sans mouvement ni date compte depuis le début)
export async function buildMovesHistory(activities, entries = []) {
  const moves = movesFrom(activities, entries);
  if (!moves.length) return null;
  const first = moves[0].day;
  const seen = new Set(moves.map(m => m.label));
  const untracked = entries.filter(e => !seen.has(e.label) && Number(e.percentage) > 0);
  const labels = [...new Set([...moves.map(m => m.label), ...untracked.map(e => e.label)])];
  const prices = await pricesFor(labels, entries, first);
  const points = replay(first, new Map(untracked.map(e => [e.label, Number(e.percentage)])), moves, prices);
  const known = labels.filter(l => prices.has(l)).length;
  return { points, first, coverage: Math.round((known / labels.length) * 100) };
}

// Courbe publiée par le propriétaire ([{ day, perf }]), prolongée jusqu'à aujourd'hui avec
// les cours et les poids actuels (publics) de ses positions
export async function extendCurve(points, entries) {
  if (!points?.length) return points;
  const lastPoint = points[points.length - 1];
  if (lastPoint.day >= dayKey(Date.now())) return points;
  const held = entries.filter(e => Number(e.percentage) > 0);
  if (!held.length) return points;
  const prices = await pricesFor(held.map(e => e.label), held, lastPoint.day);
  const more = replay(lastPoint.day, new Map(held.map(e => [e.label, Number(e.percentage)])), [], prices);
  const base = 1 + lastPoint.perf / 100;
  return [...points, ...more.slice(1).map(p => ({ ...p, perf: (base * (1 + p.perf / 100) - 1) * 100 }))];
}
