// Session Yahoo (cookie + « crumb ») pour les API qui l'exigent depuis un serveur.
// Fichier dans api/_lib : pas une route, Vercel ne le publie pas.

export const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };

export async function yahooSession() {
  const home = await fetch('https://fc.yahoo.com', { headers: UA, redirect: 'manual' });
  const raw = home.headers.get('set-cookie') || '';
  const cookie = raw.split(/,(?=\s*[A-Za-z0-9_]+=)/).map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
  if (!cookie) throw new Error('cookie Yahoo absent');
  const res = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { ...UA, cookie } });
  const crumb = (await res.text()).trim();
  if (!res.ok || !crumb || crumb.length > 40 || /\s|</.test(crumb)) throw new Error(`crumb Yahoo : HTTP ${res.status}`);
  return { cookie, crumb };
}
