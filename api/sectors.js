export const config = { runtime: 'edge' };

// ETFs sectoriels S&P 500
const SECTOR_ETFS = [
  { symbol: 'XLK', name: 'Technologie' },
  { symbol: 'XLV', name: 'Santé' },
  { symbol: 'XLF', name: 'Finance' },
  { symbol: 'XLE', name: 'Énergie' },
  { symbol: 'XLY', name: 'Consommation discrétionnaire' },
  { symbol: 'XLP', name: 'Consommation courante' },
  { symbol: 'XLI', name: 'Industrie' },
  { symbol: 'XLRE', name: 'Immobilier' },
  { symbol: 'XLB', name: 'Matériaux' },
  { symbol: 'XLU', name: 'Services publics' },
  { symbol: 'XLC', name: 'Communication' },
];

async function fetchChange(symbol) {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.previousClose || meta.chartPreviousClose;
    return prev ? ((price - prev) / prev) * 100 : null;
  } catch { return null; }
}

export default async function handler(req) {
  try {
    const results = await Promise.all(
      SECTOR_ETFS.map(async s => ({
        name: s.name,
        symbol: s.symbol,
        change: await fetchChange(s.symbol),
      }))
    );

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
