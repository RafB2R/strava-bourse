// Pseudos : format et disponibilité (supabase/migrations/20261013000001_pseudo_disponible.sql)
import { supabase } from "./supabase";
import { t } from "./i18n";

export function normalizeUsername(value) {
  return (value || "").trim().toLowerCase().replace(/^@/, "");
}

// Message d'erreur de format, ou null si le pseudo est bien formé
export function usernameFormatError(value) {
  const u = normalizeUsername(value);
  if (u.length < 3) return t("3 caractères minimum.");
  if (u.length > 20) return t("20 caractères maximum.");
  if (!/^[a-z0-9_.]+$/.test(u)) return t("Lettres sans accent, chiffres, « _ » et « . » uniquement.");
  return null;
}

// true : libre · false : déjà pris ou réservé · null : vérification impossible (réseau, fonction absente)
export async function isUsernameAvailable(value) {
  const { data, error } = await supabase.rpc("username_available", { name: normalizeUsername(value) });
  if (error || typeof data !== "boolean") return null;
  return data;
}
