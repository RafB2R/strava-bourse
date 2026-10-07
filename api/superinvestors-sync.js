// Tâche quotidienne (Vercel Cron, voir vercel.json) : met à jour les profils des
// Super Investors d'après leur dernière déclaration 13F à la SEC.
//
// Pour chaque Super Investor dont un nouveau trimestre a été déclaré :
//   1. son portefeuille (portfolio_entries) est remplacé par les nouvelles positions, en % ;
//   2. une activité « declaration_13f » est publiée (mouvements du trimestre, en %),
//      datée du jour du dépôt : elle apparaît dans le fil de ses abonnés ;
//   3. ses abonnés reçoivent une notification.
// Rien ne change tant qu'aucune nouvelle déclaration n'est déposée.
//
// Appel : Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> ». Pour la
// première mise à jour à la main : /api/superinvestors-sync?secret=<CRON_SECRET>
//
// Variables d'environnement Vercel :
//   CRON_SECRET                secret de la tâche (choisi librement)
//   SUPABASE_SERVICE_ROLE_KEY  clé « service_role » de Supabase (déjà utilisée par /api/push)
//   SEC_USER_AGENT             « Verio contact@… » : la SEC demande un contact
import { timingSafeEqual } from 'node:crypto';
import { sec, lastFilings, filingPositions, compare, round } from './_lib/sec13f.js';

export const config = { maxDuration: 60 };

const SUPABASE_URL = 'https://ehnbllptqqhdufucfyeb.supabase.co';
const MAX_MOVES = 80;

function sameSecret(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

async function db(path, init = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status} ${path.split('?')[0]} : ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// Mouvement 13F → même forme que les mouvements des membres (label, avant, apres, variation)
const toMove = m => ({
  type: m.type,
  label: m.name,
  avant: m.before,
  apres: m.after,
  ...(m.sharesChange != null ? { variation: m.sharesChange } : {}),
});

export async function syncInvestor(investor, { force = false } = {}) {
  const submissions = await sec(`https://data.sec.gov/submissions/CIK${String(investor.cik).padStart(10, '0')}.json`);
  const [last, previous] = lastFilings(submissions);
  if (!last) return { cik: investor.cik, status: 'aucune déclaration' };
  const isNew = investor.last_period !== last.period;
  if (!isNew && !force) return { cik: investor.cik, status: 'à jour', period: last.period };

  const now = await filingPositions(investor.cik, last);
  const before = previous ? await filingPositions(investor.cik, previous).catch(() => null) : null;
  const moves = before ? compare(now.positions, before.positions) : [];
  const userId = investor.user_id;

  // 1. Portefeuille : positions de la nouvelle déclaration, en %
  await db(`portfolio_entries?user_id=eq.${userId}`, { method: 'DELETE' });
  const rows = now.positions.filter(p => p.pct >= 0.05).map(p => ({
    user_id: userId, label: p.name, type: 'Action', exposition: 'Actions', percentage: round(p.pct), broker: null,
  }));
  if (rows.length) await db('portfolio_entries', { method: 'POST', body: JSON.stringify(rows), headers: { Prefer: 'return=minimal' } });

  // Forcée sur un trimestre déjà lu : portefeuille rafraîchi, rien de republié
  if (!isNew) return { cik: investor.cik, status: 'portefeuille rafraîchi', period: last.period, positions: rows.length };

  // 2. Activité du trimestre (une seule carte dans le fil, avec tous les mouvements)
  const [activity] = await db('activities', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      type: 'declaration_13f',
      created_at: `${last.filed}T12:00:00Z`,
      data: {
        source: 'sec13f',
        period: last.period,
        filed: last.filed,
        previous_period: before ? previous.period : null,
        positions: now.positions.length,
        moves_total: moves.length,
        moves: moves.slice(0, MAX_MOVES).map(toMove),
      },
    }),
  });

  // 3. Notification des abonnés
  const followers = await db(`super_investor_follows?investor_id=eq.${userId}&select=user_id`, { headers: { Prefer: '' } });
  if (followers.length) {
    await db('notifications', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(followers.map(f => ({
        user_id: f.user_id,
        type: 'super_filing',
        data: { investor_id: userId, name: investor.name, activity_id: activity?.id, moves: moves.length, period: last.period },
      }))),
    });
  }

  await db(`super_investors?cik=eq.${investor.cik}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ last_period: last.period, last_filed: last.filed, synced_at: new Date().toISOString() }),
  });
  return { cik: investor.cik, status: 'mis à jour', period: last.period, positions: rows.length, moves: moves.length, followers: followers.length };
}

export default async function handler(req, res) {
  const { CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!CRON_SECRET || !SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: 'CRON_SECRET ou SUPABASE_SERVICE_ROLE_KEY manquant' });
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!sameSecret(bearer, CRON_SECRET) && !sameSecret(req.query?.secret, CRON_SECRET)) return res.status(401).json({ error: 'non autorisé' });

  let investors;
  try {
    // Lien explicite vers profiles : super_investor_follows relie aussi les deux tables
    investors = await db('super_investors?select=cik,user_id,last_period,profile:profiles!super_investors_user_id_fkey(full_name)', { headers: { Prefer: '' } });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
  const results = [];
  // L'un après l'autre : la SEC limite le nombre de requêtes par seconde
  for (const inv of investors) {
    try {
      results.push(await syncInvestor({ ...inv, name: inv.profile?.full_name }, { force: req.query?.force === '1' }));
    } catch (e) {
      results.push({ cik: inv.cik, status: 'erreur', error: String(e.message || e) });
    }
  }
  res.status(200).json({ results });
}
