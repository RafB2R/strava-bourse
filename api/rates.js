export const config = { runtime: 'edge' };

// Taux d'État à 10 ans de la zone euro (OAT, Bund…) publiés par la BCE.
// Série IRS « taux d'intérêt à long terme » : moyenne mensuelle, officielle et gratuite.
// GET /api/rates → { fr: { value, period, previous, change }, de: { ... } }

const COUNTRIES = ['FR', 'DE'];
const URL_ECB = `https://data-api.ecb.europa.eu/service/data/IRS/M.${COUNTRIES.join('+')}.L.L40.CI.0000.EUR.N.Z?lastNObservations=2&format=csvdata`;

function splitCsvLine(line) {
  const out = [];
  let cur = '', quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// Dernière valeur mensuelle par pays et variation (en points) sur un mois
export function parseEcbCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const header = splitCsvLine(lines[0]);
  const col = name => header.indexOf(name);
  const [iArea, iTime, iValue] = [col('REF_AREA'), col('TIME_PERIOD'), col('OBS_VALUE')];
  if (iArea < 0 || iTime < 0 || iValue < 0) return {};
  const byCountry = {};
  for (const line of lines.slice(1)) {
    const v = splitCsvLine(line);
    const value = parseFloat(v[iValue]);
    if (!Number.isFinite(value)) continue;
    (byCountry[v[iArea].toLowerCase()] ||= []).push({ period: v[iTime], value });
  }
  const result = {};
  for (const [country, obs] of Object.entries(byCountry)) {
    obs.sort((a, b) => a.period.localeCompare(b.period));
    const last = obs[obs.length - 1], prev = obs[obs.length - 2];
    result[country] = {
      value: last.value,
      period: last.period,
      previous: prev ? prev.value : null,
      change: prev ? Math.round((last.value - prev.value) * 100) / 100 : null,
    };
  }
  return result;
}

export default async function handler() {
  try {
    const res = await fetch(URL_ECB, { headers: { Accept: 'text/csv' } });
    if (!res.ok) throw new Error(`BCE ${res.status}`);
    const rates = parseEcbCsv(await res.text());
    return new Response(JSON.stringify(rates), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        // Données mensuelles : cache CDN de 12 h
        'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400',
      },
    });
  } catch {
    return new Response(JSON.stringify({}), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
}
