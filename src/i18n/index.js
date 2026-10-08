// Traduction de l'interface : le français est la langue source. Chaque texte est écrit
// en français dans le code et passé à t() ; en anglais, t() cherche sa traduction dans les
// dictionnaires de src/i18n/en (un fichier par groupe d'écrans). Un texte sans traduction
// reste en français.
//   t("Découvrir")                    → "Discover"
//   t("{n} positions", { n: 3 })      → "3 positions"  (variables entre accolades)
// La langue est choisie une fois au chargement (choix enregistré, sinon langue du
// navigateur) ; la changer recharge la page.
import en from "./en";

const SUPPORTED = ["fr", "en"];

function detect() {
  try {
    const saved = localStorage.getItem("verio-lang");
    if (SUPPORTED.includes(saved)) return saved;
  } catch { /* stockage indisponible */ }
  const nav = (typeof navigator !== "undefined" && (navigator.languages?.[0] || navigator.language)) || "fr";
  return nav.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export const LANG = detect();
// Pour toLocaleString / toLocaleDateString / Intl
export const LOCALE = LANG === "en" ? "en-GB" : "fr-FR";

const dict = LANG === "en" ? en : {};

export function t(text, vars) {
  let out = dict[text] ?? text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export function setLang(lang) {
  if (!SUPPORTED.includes(lang) || lang === LANG) return;
  try { localStorage.setItem("verio-lang", lang); } catch { /* stockage indisponible */ }
  window.location.reload();
}

if (typeof document !== "undefined") document.documentElement.lang = LANG;
