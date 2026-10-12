import { supabase } from "./supabase";
import { t } from "./i18n";

// Étiquettes automatiques du profil (au plus 2), calculées par la base à partir du
// portefeuille (verio_compute_labels, 20261026000001) : elles remplacent la stratégie
// choisie à la main. « pct » : la part qui justifie l'étiquette (jamais un montant).
export const LABELS = {
  passif: { icon: "🐢", name: () => t("Investisseur passif"), why: p => t("{v} % du portefeuille en ETF", { v: p }) },
  stock_picker: { icon: "🎯", name: () => t("Stock picker"), why: p => t("{v} % en actions en direct", { v: p }) },
  prudent: { icon: "🛡️", name: () => t("Prudent"), why: p => t("{v} % en obligations et monétaire", { v: p }) },
  pierre: { icon: "🏠", name: () => t("Pierre"), why: p => t("{v} % en immobilier", { v: p }) },
  crypto: { icon: "₿", name: () => t("Crypto"), why: p => t("{v} % en crypto", { v: p }) },
  diversifie: { icon: "🌍", name: () => t("Diversifié"), why: p => t("4 expositions ou plus, aucune ligne au-dessus de {v} %", { v: p }) },
  dividendes: { icon: "💰", name: () => t("Chasseur de dividendes"), why: p => t("{v} % de rendement en revenus sur 12 mois", { v: p }) },
  mixte: { icon: "⚖️", name: () => t("Mixte"), why: () => t("Aucun style ne domine le portefeuille") },
};

const fmt = v => (Math.round(Number(v) * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 });
export const labelInfo = l => {
  const def = LABELS[l?.id];
  return def ? { id: l.id, icon: def.icon, name: def.name(), why: def.why(fmt(l.pct ?? 0)) } : null;
};

// Chargement groupé : les étiquettes de tous les profils affichés en une requête
const cache = new Map(); // userId → Promise<labels[]>
let queue = null;
export function fetchLabels(userId) {
  if (!userId) return Promise.resolve([]);
  if (cache.has(userId)) return cache.get(userId);
  if (!queue) {
    queue = new Map();
    setTimeout(async () => {
      const batch = queue; queue = null;
      const ids = [...batch.keys()];
      const { data, error } = await supabase.from("profile_labels").select("user_id, labels").in("user_id", ids);
      const byId = new Map((error ? [] : data || []).map(r => [r.user_id, r.labels || []]));
      for (const [id, resolve] of batch) resolve((byId.get(id) || []).map(labelInfo).filter(Boolean));
    }, 0);
  }
  const promise = new Promise(resolve => queue.set(userId, resolve));
  cache.set(userId, promise);
  return promise;
}

// Après un changement de portefeuille : recharger mes étiquettes
export function forgetLabels(userId) { cache.delete(userId); }
