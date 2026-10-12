export const config = { runtime: 'edge' };

import { fundSummary, ISIN, FUND_PREFIX } from './_lib/funds.js';

// Recherche d'une valeur (action, ETF, indice, fonds, crypto) par nom, ticker ou ISIN.
// GET /api/search?q=total → [{ symbol, name, exchange, type }]
const TYPES = { EQUITY: 'Action', ETF: 'ETF', INDEX: 'Indice', MUTUALFUND: 'Fonds', CRYPTOCURRENCY: 'Crypto' };

export default async function handler(req) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 40);
  const json = (body, status = 200, cache = 'public, s-maxage=86400, stale-while-revalidate=604800') =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } });
  if (q.length < 2) return json([], 200, 'no-store');

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&listsCount=0&lang=fr-FR&region=FR`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = res.ok ? await res.json() : null;
    if (!data && !ISIN.test(q.toUpperCase())) return json({ error: `Yahoo : HTTP ${res.status}` }, 502, 'no-store');
    const results = (data?.quotes || [])
      .filter(r => r.symbol && TYPES[r.quoteType])
      .map(r => ({ symbol: r.symbol, name: r.longname || r.shortname || r.symbol, exchange: r.exchDisp || r.exchange || '', type: TYPES[r.quoteType] }))
      .slice(0, 6);
    // ISIN inconnu de Yahoo (fonds français, SICAV…) : fiche Financial Times
    const code = q.toUpperCase();
    if (!results.length && ISIN.test(code)) {
      const fund = await fundSummary(code).catch(() => null);
      if (fund) return json([{ symbol: FUND_PREFIX + code, name: fund.name, exchange: 'Fonds', type: 'Fonds' }]);
    }
    return json(results);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500, 'no-store');
  }
}
