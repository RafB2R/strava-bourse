// Définitions des badges Verio : source unique pour l'affichage.
// Les seuils (target) doivent rester identiques à ceux de la fonction SQL
// sync_my_badges() (supabase/migrations/20261005000002_badges_serveur.sql),
// qui est seule à attribuer les badges.
import { supabase } from "./supabase";

// metric : clé de l'objet metrics renvoyé par sync_my_badges()
export const BADGE_CATEGORIES = [
  {
    id: "dca", icon: "🔥", name: "Régularité", desc: "Investir chaque mois, sans exception.",
    metric: "streak", unit: "mois",
    levels: [
      { medal: "🥉", name: "Premiers pas", desc: "3 mois d'affilée avec un investissement", target: 3 },
      { medal: "🥈", name: "Investisseur régulier", desc: "12 mois d'affilée", target: 12 },
      { medal: "🥇", name: "Discipline exemplaire", desc: "3 ans d'affilée", target: 36 },
      { medal: "💎", name: "Légende du DCA", desc: "10 ans d'affilée", target: 120 },
    ],
  },
  {
    id: "milestones", icon: "📅", name: "Milestones", desc: "Le temps est ton meilleur allié.",
    metric: "years", unit: "ans",
    levels: [
      { medal: "🥉", name: "1 an investisseur", desc: "Investisseur depuis 1 an", target: 1 },
      { medal: "🥈", name: "5 ans investisseur", desc: "Investisseur depuis 5 ans", target: 5 },
      { medal: "🥇", name: "10 ans investisseur", desc: "Investisseur depuis 10 ans", target: 10 },
      { medal: "💎", name: "Compounder", desc: "25 ans d'investissement — le badge le plus rare", target: 25 },
    ],
  },
  {
    id: "builder", icon: "🏛️", name: "Builder", desc: "Construis un vrai portefeuille, brique par brique.",
    metric: "positions", unit: "positions",
    levels: [
      { medal: "🥉", name: "Premier portefeuille", desc: "1re position ajoutée", target: 1 },
      { medal: "🥈", name: "En construction", desc: "10 positions", target: 10 },
      { medal: "🥇", name: "Architecte", desc: "50 positions", target: 50 },
      { medal: "💎", name: "Master Builder", desc: "100 positions", target: 100 },
    ],
  },
  {
    id: "explorer", icon: "🌍", name: "Explorer", desc: "Découvre les marchés du monde entier.",
    metric: "types", unit: "types",
    levels: [
      { medal: "🥉", name: "Premier actif", desc: "Un premier type d'actif (ETF, action…)", target: 1 },
      { medal: "🥈", name: "Diversifié", desc: "3 types d'actifs différents", target: 3 },
      { medal: "🥇", name: "Global Investor", desc: "5 types d'actifs différents", target: 5 },
      { medal: "💎", name: "Portefeuille mondial", desc: "8 types d'actifs ou plus", target: 8 },
    ],
  },
  {
    id: "diversification", icon: "📊", name: "Diversification", desc: "Ne jamais mettre tous ses œufs dans le même panier.",
    metric: "positions", unit: "positions",
    levels: [
      { medal: "🥉", name: "Premiers pas", desc: "3 positions différentes", target: 3 },
      { medal: "🥈", name: "Équilibré", desc: "5 positions différentes", target: 5 },
      { medal: "🥇", name: "Bien réparti", desc: "8 positions différentes", target: 8 },
      { medal: "💎", name: "Portefeuille complet", desc: "10 positions ou plus", target: 10 },
    ],
  },
  {
    id: "climber", icon: "🏔️", name: "Climber", desc: "La progression, pas le montant.",
    metric: "perf", unit: "%",
    levels: [
      { medal: "🥉", name: "Premiers gains", desc: "+10 % de performance totale", target: 10 },
      { medal: "🥈", name: "En route", desc: "+50 % de performance totale", target: 50 },
      { medal: "🥇", name: "Double mise", desc: "+100 % de performance totale", target: 100 },
      { medal: "💎", name: "x10", desc: "+1000 % de performance totale", target: 1000 },
    ],
  },
  {
    id: "community", icon: "🤝", name: "Community", desc: "Investir mieux, ensemble.",
    metric: "clubs", unit: "clubs",
    levels: [
      { medal: "🥉", name: "Premier pas", desc: "Rejoindre un club", target: 1 },
      { medal: "🥈", name: "Membre actif", desc: "Membre de 3 clubs", target: 3 },
      { medal: "🥇", name: "Pilier", desc: "Membre de 5 clubs", target: 5 },
      { medal: "💎", name: "Mentor", desc: "Membre de 10 clubs", target: 10 },
    ],
  },
];

// soon : pas encore attribuable, affiché comme « bientôt »
export const HIDDEN_BADGES = [
  { id: "birthday", icon: "🎂", name: "Birthday Investor", desc: "Investir le jour de ton anniversaire" },
  { id: "night_owl", icon: "🌙", name: "Night Owl", desc: "Premier investissement de nuit", soon: true },
  { id: "xmas", icon: "🎄", name: "Christmas Investor", desc: "Investi le 25 décembre", soon: true },
  { id: "never_panic", icon: "🧘", name: "Never Panic", desc: "Traverser un bear market sans toucher son allocation", soon: true },
  { id: "diamond_hands", icon: "💎", name: "Diamond Hands", desc: "Garder une position plus de 10 ans", soon: true },
  { id: "monday", icon: "📆", name: "Monday Investor", desc: "Investir chaque premier lundi du mois pendant un an", soon: true },
];

export const IDENTITIES = [
  { id: "builder_id", icon: "🏛️", name: "Builder", desc: "Tu construis patiemment, brique par brique.", condition: m => m.positions >= 10 },
  { id: "explorer_id", icon: "🧭", name: "Explorer", desc: "Tu explores les marchés du monde.", condition: m => m.types >= 5 },
  { id: "scholar_id", icon: "📚", name: "Scholar", desc: "Tu apprends avant d'investir.", condition: m => m.clubs >= 2 },
  { id: "mentor_id", icon: "🤝", name: "Mentor", desc: "Tu aides les autres à progresser.", condition: m => m.clubs >= 5 },
  { id: "compounder_id", icon: "📈", name: "Long-Term Investor", desc: "Tu penses en années, pas en jours.", condition: m => m.years >= 5 },
  { id: "global_id", icon: "🌍", name: "Global Investor", desc: "Ton portefeuille traverse les frontières.", condition: m => m.types >= 6 },
];

export const EMPTY_METRICS = { positions: 0, types: 0, perf: null, clubs: 0, years: null, streak: 0 };

// Nom lisible d'un badge à partir de son identifiant ("builder_🥈", "birthday"…)
export function getBadgeInfo(badgeId) {
  const hidden = HIDDEN_BADGES.find(b => b.id === badgeId);
  if (hidden) return { icon: hidden.icon, medal: hidden.icon, name: hidden.name, category: "Badge secret" };
  const [catId, medal] = String(badgeId).split("_");
  const cat = BADGE_CATEGORIES.find(c => c.id === catId);
  const level = cat?.levels.find(l => l.medal === medal);
  if (!cat || !level) return { icon: "🏅", medal: medal || "🏅", name: catId, category: "" };
  return { icon: cat.icon, medal, name: level.name, category: cat.name };
}

// Badge décrit dans le data d'une activité ou d'une notification (anciennes lignes : badge_name/badge_medal)
export function badgeFromData(d = {}) {
  if (d.badge_id) return getBadgeInfo(d.badge_id);
  return { icon: "🏅", medal: d.badge_medal || "🏅", name: d.badge_name || "", category: "" };
}

export function getNextLevel(cat, value) {
  if (value === null || value === undefined) return cat.levels[0];
  return cat.levels.find(l => value < l.target) || null;
}

// Progression vers le prochain palier, en %
export function getProgress(cat, value) {
  if (value === null || value === undefined) return 0;
  const next = getNextLevel(cat, value);
  if (!next) return 100;
  const idx = cat.levels.indexOf(next);
  const prev = idx > 0 ? cat.levels[idx - 1].target : 0;
  return Math.max(0, Math.min(((value - prev) / (next.target - prev)) * 100, 100));
}

// Recalcule côté serveur les badges de l'utilisateur connecté et attribue les nouveaux.
// Renvoie { metrics, badges: [{ badge_id, unlocked_at }], new: [badge_id] } ou null.
export async function syncBadges() {
  const { data, error } = await supabase.rpc("sync_my_badges");
  if (error || !data) return null;
  return { metrics: { ...EMPTY_METRICS, ...data.metrics }, badges: data.badges || [], new: data.new || [] };
}
