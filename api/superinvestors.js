export const config = { runtime: 'edge' };

// Portefeuilles des « Super Investors » d'après leurs déclarations 13F à la SEC
// (EDGAR, données publiques). Chaque trimestre, les gérants de plus de 100 M$
// déclarent leurs positions en actions cotées aux États-Unis, au plus tard 45 jours
// après la fin du trimestre.
// Mise à jour automatique : on relit toujours la dernière déclaration déposée ;
// la réponse est gardée 12 h en cache par Vercel, donc une nouvelle déclaration
// apparaît au plus tard 12 h après son dépôt.
// Fidèle à Verio : uniquement des % du portefeuille, jamais de montants.
//
// GET /api/superinvestors?cik=1067983 →
//   { cik, filer, period, filed, previousPeriod, positions: [{ name, cusip, pct, shares }],
//     options, moves: [{ type: "new" | "up" | "down" | "sold", name, cusip, before, after }] }

// La SEC demande un User-Agent qui identifie l'application et un contact
const USER_AGENT = (typeof process !== 'undefined' && process.env?.SEC_USER_AGENT) || 'Verio app (contact via verio)';

async function sec(url, as = 'json') {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: as === 'json' ? 'application/json' : 'application/xml,text/xml' } });
  if (!res.ok) throw new Error(`SEC ${res.status} ${url}`);
  return as === 'json' ? res.json() : res.text();
}

// Les deux dernières déclarations 13F-HR (les rectificatifs 13F-HR/A sont ignorés)
export function lastFilings(submissions, count = 2) {
  const r = submissions?.filings?.recent || {};
  const out = [];
  for (let i = 0; i < (r.form || []).length && out.length < count; i++) {
    if (r.form[i] !== '13F-HR') continue;
    out.push({ accession: r.accessionNumber[i], filed: r.filingDate[i], period: r.reportDate[i] });
  }
  return out;
}

// Dans le dossier de la déclaration, la table des positions est le fichier .xml
// qui n'est pas « primary_doc.xml » (son nom varie : infotable.xml, 50240.xml…)
export function infoTableName(index) {
  const items = index?.directory?.item || [];
  const xml = items.filter(it => /\.xml$/i.test(it.name) && !/primary_doc/i.test(it.name));
  return xml.find(it => /info/i.test(it.name))?.name || xml[0]?.name || null;
}

const tag = (block, name) => {
  const m = block.match(new RegExp(`<(?:\\w+:)?${name}>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i'));
  return m ? m[1].trim() : null;
};
const decode = s => s.replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// « APPLE INC » → « Apple Inc » (les déclarations sont en majuscules)
const SMALL = new Set(['of', 'and', 'the', 'de', 'du']);
export function prettyName(name) {
  return decode(name).toLowerCase().replace(/\s+/g, ' ').split(' ').map((w, i) => {
    if (i > 0 && SMALL.has(w)) return w;
    if (/^(inc|corp|co|ltd|plc|sa|nv|ag|se|llc|lp)\.?$/.test(w)) return w[0].toUpperCase() + w.slice(1);
    return w.replace(/(^|[-/&(])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
  }).join(' ');
}

// Positions regroupées par CUSIP (une même action peut figurer sur plusieurs lignes).
// Les options (put / call) sont comptées à part : leur « valeur » est celle du sous-jacent.
export function parseInfoTable(xml) {
  const byCusip = new Map();
  let options = 0;
  const blocks = xml.match(/<(?:\w+:)?infoTable>[\s\S]*?<\/(?:\w+:)?infoTable>/gi) || [];
  for (const b of blocks) {
    const cusip = tag(b, 'cusip');
    const value = Number(tag(b, 'value'));
    const shares = Number(tag(b, 'sshPrnamt'));
    if (!cusip || !Number.isFinite(value)) continue;
    if (tag(b, 'putCall')) { options++; continue; }
    const cur = byCusip.get(cusip) || { name: prettyName(tag(b, 'nameOfIssuer') || cusip), cusip, value: 0, shares: 0 };
    cur.value += value;
    cur.shares += Number.isFinite(shares) ? shares : 0;
    byCusip.set(cusip, cur);
  }
  const list = [...byCusip.values()];
  const total = list.reduce((s, p) => s + p.value, 0);
  const positions = list
    .map(p => ({ name: p.name, cusip: p.cusip, shares: p.shares, pct: total ? (p.value / total) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct);
  return { positions, options };
}

const round = n => Math.round(n * 10) / 10;

// Mouvements du trimestre : sens donné par le nombre d'actions (pas par le %, qui
// bouge aussi avec les cours), puis % du portefeuille avant → après
export function compare(current, previous) {
  const prev = new Map(previous.map(p => [p.cusip, p]));
  const moves = [];
  for (const p of current) {
    const before = prev.get(p.cusip);
    if (!before) { moves.push({ type: 'new', name: p.name, cusip: p.cusip, before: 0, after: round(p.pct) }); continue; }
    prev.delete(p.cusip);
    const delta = before.shares ? (p.shares - before.shares) / before.shares : 0;
    if (Math.abs(delta) < 0.01) continue; // moins de 1 % d'actions en plus ou en moins : inchangé
    moves.push({ type: delta > 0 ? 'up' : 'down', name: p.name, cusip: p.cusip, before: round(before.pct), after: round(p.pct), sharesChange: Math.round(delta * 100) });
  }
  for (const p of prev.values()) moves.push({ type: 'sold', name: p.name, cusip: p.cusip, before: round(p.pct), after: 0 });
  const order = { new: 0, up: 1, down: 2, sold: 3 };
  return moves.sort((a, b) => order[a.type] - order[b.type] || Math.max(b.before, b.after) - Math.max(a.before, a.after));
}

async function filingPositions(cik, filing) {
  const folder = `https://www.sec.gov/Archives/edgar/data/${cik}/${filing.accession.replace(/-/g, '')}`;
  const name = infoTableName(await sec(`${folder}/index.json`));
  if (!name) throw new Error('table des positions introuvable');
  return parseInfoTable(await sec(`${folder}/${name}`, 'text'));
}

export default async function handler(req) {
  const cik = new URL(req.url).searchParams.get('cik');
  if (!/^\d{1,10}$/.test(cik || '')) return Response.json({ error: 'cik manquant' }, { status: 400 });
  try {
    const submissions = await sec(`https://data.sec.gov/submissions/CIK${cik.padStart(10, '0')}.json`);
    const [last, previous] = lastFilings(submissions);
    if (!last) return Response.json({ error: 'aucune déclaration 13F' }, { status: 404 });
    const n = Number(cik);
    const [now, before] = await Promise.all([filingPositions(n, last), previous ? filingPositions(n, previous).catch(() => null) : null]);
    return Response.json({
      cik: n,
      filer: submissions.name,
      period: last.period,
      filed: last.filed,
      previousPeriod: before ? previous.period : null,
      // Plus de 7 mois sans déclaration : le gérant a sans doute cessé de déclarer
      stale: Date.now() - new Date(last.filed).getTime() > 210 * 86400e3,
      positions: now.positions.map(p => ({ ...p, pct: round(p.pct) })),
      options: now.options,
      moves: before ? compare(now.positions, before.positions) : [],
    }, { headers: { 'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400' } });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
