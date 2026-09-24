export const config = { runtime: 'edge' };

export default async function handler(req) {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  try {
    const today = new Date();
    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const from = today.toISOString().split('T')[0];
    const to = in30.toISOString().split('T')[0];

    const url = `https://financialmodelingprep.com/api/v3/earning_calendar?from=${from}&to=${to}&apikey=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    // Vérifier que c'est bien un tableau
    if (!Array.isArray(data)) {
      return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    const watchlist = ['AAPL','NVDA','MSFT','GOOGL','META','AMZN','TSLA','MC.PA','TTE.PA','AIR.PA','BNP.PA','SAN.PA','OR.PA'];
    const filtered = data
      .filter(e => watchlist.includes(e.symbol))
      .slice(0, 10)
      .map(e => ({
        date: e.date,
        company: e.symbol,
        eps: e.epsEstimated || null,
        revenue: e.revenueEstimated || null,
      }));

    return new Response(JSON.stringify(filtered), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
