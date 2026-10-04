// Moments : définitions d'affichage (fil, profil public, notifications).
// Les moments sont détectés et publiés côté serveur par sync_my_moments()
// (supabase/migrations/20261007000001_moments_auto.sql).
import { supabase } from "./supabase";

const years = n => `${n} an${n > 1 ? "s" : ""}`;
const months = m => (m % 12 === 0 ? years(m / 12) : `${m} mois`);

// text : phrase sans sujet (« fête 1 an… ») ; stat : pastille ; tag : étiquette du fil
export const MOMENTS = {
  anniversaire_1a: { tag: "Anniversaire 🎂", text: () => `fête ${years(1)} d'investissement sur Verio`, stat: () => years(1) },
  anniversaire_3a: { tag: "Anniversaire 🎂", text: () => `fête ${years(3)} d'investissement sur Verio`, stat: () => years(3) },
  anniversaire_5a: { tag: "Anniversaire 🎂", text: () => `fête ${years(5)} d'investissement sur Verio`, stat: () => years(5) },
  anniversaire_10a: { tag: "Anniversaire 🎂", text: () => `fête ${years(10)} d'investissement sur Verio`, stat: () => years(10) },
  dca_1m: { tag: "Moment 🌟", text: () => "a commencé à investir chaque mois", stat: () => "🔥 1 mois" },
  dca_3m: { tag: "Moment 🌟", text: () => `a investi ${months(3)} d'affilée`, stat: () => `🔥 ${months(3)}` },
  dca_6m: { tag: "Moment 🌟", text: () => `a investi ${months(6)} d'affilée`, stat: () => `🔥 ${months(6)}` },
  dca_1a: { tag: "Moment 🌟", text: () => `a investi chaque mois pendant ${years(1)}`, stat: () => `🔥 ${months(12)}` },
  dca_3a: { tag: "Moment 🌟", text: () => `a investi chaque mois pendant ${years(3)}`, stat: () => `🔥 ${months(36)}` },
  premier_etf: { tag: "Moment 🌟", text: () => "a acheté son premier ETF", sub: d => d.label },
  premiere_action: { tag: "Moment 🌟", text: () => "a acheté sa première action", sub: d => d.label },
  "10_positions": { tag: "Moment 🌟", text: () => "détient maintenant 10 positions", stat: () => "10 positions" },
  portfolio_complete: { tag: "Moment 🌟", text: () => "a complété son portefeuille à 100 %", stat: () => "100 % alloué" },
  // Anciens types, encore affichables s'ils existent en base
  premier_dividende: { tag: "Moment 🌟", text: () => "a reçu son premier dividende" },
  nouveau_plus_haut: { tag: "Moment 🌟", text: () => "atteint un nouveau plus haut" },
};

export const MOMENT_TYPES = Object.keys(MOMENTS);

export function isMoment(type) {
  return Object.prototype.hasOwnProperty.call(MOMENTS, type);
}

// Phrase complète : « Alice fête 1 an… » ou, sans nom, « Fête 1 an… »
export function momentSentence(type, data = {}, name = null) {
  const text = MOMENTS[type].text(data);
  return name ? `${name} ${text}` : text.charAt(0).toUpperCase() + text.slice(1);
}

// Texte de la notification envoyée à l'auteur du moment
export function momentNotification(type) {
  if (!isMoment(type)) return "Nouveau moment débloqué";
  const text = MOMENTS[type].text({});
  return `Bravo, tu ${text.replace(/^a /, "as ").replace(/^fête /, "fêtes ").replace(/^détient /, "détiens ").replace(/^atteint /, "atteins ").replace(/ son /, " ton ").replace(/ sa /, " ta ")} !`;
}

// Détecte et publie côté serveur les nouveaux moments de l'utilisateur connecté
export async function syncMoments() {
  const { data, error } = await supabase.rpc("sync_my_moments");
  return error ? [] : data || [];
}
