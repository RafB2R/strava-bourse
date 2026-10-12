// Fonds (OPCVM, SICAV, FCP) absents de Yahoo : valeur liquidative et historique d'après
// les pages publiques de Financial Times (markets.ft.com), à partir de l'ISIN.
// Fichier dans api/_lib : pas une route, Vercel ne le publie pas.
//
// Symbole interne : « FUND-<ISIN> » (ex. FUND-FR0010316265), compris par /api/search,
// /api/quote et /api/chart. Rien n'est stocké : tout est relu (et mis en cache par Vercel).

export const FUND_PREFIX = 'FUND-';
export const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
export const isFundSymbol = s => typeof s === 'string' && s.startsWith(FUND_PREFIX) && ISIN.test(s.slice(FUND_PREFIX.length));

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept-Language': 'en-GB,en;q=0.8' };
const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç', ocirc: 'ô', icirc: 'î', ucirc: 'û', ugrave: 'ù', Eacute: 'É' };
const decode = s => s.replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, k) => ENTITIES[k] ?? m)
  .replace(/\s+/g, ' ').trim();
const num = s => { const n = parseFloat(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

// Fiche du fonds : nom, devise, dernière valeur liquidative et identifiant interne FT (xid)
export async function fundSummary(isin) {
  for (const currency of ['EUR', 'USD', 'GBP', 'CHF']) {
    const res = await fetch(`https://markets.ft.com/data/funds/tearsheet/summary?s=${isin}:${currency}`, { headers: HEADERS });
    if (!res.ok) continue;
    const html = await res.text();
    const price = num(decode(html.match(/mod-ui-data-list__value[^>]*>([^<]+)</)?.[1] || ''));
    if (!(price > 0)) continue;
    const name = decode(html.match(/mod-tearsheet-overview__header__name[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '') || isin;
    const xid = html.match(/xid(?:&quot;|")\s*:\s*(?:&quot;|")(\d+)/)?.[1] || null;
    return { isin, name, currency, price, xid };
  }
  return null;
}

// Historique quotidien [[timestamp_ms, valeur], …] depuis « from » (ms), par tranches d'un an
export async function fundHistory(xid, from) {
  if (!xid) return [];
  const fmt = d => `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
  const points = new Map();
  let end = Date.now();
  while (end > from) {
    const start = Math.max(from, end - 365 * 86400e3);
    const url = `https://markets.ft.com/data/equities/ajax/get-historical-prices?startDate=${fmt(new Date(start))}&endDate=${fmt(new Date(end))}&symbol=${xid}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) break;
    const html = (await res.json().catch(() => null))?.html || '';
    for (const row of html.match(/<tr[\s\S]*?<\/tr>/g) || []) {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
      if (cells.length < 5) continue;
      // 1re cellule : la date en toutes lettres (« Friday, October 09, 2026 »), parfois en double
      const dateText = decode(cells[0].match(/<span[^>]*>([^<]+)<\/span>/)?.[1] || cells[0]);
      const ts = Date.parse(dateText);
      const close = num(decode(cells[4]));
      if (Number.isFinite(ts) && close > 0) points.set(ts, close);
    }
    end = start - 86400e3;
  }
  return [...points.entries()].sort((a, b) => a[0] - b[0]);
}
