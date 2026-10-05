// Sondages des posts (supabase/migrations/20261010000002_sondages_fichiers.sql)
// Votes anonymes : on ne lit que son propre vote et les totaux par option.
import { supabase } from "./supabase";

export const POLL_MAX_OPTIONS = 4;
export const POLL_OPTION_MAX_LENGTH = 60;
export const POLL_DURATIONS = [
  { days: 1, label: "1 jour" },
  { days: 3, label: "3 jours" },
  { days: 7, label: "1 semaine" },
];

export function makePoll(options, days) {
  return {
    options: options.map(o => o.trim()).filter(Boolean).slice(0, POLL_MAX_OPTIONS),
    ends_at: new Date(Date.now() + days * 86400000).toISOString(),
  };
}

export function isValidPoll(poll) {
  return Array.isArray(poll?.options) && poll.options.length >= 2 && poll.options.length <= POLL_MAX_OPTIONS;
}

// { counts: { [activityId]: [votes par option] }, mine: { [activityId]: option } }
export async function fetchPolls(activityIds, userId) {
  const counts = {}, mine = {};
  if (activityIds.length === 0) return { counts, mine };
  const [{ data: countRows }, { data: voteRows }] = await Promise.all([
    supabase.from("poll_counts").select("activity_id, option, votes").in("activity_id", activityIds),
    supabase.from("poll_votes").select("activity_id, option").eq("user_id", userId).in("activity_id", activityIds),
  ]);
  for (const r of countRows || []) (counts[r.activity_id] ||= [])[r.option] = r.votes;
  for (const r of voteRows || []) mine[r.activity_id] = r.option;
  return { counts, mine };
}

export async function vote(activityId, option) {
  const { error } = await supabase.from("poll_votes").insert({ activity_id: activityId, option });
  return { error };
}

// « 2 j restants », « 5 h restantes », « Terminé »
export function pollRemaining(endsAt) {
  const ms = new Date(endsAt) - Date.now();
  if (!(ms > 0)) return "Terminé";
  const h = ms / 3600000;
  if (h >= 24) { const d = Math.round(h / 24); return `${d} j restant${d > 1 ? "s" : ""}`; }
  if (h >= 1) return `${Math.floor(h)} h restante${h >= 2 ? "s" : ""}`;
  return `${Math.max(1, Math.floor(ms / 60000))} min restantes`;
}

// Clôt les sondages terminés et prévient l'auteur et les participants (une seule fois par sondage).
// Sans pg_cron côté Supabase, c'est l'ouverture de l'application qui déclenche la clôture.
export async function closeFinishedPolls() {
  try { await supabase.rpc("close_finished_polls"); } catch { /* sans incidence pour l'affichage */ }
}

// Texte de la notification « poll_ended »
export function pollEndedText(d) {
  const q = d.question ? `« ${d.question} »` : "";
  const who = d.mine ? `Ton sondage ${q}` : `Le sondage de ${d.author_name || "ton ami"} ${q}`;
  const winners = Array.isArray(d.winners) ? d.winners : [];
  if (!d.total) return `${who} est terminé, sans aucun vote.`;
  if (winners.length > 1) return `${who} est terminé : égalité entre ${winners.map(w => `« ${w} »`).join(" et ")} (${d.winner_pct} % chacun).`;
  return `${who} est terminé : « ${winners[0]} » l'emporte avec ${d.winner_pct} % (${d.total} vote${d.total > 1 ? "s" : ""}).`;
}
