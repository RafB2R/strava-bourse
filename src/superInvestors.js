import { supabase } from "./supabase";
import { t, LANG } from "./i18n";

// Super Investors : profils alimentés par leurs déclarations 13F à la SEC
// (voir api/superinvestors-sync.js). On les suit par un abonnement, sans demande d'ami.

// Fiche Super Investor d'un profil (null pour un membre)
export async function fetchSuperInvestor(userId, myId) {
  const { data } = await supabase.from("super_investors").select("cik, user_id, firm, style, icon, last_period, last_filed").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  const [{ data: follow }, { data: followers }] = await Promise.all([
    supabase.from("super_investor_follows").select("investor_id").eq("user_id", myId).eq("investor_id", userId).maybeSingle(),
    supabase.rpc("super_investor_followers", { investor: userId }),
  ]);
  return { ...data, following: !!follow, followers: Math.max(0, followers ?? 0) };
}

export async function setFollowing(investorId, myId, follow) {
  const q = supabase.from("super_investor_follows");
  const { error } = follow
    ? await q.insert({ user_id: myId, investor_id: investorId })
    : await q.delete().eq("user_id", myId).eq("investor_id", investorId);
  if (error) console.error("Abonnement Super Investor :", error.message);
  return !error;
}

// Tous les Super Investors (Explore), avec leur profil
export async function fetchSuperInvestors() {
  const { data } = await supabase.from("super_investors").select("cik, user_id, firm, style, icon, last_period, profile:profiles!super_investors_user_id_fkey(full_name, username)");
  return data || [];
}

// Super Investors que je suis (leurs mouvements arrivent dans mon fil)
export async function fetchFollowedIds(myId) {
  const { data } = await supabase.from("super_investor_follows").select("investor_id").eq("user_id", myId);
  return (data || []).map(r => r.investor_id);
}

// Quelques actualités des Super Investors que je suis, pour le fil : au plus un
// article récent (3 derniers jours) par investisseur, et 3 au total, les plus récents.
const NEWS_DAYS = 3, NEWS_MAX = 3;
// « knownIds » : Légendes suivies déjà connues (évite de les redemander)
export async function fetchFollowedNews(myId, knownIds = null) {
  const ids = knownIds || await fetchFollowedIds(myId);
  if (!ids.length) return [];
  const { data } = await supabase.from("super_investors")
    .select("user_id, firm, icon, profile:profiles!super_investors_user_id_fkey(full_name)").in("user_id", ids);
  const since = Date.now() - NEWS_DAYS * 86400e3;
  const seen = new Set();
  const picks = await Promise.all((data || []).map(async inv => {
    const name = inv.profile?.full_name;
    if (!name) return null;
    const articles = await fetch(`/api/news?q=${encodeURIComponent(`"${name}" OR "${inv.firm}"`)}&lang=${LANG}`).then(r => r.json()).catch(() => []);
    const article = (Array.isArray(articles) ? articles : []).find(a => a.date && new Date(a.date).getTime() > since);
    return article ? { kind: "news", id: article.url, created_at: article.date, article, investor: { id: inv.user_id, name, icon: inv.icon } } : null;
  }));
  return picks
    .filter(p => p && !seen.has(p.article.title) && seen.add(p.article.title))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, NEWS_MAX);
}

// « 2026-06-30 » → « 2e trimestre 2026 » (ou « T2 2026 » en court)
export function quarterLabel(period, short = false) {
  if (!period) return t("trimestre");
  const [y, m] = period.split("-").map(Number);
  const q = Math.ceil(m / 3);
  if (short) return t("T{q} {y}", { q, y });
  return q === 1 ? t("1er trimestre {y}", { y }) : t("{q}e trimestre {y}", { q, y });
}
