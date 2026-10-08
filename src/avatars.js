import { supabase } from "./supabase";

// Photos de profil : bucket public « avatars », une seule image par membre
// (<id du membre>/avatar). Pas de colonne en base : l'adresse se déduit de l'id,
// et un membre sans photo garde ses initiales (l'image manquante est retenue
// pour ne pas la redemander à chaque affichage).
const BUCKET = "avatars";
const SIDE = 320; // carré, assez net pour le plus grand avatar affiché

const missing = new Set();
const versions = {}; // id → numéro pour recharger la photo qu'on vient de changer
const listeners = new Set();

export function avatarUrl(userId) {
  if (!userId || missing.has(userId)) return null;
  const url = supabase.storage.from(BUCKET).getPublicUrl(`${userId}/avatar`).data.publicUrl;
  return versions[userId] ? `${url}?v=${versions[userId]}` : url;
}

export function markMissing(userId) { missing.add(userId); }

// Les avatars affichés se mettent à jour quand une photo change
export function onAvatarChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function changed(userId) {
  missing.delete(userId);
  versions[userId] = Date.now();
  listeners.forEach(fn => fn(userId));
}

// Recadre au centre en carré, réduit et réencode (WebP, sinon JPEG)
async function squareImage(file) {
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("Format d'image non reconnu."); }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(SIDE, side);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const toBlob = type => new Promise(r => canvas.toBlob(r, type, 0.85));
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg");
  if (!blob) throw new Error("Impossible de préparer l'image.");
  return blob;
}

export async function uploadAvatar(userId, file) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choisis une image.");
  const blob = await squareImage(file);
  const { error } = await supabase.storage.from(BUCKET)
    .upload(`${userId}/avatar`, new Blob([blob], { type: blob.type }), { contentType: blob.type, cacheControl: "3600", upsert: true });
  if (error) throw new Error("L'envoi de la photo a échoué. Réessaie.");
  changed(userId);
}

export async function removeAvatar(userId) {
  const { error } = await supabase.storage.from(BUCKET).remove([`${userId}/avatar`]);
  if (error) throw new Error("Impossible de retirer la photo.");
  missing.add(userId);
  versions[userId] = Date.now();
  listeners.forEach(fn => fn(userId));
}
