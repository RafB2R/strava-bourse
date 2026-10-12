export const config = { runtime: 'edge' };

import { UA, yahooSession as session } from './_lib/yahoo.js';

// Capitalisation boursière d'actions (pour classer grandes / moyennes / petites).
// GET /api/marketcap?symbols=MC.PA,AAPL → { "MC.PA": { cap, currency }, "AAPL": { … } }
// Yahoo ne donne la capitalisation qu'avec un jeton (« crumb ») lié à un cookie :
// on récupère les deux, puis on interroge /v7/finance/quote. Gardé 1 jour en cache.

export default async function handler(req) {
  const json = (body, status = 200, cache = 'public, s-maxage=86400, stale-while-revalidate=604800') =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } });
  const symbols = (new URL(req.url).searchParams.get('symbols') || '')
    .split(',').map(s => s.trim()).filter(s => /^[\w.^=-]{1,20}$/.test(s)).slice(0, 40);
  if (!symbols.length) return json({}, 200, 'no-store');
  try {
    const { cookie, crumb } = await session();
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}&fields=marketCap,currency&crumb=${encodeURIComponent(crumb)}`;
    const res = await fetch(url, { headers: { ...UA, cookie } });
    if (!res.ok) return json({ error: `Yahoo : HTTP ${res.status}` }, 502, 'no-store');
    const data = await res.json();
    const out = {};
    for (const q of data?.quoteResponse?.result || []) {
      if (q.symbol && q.marketCap > 0) out[q.symbol] = { cap: q.marketCap, currency: q.currency || null };
    }
    return json(out);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 502, 'no-store');
  }
}
