// Trades publiés dans le fil : uniquement des faits, en % (jamais de montant).

const fmt = v => String(Math.round(v * 10) / 10).replace(".", ",");

// Changement de poids d'une position : renforcement ou allègement, null si inchangé
export function tradeActivity(label, before, after) {
  const avant = Number(before), apres = Number(after);
  if (!(avant > 0) || !(apres >= 0) || avant === apres) return null;
  if (apres === 0) return { type: "vente", data: { label, avant, apres: 0, variation: -100 } };
  const variation = Math.round(((apres - avant) / avant) * 100);
  return { type: apres > avant ? "renforcement" : "allegement", data: { label, avant, apres, variation } };
}

// Textes du fil pour un trade ; null pour un ancien trade sans détail (texte générique)
export function tradeTexts(type, d = {}) {
  if (!d.label || d.variation === undefined) return null;
  const verb = { renforcement: "a renforcé", allegement: "a allégé", vente: "a soldé" }[type];
  if (!verb) return null;
  return {
    sentence: `${verb} ${d.label}`,
    stat: `${d.variation > 0 ? "+" : "−"}${fmt(Math.abs(d.variation))} % de la position`,
    detail: `${fmt(d.avant)} % → ${fmt(d.apres)} % du portefeuille`,
  };
}
