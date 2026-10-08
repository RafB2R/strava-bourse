export const config = { runtime: 'edge' };

// Capitalisation boursière d'actions (pour classer grandes / moyennes / petites).
// GET /api/marketcap?symbols=MC.PA,AAPL → { "MC.PA": { cap, currency }, "AAPL": { … } }
// Yahoo ne donne la capitalisation qu'avec un jeton (« crumb ») lié à un cookie :
// on récupère les deux, puis on interroge /v7/finance/quote. Gardé 1 jour en cache.

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };

async function session() {
  const home = await fetch('https://fc.yahoo.com', { headers: UA, redirect: 'manual' });
  const raw = home.headers.get('set-cookie') || '';
  const cookie = raw.split(/,(?=\s*[A-Za-z0-9_]+=)/).map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
  if (!cookie) throw new Error('cookie Yahoo absent');
  const res = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { ...UA, cookie } });
  const crumb = (await res.text()).trim();
  if (!res.ok || !crumb || crumb.length > 40 || /\s|</.test(crumb)) throw new Error(`crumb Yahoo : HTTP ${res.status}`);
  return { cookie, crumb };
}

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
