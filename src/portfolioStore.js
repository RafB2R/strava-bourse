import { supabase } from "./supabase";

// Accès aux positions du portefeuille : tout ce qui lit ou écrit portfolio_entries passe ici.
// Deux origines (colonne « source ») :
//  - « manual » : saisie dans Verio, modifiable à la main ;
//  - « powens » : importée de la banque par le serveur (api/, clé service_role), mise à
//    jour à chaque synchronisation. Dans l'appli, seul son poids peut être recalculé ;
//    la base refuse le reste (voir 20261023000001_preparation_powens.sql).

export const isSynced = entry => entry?.source === "powens";

// Mes positions, montants compris (lisibles par moi seul)
export async function fetchMyEntries() {
  const { data } = await supabase.rpc("get_my_portfolio_entries");
  return data || [];
}

// Poids de plusieurs positions [{ id, percentage }] en un seul appel. Si la fonction
// n'existe pas encore en base (migration pas passée), une requête par position.
export async function saveWeights(rows) {
  if (!rows.length) return;
  const { error } = await supabase.rpc("set_my_portfolio_weights", { weights: rows.map(r => ({ id: r.id, percentage: r.percentage })) });
  if (!error) return;
  await Promise.all(rows.map(r => supabase.from("portfolio_entries").update({ percentage: r.percentage }).eq("id", r.id)));
}

// Cours actuel d'une position saisie à la main (celles de la banque se mettent à jour seules)
export function savePrice(id, prix, performance) {
  return supabase.from("portfolio_entries").update({ prix_actuel: prix, performance }).eq("id", id);
}

// Nouvelle position saisie à la main. Profil manquant (clé étrangère, inscription ratée) :
// on le crée puis on réessaie une fois.
export async function insertEntry(row) {
  let { error } = await supabase.from("portfolio_entries").insert(row);
  if (error?.code === "23503" && !(await supabase.rpc("ensure_my_profile")).error) ({ error } = await supabase.from("portfolio_entries").insert(row));
  return { error };
}

export function updateEntry(id, fields) {
  return supabase.from("portfolio_entries").update(fields).eq("id", id);
}

export function deleteEntry(id) {
  return supabase.from("portfolio_entries").delete().eq("id", id);
}
