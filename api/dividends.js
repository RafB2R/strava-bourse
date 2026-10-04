export const config = { runtime: 'edge' };

// Dividendes versés sur 12 mois glissants pour une liste d'ISIN (Yahoo Finance).
// GET /api/dividends?isins=FR0000120271,IE00B4L5Y983
// → { "FR0000120271": { symbol, name, currency, price, dps, yield, payments: [{ date, amount }] }, ... }

const YAHOO = 'https://query2.finance.yahoo.com';
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const YEAR = 365 * 24 * 3600 * 1000;

async function lookup(isin) {
  const res = await fetch(`${YAHOO}/v1/finance/search?q=${encodeURIComponent(isin)}&quotesCount=1&newsCount=0&listsCount=0`, { headers: HEADERS });
  const quote = (await res.json())?.quotes?.[0];
  return quote ? { symbol: quote.symbol, name: quote.longname || quote.shortname || quote.symbol } : null;
}

// Somme des dividendes par action versés depuis un an, cours et devise
export function summarize(chart, now = Date.now()) {
  const result = chart?.chart?.result?.[0];
  if (!result) return null;
  const price = result.meta?.regularMarketPrice ?? null;
  const payments = Object.values(result.events?.dividends || {})
    .map(d => ({ date: new Date(d.date * 1000).toISOString().slice(0, 10), amount: Number(d.amount) }))
    .filter(d => d.amount > 0 && now - new Date(d.date).getTime() <= YEAR)
    .sort((a, b) => a.date.localeCompare(b.date));
  const dps = payments.reduce((s, d) => s + d.amount, 0);
  return {
    currency: result.meta?.currency || null,
    price,
    dps: Math.round(dps * 10000) / 10000,
    yield: price ? (dps / price) * 100 : null,
    payments,
  };
}

async function dividendsFor(isin) {
  try {
    const found = await lookup(isin);
    if (!found) return null;
    const res = await fetch(`${YAHOO}/v8/finance/chart/${encodeURIComponent(found.symbol)}?range=1y&interval=1mo&events=div`, { headers: HEADERS });
    const summary = summarize(await res.json());
    return summary ? { ...found, ...summary } : null;
  } catch {
    return null;
  }
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const isins = [...new Set((searchParams.get('isins') || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(s => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s)))]
    .slice(0, 40);

  const entries = await Promise.all(isins.map(async isin => [isin, await dividendsFor(isin)]));
  return new Response(JSON.stringify(Object.fromEntries(entries)), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      // Les dividendes changent peu : cache CDN de 6 h
      'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
    },
  });
}
