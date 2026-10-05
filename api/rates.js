export const config = { runtime: 'edge' };

// Taux d'État à 10 ans : OAT (France) et Bund (Allemagne).
// Sources officielles, de la plus fraîche à la moins fraîche :
//   - OAT : Banque de France (Webstat, quotidien, TEC 10) si la variable BDF_API_KEY est définie
//   - Bund : Bundesbank (quotidien, accès libre)
//   - à défaut : BCE (moyenne mensuelle)
// GET /api/rates          → { fr: { value, date, previous, change, frequency, source }, de: { ... } }
// GET /api/rates?debug=1  → ajoute le détail de chaque source essayée (pour diagnostiquer)

const ECB_URL = 'https://data-api.ecb.europa.eu/service/data/IRS/M.FR+DE.L.L40.CI.0000.EUR.N.Z?lastNObservations=2&format=csvdata';
const BUNDESBANK_URL = 'https://api.statistiken.bundesbank.de/rest/data/BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A?lastNObservations=5';
const BDF_SERIES = 'FM.D.FR.EUR.FR2.BB.FR10YT_RR.YLD'; // TEC 10 : taux de l'échéance constante 10 ans
const BDF_URL = 'https://webstat.banque-france.fr/api/explore/v2.1/catalog/datasets/observations/records'
  + `?where=${encodeURIComponent(`series_key="${BDF_SERIES}"`)}&order_by=${encodeURIComponent('time_period_start desc')}&limit=5`;

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

// Réponse Webstat (Opendatasoft) : results[].obs_value / time_period
export function parseBdf(json) {
  const rows = json?.results || json?.records?.map(r => r.record?.fields || r.fields) || [];
  return rows.map(r => ({
    date: String(r.time_period || r.time_period_start || r.date || '').slice(0, 10),
    value: parseFloat(String(r.obs_value ?? r.value ?? '').replace(',', '.')),
  })).filter(o => o.date);
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

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const debug = [];
  const key = typeof process !== 'undefined' ? process.env?.BDF_API_KEY : undefined;

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

  const oat = key
    ? attempt('Banque de France (quotidien)', async () => {
      const res = await fetch(BDF_URL, { headers: { Authorization: `Apikey ${key}`, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return latest(parseBdf(await res.json()), 'daily', 'Banque de France');
    }, debug)
    : (debug.push({ source: 'Banque de France (quotidien)', ok: false, error: 'BDF_API_KEY absente dans Vercel' }), null);

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
