export const config = { runtime: 'edge' };

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

// Calendrier des résultats des 3 prochains mois (Alpha Vantage, sociétés cotées aux États-Unis,
// dont les grandes européennes via leurs ADR). La clé gratuite est limitée à 25 appels par jour :
// la réponse est gardée 12 h en cache par Vercel.
// GET /api/earnings → [{ symbol, name, date, eps, currency, time: "pre-market" | "post-market" | null }]
const WATCHLIST = [
  // États-Unis
  'AAPL', 'NVDA', 'MSFT', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AVGO', 'ORCL', 'ADBE', 'CRM', 'AMD', 'INTC', 'NFLX',
  'JPM', 'BAC', 'GS', 'V', 'MA', 'BRK.B', 'JNJ', 'UNH', 'LLY', 'PFE', 'MRK', 'WMT', 'COST', 'HD', 'MCD', 'KO',
  'PEP', 'PG', 'DIS', 'NKE', 'XOM', 'CVX',
  // Grandes européennes (ADR)
  'TTE', 'ASML', 'SAP', 'NVO', 'SNY', 'AZN', 'SHEL', 'BP', 'UL', 'HSBC', 'NVS',
];

const json = (body, cache) => new Response(JSON.stringify(body), {
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': cache },
});

export default async function handler() {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) return json([], 'no-store');

  try {
    const url = `https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${apiKey}`;
    const res = await fetch(url);
    const csv = await res.text();

    // En-têtes : symbol,name,reportDate,fiscalDateEnding,estimate,currency,timeOfTheDay
    const lines = csv.trim().split('\n');
    if (!/^symbol,/.test(lines[0] || '')) return json([], 'no-store'); // quota dépassé ou clé refusée

    const rows = lines.slice(1)
      .map(line => parseCSVLine(line.trim()))
      .filter(vals => vals.length >= 5 && WATCHLIST.includes(vals[0]) && /^\d{4}-\d{2}-\d{2}$/.test(vals[2]))
      .map(vals => ({
        symbol: vals[0],
        name: vals[1],
        date: vals[2],
        eps: vals[4] !== '' && !isNaN(parseFloat(vals[4])) ? parseFloat(vals[4]) : null,
        currency: vals[5] || null,
        time: ['pre-market', 'post-market'].includes(vals[6]) ? vals[6] : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

    return json(rows, 'public, s-maxage=43200, stale-while-revalidate=86400');
  } catch {
    return json([], 'no-store');
  }
}
