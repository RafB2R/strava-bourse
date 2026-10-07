export const config = { runtime: 'edge' };

// Taux d'État à 10 ans : OAT (France) et Bund (Allemagne), en quotidien.
//   - OAT : Stooq (cours de clôture quotidien, accès libre, source non officielle)
//   - Bund : Bundesbank (quotidien, officiel, accès libre)
//   - à défaut : BCE (moyenne mensuelle officielle, un à deux mois de décalage)
// GET /api/rates          → { fr: { value, date, previous, change, frequency, source }, de: { ... } }
// GET /api/rates?debug=1  → ajoute le détail de chaque source essayée (pour diagnostiquer)
// GET /api/rates?history=fr&period=5y → historique mensuel BCE pour la fiche du taux
//   { symbol, period, price, points: [[timestamp_ms, taux], ...], change, annualized: null, date, source }

const ECB_URL = 'https://data-api.ecb.europa.eu/service/data/IRS/M.FR+DE.L.L40.CI.0000.EUR.N.Z?lastNObservations=2&format=csvdata';
const BUNDESBANK_URL = 'https://api.statistiken.bundesbank.de/rest/data/BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A?lastNObservations=5';

// Historique quotidien Stooq des 3 dernières semaines (10fry.b = rendement OAT 10 ans)
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
export function stooqUrl(symbol, now = new Date()) {
  return `https://stooq.com/q/d/l/?s=${symbol}&i=d&d1=${ymd(new Date(now.getTime() - 21 * 86400e3))}&d2=${ymd(now)}`;
}

function splitCsvLine(line) {
  const out = [];
  let cur = '', quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if ((ch === ',' || ch === ';') && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// Dernière observation et variation par rapport à la précédente (en points)
function latest(obs, frequency, source) {
  const list = obs.filter(o => Number.isFinite(o.value)).sort((a, b) => a.date.localeCompare(b.date));
  if (list.length === 0) return null;
  const last = list[list.length - 1], prev = list[list.length - 2];
  return {
    value: last.value,
    date: last.date,
    previous: prev ? prev.value : null,
    change: prev ? Math.round((last.value - prev.value) * 1000) / 1000 : null,
    frequency,
    source,
  };
}

// CSV au format SDMX (BCE, Bundesbank) : colonnes TIME_PERIOD et OBS_VALUE, éventuellement REF_AREA
export function parseSdmxCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const header = splitCsvLine(lines[0]).map(h => h.trim());
  const [iArea, iTime, iValue] = ['REF_AREA', 'TIME_PERIOD', 'OBS_VALUE'].map(n => header.indexOf(n));
  if (iTime < 0 || iValue < 0) return {};
  const byArea = {};
  for (const line of lines.slice(1)) {
    const v = splitCsvLine(line);
    const area = iArea >= 0 ? v[iArea].toLowerCase() : '_';
    (byArea[area] ||= []).push({ date: v[iTime], value: parseFloat(String(v[iValue]).replace(',', '.')) });
  }
  return byArea;
}

// CSV Stooq : Date,Open,High,Low,Close. Hors CSV (limite de requêtes, symbole inconnu) : erreur explicite
export function parseStooq(csv) {
  const text = String(csv || '').trim();
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const iDate = header.indexOf('date'), iClose = header.indexOf('close');
  if (iDate < 0 || iClose < 0) throw new Error(`Réponse Stooq inattendue : « ${text.slice(0, 80)} »`);
  return lines.slice(1).map(l => {
    const v = l.split(',');
    return { date: v[iDate], value: parseFloat(v[iClose]) };
  });
}

async function attempt(name, fn, debug) {
  try {
    const result = await fn();
    debug.push({ source: name, ok: !!result, result });
    return result;
  } catch (e) {
    debug.push({ source: name, ok: false, error: String(e?.message || e) });
    return null;
  }
}

// Historique mensuel officiel (BCE, depuis les années 1990) d'un taux à 10 ans, coupé à la période
const HISTORY_YEARS = { '1y': 1, '5y': 5, '10y': 10, 'max': null };
export function historyFromCsv(csv, period, now = new Date()) {
  const rows = Object.values(parseSdmxCsv(csv)).flat()
    .filter(o => Number.isFinite(o.value) && /^\d{4}-\d{2}$/.test(o.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const years = HISTORY_YEARS[period];
  const from = years ? new Date(now.getFullYear() - years, now.getMonth(), 1).getTime() : -Infinity;
  const points = rows.map(o => [Date.UTC(+o.date.slice(0, 4), +o.date.slice(5, 7) - 1, 15), o.value]).filter(([t]) => t >= from);
  if (points.length === 0) return null;
  const first = points[0][1], last = points[points.length - 1][1];
  return { price: last, points, change: first ? ((last - first) / first) * 100 : null, annualized: null, date: rows[rows.length - 1].date, source: 'BCE' };
}

async function historyResponse(country, period) {
  const json = (body, status, cache) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': cache },
  });
  if (!['fr', 'de'].includes(country)) return json({ error: 'Pays inconnu' }, 400, 'no-store');
  const p = HISTORY_YEARS[period] !== undefined ? period : '5y';
  try {
    const res = await fetch(`https://data-api.ecb.europa.eu/service/data/IRS/M.${country.toUpperCase()}.L.L40.CI.0000.EUR.N.Z?format=csvdata`, { headers: { Accept: 'text/csv' } });
    if (!res.ok) return json({ error: `BCE : HTTP ${res.status}` }, 502, 'no-store');
    const summary = historyFromCsv(await res.text(), p);
    if (!summary) return json({ error: 'Pas de données' }, 404, 'no-store');
    // Série mensuelle : un jour de cache suffit
    return json({ symbol: `RATE:${country}`, period: p, ...summary }, 200, 'public, s-maxage=86400, stale-while-revalidate=604800');
  } catch (e) {
    return json({ error: String(e?.message || e) }, 502, 'no-store');
  }
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('history')) return historyResponse(searchParams.get('history'), searchParams.get('period'));
  const debug = [{ source: 'Version', ok: true, result: 'diagnostic v4 (Stooq)' }];

  const ecb = attempt('BCE (mensuel)', async () => {
    const res = await fetch(ECB_URL, { headers: { Accept: 'text/csv' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const byArea = parseSdmxCsv(await res.text());
    return { fr: latest(byArea.fr || [], 'monthly', 'BCE'), de: latest(byArea.de || [], 'monthly', 'BCE') };
  }, debug);

  const bund = attempt('Bundesbank (quotidien)', async () => {
    const res = await fetch(BUNDESBANK_URL, { headers: { Accept: 'application/vnd.sdmx.data+csv;version=1.0.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const byArea = parseSdmxCsv(await res.text());
    return latest(Object.values(byArea).flat(), 'daily', 'Bundesbank');
  }, debug);

  const oat = attempt('Stooq (quotidien)', async () => {
    const res = await fetch(stooqUrl('10fry.b'), { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return latest(parseStooq(await res.text()), 'daily', 'Stooq');
  }, debug);

  const [monthly, de, fr] = await Promise.all([ecb, bund, oat]);
  const rates = { fr: fr || monthly?.fr || null, de: de || monthly?.de || null };
  if (searchParams.get('debug')) rates.debug = debug;

  return new Response(JSON.stringify(rates), {
    status: rates.fr || rates.de ? 200 : 502,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      // Données quotidiennes : cache CDN d'une heure
      'Cache-Control': searchParams.get('debug') ? 'no-store' : 'public, s-maxage=3600, stale-while-revalidate=21600',
    },
  });
}
