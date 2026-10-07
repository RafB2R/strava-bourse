export const config = { runtime: 'edge' };

// Articles de presse récents sur un sujet (Google Actualités, en français).
// Utilisé par l'onglet « Actualités » du profil d'un Super Investor.
// GET /api/news?q=Warren Buffett → [{ title, source, url, date }]
// Gardé 1 h en cache par Vercel.

const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : null;
};

export function parseRss(xml, limit = 15) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  const out = [];
  for (const it of items) {
    const source = tag(it, 'source');
    let title = tag(it, 'title') || '';
    // Google ajoute « - Nom du journal » à la fin du titre
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const url = tag(it, 'link');
    const date = tag(it, 'pubDate');
    if (!title || !url || !/^https?:\/\//.test(url)) continue;
    out.push({ title, source, url, date: date ? new Date(date).toISOString() : null });
    if (out.length >= limit) break;
  }
  return out;
}

export default async function handler(req) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 100);
  if (q.length < 2) return Response.json({ error: 'q manquant' }, { status: 400 });
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Verio)' } });
    if (!res.ok) throw new Error(`Google Actualités ${res.status}`);
    return Response.json(parseRss(await res.text()), { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
