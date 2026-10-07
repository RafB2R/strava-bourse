import { supabase } from "./supabase";

// Sociétés suivies (depuis leur fiche) : leurs actualités arrivent dans le fil.

export async function fetchFollowedAssets(myId) {
  const { data } = await supabase.from("asset_follows").select("symbol, name, type").eq("user_id", myId).order("created_at");
  return data || [];
}

export async function isFollowingAsset(myId, symbol) {
  const { data } = await supabase.from("asset_follows").select("symbol").eq("user_id", myId).eq("symbol", symbol).maybeSingle();
  return !!data;
}

export async function setFollowingAsset(myId, asset, follow) {
  const q = supabase.from("asset_follows");
  const { error } = follow
    ? await q.insert({ user_id: myId, symbol: asset.symbol, name: asset.name.slice(0, 120), type: asset.type || null })
    : await q.delete().eq("user_id", myId).eq("symbol", asset.symbol);
  if (error) console.error("Suivi société :", error.message);
  return !error;
}

// Nom à chercher dans la presse : « TotalEnergies SE » → « TotalEnergies »
export function newsName(name) {
  return name.replace(/[,.]?\s+(SE|SA|S\.A\.|Inc\.?|Corp\.?|Corporation|Co\.?|Ltd\.?|PLC|N\.V\.|NV|AG|Group|Holdings?|Company)\.?$/i, "").trim() || name;
}

// Quelques actualités des sociétés suivies, pour le fil : au plus un article récent
// (3 derniers jours) par société, les plus récents d'abord (le fil en garde quelques-uns)
export async function fetchCompanyNews(myId) {
  const assets = await fetchFollowedAssets(myId);
  const since = Date.now() - 3 * 86400e3;
  const picks = await Promise.all(assets.map(async asset => {
    const articles = await fetch(`/api/news?q=${encodeURIComponent(`"${newsName(asset.name)}"`)}`).then(r => r.json()).catch(() => []);
    const article = (Array.isArray(articles) ? articles : []).find(a => a.date && new Date(a.date).getTime() > since);
    return article ? { kind: "news", id: article.url, created_at: article.date, article, company: asset } : null;
  }));
  return picks.filter(Boolean);
}
