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

export default async function handler(req) {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) return new Response(JSON.stringify([]), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });

  try {
    const url = `https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${apiKey}`;
    const res = await fetch(url);
    const csv = await res.text();

    const lines = csv.trim().split('\n');
    // headers: symbol,name,reportDate,fiscalDateEnding,estimate,currency,timeOfTheDay
    
    const watchlist = ['AAPL','NVDA','MSFT','GOOGL','META','AMZN','TSLA','MC.PA','TTE.PA','AIR.PA','BNP.PA','SAN.PA','NFLX','JPM','V','JNJ','WMT','BAC','XOM'];

    const rows = lines.slice(1)
      .map(line => parseCSVLine(line))
      .filter(vals => vals.length >= 5 && watchlist.includes(vals[0]))
      .map(vals => ({
        symbol: vals[0],
        name: vals[1],
        date: vals[2],
        eps: vals[4] !== '' ? parseFloat(vals[4]) : null,
      }))
      .filter(r => r.date)
      .slice(0, 12);

    return new Response(JSON.stringify(rows), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
