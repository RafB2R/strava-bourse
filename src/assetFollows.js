import { supabase } from "./supabase";
import { resolveAsset } from "./attachments";
import { LANG } from "./i18n";

// Sociétés et indices suivis : depuis leur fiche, à l'inscription, ou automatiquement
// pour les actions de son portefeuille. « Ne plus suivre » garde la ligne (active = false)
// pour que le suivi automatique ne la remette pas.
// Si la migration 20261020000001 n'est pas encore passée (pas de colonne active), on
// retombe sur l'ancien fonctionnement.

export async function fetchFollowedAssets(myId) {
  const q = () => supabase.from("asset_follows").select("symbol, name, type, auto").eq("user_id", myId).order("created_at");
  const { data, error } = await q().eq("active", true);
  if (!error) return data || [];
  const { data: old } = await supabase.from("asset_follows").select("symbol, name, type").eq("user_id", myId).order("created_at");
  return old || [];
}

export async function isFollowingAsset(myId, symbol) {
  const { data, error } = await supabase.from("asset_follows").select("symbol, active").eq("user_id", myId).eq("symbol", symbol).maybeSingle();
  if (error) {
    const { data: old } = await supabase.from("asset_follows").select("symbol").eq("user_id", myId).eq("symbol", symbol).maybeSingle();
    return !!old;
  }
  return !!data && data.active !== false;
}

export async function setFollowingAsset(myId, asset, follow) {
  const row = { user_id: myId, symbol: asset.symbol, name: asset.name.slice(0, 120), type: asset.type || null };
  let error;
  if (follow) {
    // Déjà connue (suivie puis arrêtée) : on la réactive ; sinon on l'ajoute
    const res = await supabase.from("asset_follows").update({ active: true }).eq("user_id", myId).eq("symbol", asset.symbol).select("symbol");
    error = res.error;
    if (!error && !res.data?.length) ({ error } = await supabase.from("asset_follows").insert(row));
  } else {
    ({ error } = await supabase.from("asset_follows").update({ active: false }).eq("user_id", myId).eq("symbol", asset.symbol));
  }
  if (error) {
    // Ancien schéma (sans colonne active) : ajout / suppression simples
    ({ error } = follow
      ? await supabase.from("asset_follows").insert({ user_id: myId, symbol: asset.symbol, name: asset.name.slice(0, 120), type: asset.type || null })
      : await supabase.from("asset_follows").delete().eq("user_id", myId).eq("symbol", asset.symbol));
  }
  if (error) console.error("Suivi société :", error.message);
  return !error;
}

// Suit automatiquement les actions détenues (une fois par valeur : une société que l'on a
// cessé de suivre n'est jamais remise). La valeur est retrouvée par son ISIN, sinon son nom.
export async function autoFollowPortfolio(myId, entries) {
  const stocks = (entries || []).filter(e => /^Action/.test(e.type || ""));
  if (!stocks.length) return 0;
  const { data: known, error } = await supabase.from("asset_follows").select("symbol, active").eq("user_id", myId);
  if (error) return 0; // migration pas encore passée
  const seen = new Set((known || []).map(k => k.symbol));
  let added = 0;
  for (const e of stocks) {
    const asset = await resolveAsset({ isin: e.isin, label: e.label }).catch(() => null);
    if (!asset?.symbol || seen.has(asset.symbol) || asset.type !== "Action") continue;
    seen.add(asset.symbol);
    const { error: err } = await supabase.from("asset_follows").insert({ user_id: myId, symbol: asset.symbol, name: (asset.name || e.label).slice(0, 120), type: "Action", auto: true });
    if (!err) added++;
  }
  return added;
}

// Nom à chercher dans la presse : « TotalEnergies SE » → « TotalEnergies »
export function newsName(name) {
  return name.replace(/[,.]?\s+(SE|SA|S\.A\.|Inc\.?|Corp\.?|Corporation|Co\.?|Ltd\.?|PLC|N\.V\.|NV|AG|Group|Holdings?|Company)\.?$/i, "").trim() || name;
}

// Quelques actualités des sociétés suivies, pour le fil : au plus un article récent
// (3 derniers jours) par société, les plus récents d'abord (le fil en garde quelques-uns)
// Options (onglet « Mes valeurs ») : plus d'articles par société, sur plus de jours
export async function fetchCompanyNews(myId, { perAsset = 1, days = 3, assets = null } = {}) {
  const list = assets || await fetchFollowedAssets(myId);
  const since = Date.now() - days * 86400e3;
  const picks = await Promise.all(list.map(async asset => {
    const articles = await fetch(`/api/news?q=${encodeURIComponent(`"${newsName(asset.name)}"`)}&lang=${LANG}`).then(r => r.json()).catch(() => []);
    return (Array.isArray(articles) ? articles : [])
      .filter(a => a.date && new Date(a.date).getTime() > since)
      .slice(0, perAsset)
      .map(article => ({ kind: "news", id: article.url, created_at: article.date, article, company: asset }));
  }));
  return picks.flat();
}
