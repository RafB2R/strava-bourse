import { supabase } from "./supabase";
import { buildMovesHistory, extendCurve, MOVE_TYPES } from "./history";

// Courbe de performance publique (base 100). Le propriétaire la calcule avec ses mouvements
// et ses dates d'achat (privées) et n'en publie que les points ; les visiteurs la lisent et
// la prolongent jusqu'au jour même. Table performance_curves (20261025000001).

function fetchMoves(userId) {
  return supabase.from("activities").select("type, data, created_at").eq("user_id", userId).in("type", MOVE_TYPES).order("created_at")
    .then(({ data }) => data || []);
}

// Mon portefeuille (positions privées, dates d'achat comprises) → courbe publiée
export async function publishMyCurve(userId, entries) {
  const history = await buildMovesHistory(await fetchMoves(userId), entries);
  if (!history?.points?.length) return null;
  const points = history.points.map(p => [p.day, Math.round(p.perf * 100) / 100]);
  await supabase.from("performance_curves").upsert({ user_id: userId, points, updated_at: new Date().toISOString() });
  return history;
}

// Profil d'un membre : sa courbe publiée prolongée jusqu'à aujourd'hui ; à défaut (pas encore
// publiée, migration pas passée), rejouée à partir de ses mouvements publics seulement
export async function fetchPublicCurve(userId, entries) {
  const { data, error } = await supabase.from("performance_curves").select("points").eq("user_id", userId).maybeSingle();
  if (!error && data?.points?.length) {
    const points = await extendCurve(data.points.map(([day, perf]) => ({ day, perf, value: null })), entries);
    return { points, coverage: 100 };
  }
  return buildMovesHistory(await fetchMoves(userId), entries);
}
