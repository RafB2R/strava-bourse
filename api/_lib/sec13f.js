// Lecture des déclarations 13F sur EDGAR (SEC), partagée par /api/superinvestors
// (fiche à la demande) et /api/superinvestors-sync (tâche quotidienne).
// Fichier dans api/_lib : pas une route, Vercel ne le publie pas.

// La SEC demande un User-Agent qui identifie l'application et un contact
const USER_AGENT = (typeof process !== 'undefined' && process.env?.SEC_USER_AGENT) || 'Verio app (contact via verio)';

export async function sec(url, as = 'json') {
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
// Abréviations des déclarations SEC (« BANK AMER CORP », « ALLY FINL INC »…)
const ABBREV = {
  amer: 'america', finl: 'financial', pete: 'petroleum', hldgs: 'holdings', hldg: 'holding', intl: 'international',
  grp: 'group', svcs: 'services', svc: 'service', sys: 'systems', mgmt: 'management', entmt: 'entertainment',
  pptys: 'properties', rlty: 'realty', invt: 'investment', mtrs: 'motors', commun: 'communications', ins: 'insurance',
  pharm: 'pharmaceuticals', natl: 'national', bancorporation: 'bancorporation', tr: 'trust', engy: 'energy', res: 'resources',
};
// Sigles gardés en majuscules
const ACRONYMS = new Set(['cme', 'ibm', 'hp', 'ups', 'ge', 'bp', 'hca', 'ttm', 'nvr', 'aon', 'ptc', 'cbre', 'csx', 'tjx', 'msci', 'rh', 'amc', 'axp', 'usa', 'us', 'uk']);
// Mentions juridiques ou de catégorie d'actions en fin de nom (« DEL » = Delaware, « NEW », « CL A »…)
const TRAILING = /\s+(del|new|com|cl [a-z]|class [a-z]|ser [a-z]|mtn be|sponsored adr|adr|ord|shs)$/i;
export function prettyName(name) {
  let raw = decode(name).toLowerCase().replace(/\s+/g, ' ').trim();
  while (TRAILING.test(raw)) raw = raw.replace(TRAILING, '');
  raw = raw.replace(/^bank amer\b/, 'bank of america').replace(/^moodys\b/, "moody's").replace(/^(\w+) com inc$/, '$1.com inc');
  return raw.split(' ').map(w => ABBREV[w] || w).map((w, i) => {
    if (ACRONYMS.has(w)) return w.toUpperCase();
    if (i > 0 && SMALL.has(w)) return w;
    if (/^(inc|corp|co|ltd|plc|sa|nv|ag|se|llc|lp)\.?$/.test(w)) return w[0].toUpperCase() + w.slice(1);
    return w.replace(/(^|[-/&(])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
  }).join(' ');
}

// Positions regroupées par société : une même action peut figurer sur plusieurs lignes,
// et une société peut avoir plusieurs catégories d'actions (Alphabet A et C).
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
    const name = prettyName(tag(b, 'nameOfIssuer') || cusip);
    const key = name.toLowerCase();
    const cur = byCusip.get(key) || { name, cusip, cusips: [], value: 0, shares: 0 };
    if (!cur.cusips.includes(cusip)) cur.cusips.push(cusip);
    cur.value += value;
    cur.shares += Number.isFinite(shares) ? shares : 0;
    byCusip.set(key, cur);
  }
  const list = [...byCusip.values()];
  const total = list.reduce((s, p) => s + p.value, 0);
  const positions = list
    .map(p => ({ name: p.name, cusip: p.cusip, cusips: p.cusips, shares: p.shares, pct: total ? (p.value / total) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct);
  return { positions, options };
}

export const round = n => Math.round(n * 10) / 10;

// Mouvements du trimestre : sens donné par le nombre d'actions (pas par le %, qui
// bouge aussi avec les cours), puis % du portefeuille avant → après
export function compare(current, previous) {
  // Même société d'un trimestre à l'autre : un CUSIP en commun (la SEC peut changer
  // le nom, « BANK AMER CORP » → « BANK OF AMERICA CORP »), sinon le même nom
  const prev = new Set(previous);
  const find = p => [...prev].find(q => (q.cusips || [q.cusip]).some(c => (p.cusips || [p.cusip]).includes(c)))
    || [...prev].find(q => q.name.toLowerCase() === p.name.toLowerCase());
  const moves = [];
  for (const p of current) {
    const before = find(p);
    if (!before) { moves.push({ type: 'new', name: p.name, cusip: p.cusip, before: 0, after: round(p.pct) }); continue; }
    prev.delete(before);
    const delta = before.shares ? (p.shares - before.shares) / before.shares : 0;
    if (Math.abs(delta) < 0.01) continue; // moins de 1 % d'actions en plus ou en moins : inchangé
    moves.push({ type: delta > 0 ? 'up' : 'down', name: p.name, cusip: p.cusip, before: round(before.pct), after: round(p.pct), sharesChange: Math.round(delta * 100) });
  }
  for (const p of prev.values()) moves.push({ type: 'sold', name: p.name, cusip: p.cusip, before: round(p.pct), after: 0 });
  const order = { new: 0, up: 1, down: 2, sold: 3 };
  return moves.sort((a, b) => order[a.type] - order[b.type] || Math.max(b.before, b.after) - Math.max(a.before, a.after));
}

export async function filingPositions(cik, filing) {
  const folder = `https://www.sec.gov/Archives/edgar/data/${cik}/${filing.accession.replace(/-/g, '')}`;
  const name = infoTableName(await sec(`${folder}/index.json`));
  if (!name) throw new Error('table des positions introuvable');
  return parseInfoTable(await sec(`${folder}/${name}`, 'text'));
}
