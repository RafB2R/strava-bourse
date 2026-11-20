export const config = { runtime: 'edge' };

// Articles de presse récents sur une société, un indice ou une Légende, orientés finance,
// dans la langue du membre.
// GET /api/news?q="TotalEnergies"&lang=fr → [{ title, source, url, date, image }]
//   lang : fr (par défaut) ou en
// Deux sources réunies : Bing Actualités (image de l'article, lien direct vers le journal)
// et Google Actualités. La recherche est complétée de mots de la finance, et les articles
// de sport sont écartés (« TotalEnergies » est aussi une équipe cycliste…).
// Gardé 1 h en cache par Vercel.

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', ccedil: 'ç' };
const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, k) => ENTITIES[k] ?? m)
  .trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : null;
};
const attr = (block, name, attribute) => block.match(new RegExp(`<${name}[^>]*\\s${attribute}="([^"]+)"`, 'i'))?.[1] || null;

// Mots ajoutés à la recherche (au moins un doit apparaître) et mots du sport à écarter
const FINANCE = {
  fr: ['bourse', 'action', 'actions', 'résultats', 'dividende', 'marché', 'marchés', 'investisseurs', 'chiffre d\'affaires', 'bénéfice', 'économie', 'cours'],
  en: ['stock', 'shares', 'earnings', 'dividend', 'market', 'markets', 'investors', 'revenue', 'profit', 'economy', 'results'],
};
const SPORT = ['cyclisme', 'cycliste', 'vélo', 'tour de france', 'peloton', 'maillot', 'étape', 'coureur', 'football', 'rugby', 'tennis', 'ligue 1',
  'cycling', 'cyclist', 'peloton', 'stage win', 'jersey', 'grand prix', 'formula 1', 'formule 1', 'premier league', 'champions league'];

const EDITIONS = {
  fr: { google: 'hl=fr&gl=FR&ceid=FR:fr', bing: 'setlang=fr-FR&cc=FR&mkt=fr-FR' },
  en: { google: 'hl=en-US&gl=US&ceid=US:en', bing: 'setlang=en-US&cc=US&mkt=en-US' },
};

export function financeQuery(q, lang) {
  const words = FINANCE[lang] || FINANCE.fr;
  const or = words.map(w => (w.includes(' ') || w.includes("'") ? `"${w}"` : w)).join(' OR ');
  return `(${q}) (${or}) -cyclisme -vélo -cycling`;
}

const isSport = title => { const t = title.toLowerCase(); return SPORT.some(w => t.includes(w)); };

// Google Actualités : le lien passe par Google ; image seulement si le flux en donne une
export function parseGoogle(xml) {
  return (xml.match(/<item>[\s\S]*?<\/item>/gi) || []).map(it => {
    const source = tag(it, 'source');
    let title = tag(it, 'title') || '';
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const date = tag(it, 'pubDate');
    const image = attr(it, 'media:content', 'url') || attr(it, 'media:thumbnail', 'url') || (tag(it, 'description') || '').match(/<img[^>]+src="([^"]+)"/i)?.[1] || null;
    return { title, source, url: tag(it, 'link'), date: date ? new Date(date).toISOString() : null, image };
  });
}

// Bing Actualités : lien direct (paramètre url= du lien de suivi) et vignette de l'article
export function parseBing(xml) {
  return (xml.match(/<item>[\s\S]*?<\/item>/gi) || []).map(it => {
    let url = tag(it, 'link') || '';
    try { const inner = new URL(url).searchParams.get('url'); if (inner) url = inner; } catch { /* lien déjà direct */ }
    let image = tag(it, 'News:Image') || null;
    // Vignette Bing en plus grand (largeur 480, recadrée)
    if (image && /bing\.com\/th/.test(image)) image = `${image}${image.includes('?') ? '&' : '?'}w=480&h=270&c=7`;
    const date = tag(it, 'pubDate');
    return { title: tag(it, 'title') || '', source: tag(it, 'News:Source') || null, url, date: date ? new Date(date).toISOString() : null, image };
  });
}

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60);

export function mergeArticles(lists, limit = 8) {
  const seen = new Set();
  return lists.flat()
    .filter(a => a.title && /^https?:\/\//.test(a.url || '') && !isSport(a.title))
    .filter(a => { const k = norm(a.title); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
    .slice(0, limit)
    .map(a => ({ ...a, image: a.image && /^https:\/\//.test(a.image) ? a.image : null }));
}

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const text = url => fetch(url, { headers: UA }).then(r => (r.ok ? r.text() : '')).catch(() => '');

export default async function handler(req) {
  const params = new URL(req.url).searchParams;
  const q = (params.get('q') || '').trim().slice(0, 100);
  if (q.length < 2) return Response.json({ error: 'q manquant' }, { status: 400 });
  const lang = EDITIONS[params.get('lang')] ? params.get('lang') : 'fr';
  const query = encodeURIComponent(financeQuery(q, lang));
  const [bing, google] = await Promise.all([
    text(`https://www.bing.com/news/search?q=${query}&format=rss&${EDITIONS[lang].bing}`),
    text(`https://news.google.com/rss/search?q=${query}&${EDITIONS[lang].google}`),
  ]);
  if (!bing && !google) return Response.json({ error: 'Actualités indisponibles' }, { status: 502 });
  return Response.json(mergeArticles([parseBing(bing), parseGoogle(google)]), {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
  });
}
