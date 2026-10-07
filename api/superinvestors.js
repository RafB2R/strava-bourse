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

import { sec, lastFilings, filingPositions, compare, round } from './_lib/sec13f.js';

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
