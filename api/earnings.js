export const config = { runtime: 'edge' };

export default async function handler(req) {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  try {
    const url = `https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${apiKey}`;
    const res = await fetch(url);
    const csv = await res.text();

    // Parser le CSV
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',');
    
    const watchlist = ['AAPL','NVDA','MSFT','GOOGL','META','AMZN','TSLA','MC.PA','TTE.PA','AIR.PA','BNP.PA','SAN.PA','OR.PA','CAP.PA'];

    const rows = lines.slice(1)
      .map(line => {
        const vals = line.split(',');
        return {
          symbol: vals[0],
          name: vals[1],
          date: vals[2],
          eps: vals[3] || null,
          revenue: vals[4] || null,
        };
      })
      .filter(r => watchlist.includes(r.symbol))
      .slice(0, 10);

    return new Response(JSON.stringify(rows), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
