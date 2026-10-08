// Moments : définitions d'affichage (fil, profil public, notifications).
// Les moments sont détectés et publiés côté serveur par sync_my_moments()
// (supabase/migrations/20261007000001_moments_auto.sql).
import { supabase } from "./supabase";
import { t } from "./i18n";

const years = n => (n > 1 ? t("{n} ans", { n }) : t("{n} an", { n }));

const ANNIV = t("Anniversaire 🎂"), MOMENT = t("Moment 🌟");
const anniversary = n => ({
  tag: ANNIV,
  text: () => t("fête {d} d'investissement sur Verio", { d: years(n) }),
  you: () => t("fêtes {d} d'investissement sur Verio", { d: years(n) }),
  stat: () => years(n),
});
// Séries de moins d'un an (3 et 6 mois)
const streak = m => ({
  tag: MOMENT,
  text: () => t("a investi {n} mois d'affilée", { n: m }),
  you: () => t("as investi {n} mois d'affilée", { n: m }),
  stat: () => t("🔥 {n} mois", { n: m }),
});
const everyMonth = n => ({
  tag: MOMENT,
  text: () => t("a investi chaque mois pendant {d}", { d: years(n) }),
  you: () => t("as investi chaque mois pendant {d}", { d: years(n) }),
  stat: () => `🔥 ${years(n)}`,
});

// text : phrase sans sujet (« fête 1 an… ») ; you : la même à la 2e personne (notification) ;
// stat : pastille ; tag : étiquette du fil
export const MOMENTS = {
  anniversaire_1a: anniversary(1),
  anniversaire_3a: anniversary(3),
  anniversaire_5a: anniversary(5),
  anniversaire_10a: anniversary(10),
  dca_1m: { tag: MOMENT, text: () => t("a commencé à investir chaque mois"), you: () => t("as commencé à investir chaque mois"), stat: () => t("🔥 1 mois") },
  dca_3m: streak(3),
  dca_6m: streak(6),
  dca_1a: everyMonth(1),
  dca_3a: everyMonth(3),
  premier_etf: { tag: MOMENT, text: () => t("a acheté son premier ETF"), you: () => t("as acheté ton premier ETF"), sub: d => d.label },
  premiere_action: { tag: MOMENT, text: () => t("a acheté sa première action"), you: () => t("as acheté ta première action"), sub: d => d.label },
  "10_positions": { tag: MOMENT, text: () => t("détient maintenant 10 positions"), you: () => t("détiens maintenant 10 positions"), stat: () => t("10 positions") },
  // Anciens types, encore affichables s'ils existent en base
  premier_dividende: { tag: MOMENT, text: () => t("a reçu son premier dividende"), you: () => t("as reçu ton premier dividende") },
  nouveau_plus_haut: { tag: MOMENT, text: () => t("atteint un nouveau plus haut"), you: () => t("atteins un nouveau plus haut") },
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
  if (!isMoment(type)) return t("Nouveau moment débloqué");
  return t("Bravo, tu {text} !", { text: MOMENTS[type].you() });
}

// Détecte et publie côté serveur les nouveaux moments de l'utilisateur connecté
export async function syncMoments() {
  const { data, error } = await supabase.rpc("sync_my_moments");
  return error ? [] : data || [];
}
