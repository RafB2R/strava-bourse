// Envoi des notifications push (Node.js, pas Edge : la bibliothèque web-push
// a besoin du module crypto de Node).
//
// Appelé uniquement par la base Supabase (fonction verio_send_push, via pg_net),
// avec le secret partagé dans l'en-tête x-verio-secret :
//   POST /api/push  { user_id, title, body, url, tag }
// → envoie la notification à tous les appareils abonnés du membre, et oublie
//   ceux qui ne sont plus valides (application désinstallée, permission retirée).
//
// Variables d'environnement Vercel :
//   VAPID_PRIVATE_KEY          clé privée associée à VAPID_PUBLIC_KEY ci-dessous
//   PUSH_WEBHOOK_SECRET        même valeur que push_secret dans verio_private.settings
//   SUPABASE_SERVICE_ROLE_KEY  clé « service_role » de Supabase (lecture des appareils)
import webpush from 'web-push';
import { timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = 'https://ehnbllptqqhdufucfyeb.supabase.co';
// Clé publique : la même que dans src/push.js (elle n'a rien de secret)
export const VAPID_PUBLIC_KEY = 'BDwFtRF-NhQFspShPQpzHrry6wLC4PmHdVLEL90rbv8udXd_h1ey1kra8Ss48rbQb2zj8w5VnBGzfSGlhf314GA';
const VAPID_SUBJECT = 'https://strava-bourse.vercel.app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sameSecret(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

async function supabaseRest(path, init = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  const { VAPID_PRIVATE_KEY, PUSH_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!VAPID_PRIVATE_KEY || !PUSH_WEBHOOK_SECRET || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'Notifications push non configurées' });
  }
  if (!sameSecret(req.headers['x-verio-secret'], PUSH_WEBHOOK_SECRET)) return res.status(401).json({ error: 'Non autorisé' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const { user_id: userId, title, body: text, url, tag } = body || {};
  if (!UUID.test(String(userId || '')) || !title) return res.status(400).json({ error: 'Requête invalide' });

  const r = await supabaseRest(`push_subscriptions?user_id=eq.${userId}&select=id,endpoint,p256dh,auth`);
  if (!r.ok) return res.status(502).json({ error: `Supabase : HTTP ${r.status}` });
  const subscriptions = await r.json();

  const payload = JSON.stringify({
    title: String(title).slice(0, 80),
    body: String(text || '').slice(0, 180),
    url: typeof url === 'string' && url.startsWith('/') ? url : '/',
    tag: tag ? String(tag).slice(0, 80) : undefined,
  });
  const options = { TTL: 24 * 3600, urgency: 'normal', vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY } };

  let sent = 0;
  const expired = [];
  await Promise.all(subscriptions.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, options);
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) expired.push(s.id);
    }
  }));
  if (expired.length) await supabaseRest(`push_subscriptions?id=in.(${expired.join(',')})`, { method: 'DELETE' });

  return res.status(200).json({ sent, removed: expired.length });
}
