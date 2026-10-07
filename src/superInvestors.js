import { supabase } from "./supabase";

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
  return { ...data, following: !!follow, followers: followers ?? 0 };
}

export async function setFollowing(investorId, myId, follow) {
  const q = supabase.from("super_investor_follows");
  const { error } = follow
    ? await q.insert({ user_id: myId, investor_id: investorId })
    : await q.delete().eq("user_id", myId).eq("investor_id", investorId);
  return !error;
}

// Tous les Super Investors (Explore), avec leur profil
export async function fetchSuperInvestors() {
  const { data } = await supabase.from("super_investors").select("cik, user_id, firm, style, icon, last_period, profile:profiles(full_name, username)");
  return data || [];
}

// Super Investors que je suis (leurs mouvements arrivent dans mon fil)
export async function fetchFollowedIds(myId) {
  const { data } = await supabase.from("super_investor_follows").select("investor_id").eq("user_id", myId);
  return (data || []).map(r => r.investor_id);
}

// « 2026-06-30 » → « 2e trimestre 2026 » (ou « T2 2026 » en court)
export function quarterLabel(period, short = false) {
  if (!period) return "trimestre";
  const [y, m] = period.split("-").map(Number);
  const q = Math.ceil(m / 3);
  return short ? `T${q} ${y}` : `${q === 1 ? "1er" : `${q}e`} trimestre ${y}`;
}
