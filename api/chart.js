export const config = { runtime: 'edge' };

// Historique de cours (Yahoo Finance) pour un indice ou une action.
// GET /api/chart?symbol=^FCHI&period=5y
// → { symbol, currency, price, points: [[timestamp_ms, cours], ...], change, annualized }

// Pas de temps et durée de cache selon la période
export const PERIODS = {
  '1d': { range: '1d', interval: '5m', ttl: 300 },
  '5d': { range: '5d', interval: '30m', ttl: 900 },
  '1mo': { range: '1mo', interval: '1d', ttl: 3600 },
  '3mo': { range: '3mo', interval: '1d', ttl: 3600 },
  'ytd': { range: 'ytd', interval: '1d', ttl: 3600 },
  '1y': { range: '1y', interval: '1d', ttl: 3600 },
  '5y': { range: '5y', interval: '1wk', ttl: 21600 },
  '10y': { range: '10y', interval: '1mo', ttl: 21600 },
};

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

// Points (cours de clôture), variation sur la période et, au-delà d'un an, rendement annualisé
export function summarizeChart(json, period) {
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const closes = result.indicators?.quote?.[0]?.close || [];
  const points = (result.timestamp || [])
    .map((t, i) => [t * 1000, closes[i]])
    .filter(([, c]) => typeof c === 'number' && Number.isFinite(c));
  if (points.length === 0) return null;
  const meta = result.meta || {};
  const last = meta.regularMarketPrice ?? points[points.length - 1][1];
  // Sur une journée, la variation se mesure par rapport à la clôture de la veille
  const base = period === '1d' ? (meta.chartPreviousClose ?? meta.previousClose ?? points[0][1]) : points[0][1];
  const change = base ? ((last - base) / base) * 100 : null;
  const years = (points[points.length - 1][0] - points[0][0]) / YEAR_MS;
  const annualized = years >= 0.95 && base > 0 && last > 0 ? (Math.pow(last / base, 1 / years) - 1) * 100 : null;
  return { currency: meta.currency || null, price: last, points, change, annualized };
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || '').trim();
  const period = PERIODS[searchParams.get('period')] ? searchParams.get('period') : '5y';
  if (!/^[\^A-Za-z0-9.=-]{1,20}$/.test(symbol)) {
    return new Response(JSON.stringify({ error: 'Symbole invalide' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const { range, interval, ttl } = PERIODS[period];
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const summary = summarizeChart(await res.json(), period);
    if (!summary) return new Response(JSON.stringify({ error: 'Pas de données' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ symbol, period, ...summary }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}`,
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Source indisponible' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
}
