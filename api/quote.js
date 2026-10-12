export const config = { runtime: 'edge' };

import { fundSummary, isFundSymbol, FUND_PREFIX } from './_lib/funds.js';

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');
  if (!symbol) return new Response('Missing symbol', { status: 400 });

  // Fonds hors Yahoo : dernière valeur liquidative (Financial Times)
  if (isFundSymbol(symbol)) {
    const fund = await fundSummary(symbol.slice(FUND_PREFIX.length)).catch(() => null);
    if (!fund) return new Response(JSON.stringify({ error: 'No data' }), { status: 404 });
    return new Response(JSON.stringify({ price: fund.price, change: null, currency: fund.currency }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600' },
    });
  }

  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return new Response(JSON.stringify({ error: 'No data' }), { status: 404 });

    const price = meta.regularMarketPrice;
    const prev = meta.previousClose || meta.chartPreviousClose;
    const change = prev ? ((price - prev) / prev) * 100 : null;

    return new Response(JSON.stringify({ price, change, currency: meta.currency }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
