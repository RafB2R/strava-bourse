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

// Mouvements (trades) : données factuelles créées automatiquement, en % uniquement.
// C'est tout ce que montrent le filtre « Activité » du fil et l'onglet Activité d'un profil
// public ; l'auteur peut y ajouter une description (voir set_activity_note).
// Dividendes et coupons n'en font pas partie tant qu'on n'a pas assez d'informations dessus.
// Origine d'un mouvement : saisi à la main, ou importé des opérations réelles
// via Powens. Les anciens mouvements, sans source, ont tous été saisis à la main.
// Les Super Investors, eux, sont alimentés par leurs déclarations 13F à la SEC.
export const tradeSource = data => (data?.source === "sec13f"
  ? { icon: "🏛️", label: "Déclaration 13F (SEC)", title: "D'après la déclaration publique du gérant à la SEC" }
  : data?.source === "powens"
  ? { icon: "🔗", label: "Synchronisé (Powens)", title: "Importé automatiquement depuis les opérations du compte" }
  : { icon: "✋", label: "Ajouté manuellement", title: "Saisi à la main par l'investisseur" });

// declaration_13f : mouvements du trimestre d'un Super Investor, regroupés en une seule carte
export const TRADE_TYPES = ["new_position", "renforcement", "allegement", "vente", "suppression_position", "versement", "retrait", "rebalancement", "declaration_13f"];
