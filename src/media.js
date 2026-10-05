// Images des posts : compression dans le navigateur puis envoi dans Supabase Storage
// (bucket « post-media », supabase/migrations/20261010000001_medias.sql)
import { supabase } from "./supabase";

const BUCKET = "post-media";
export const MAX_IMAGES = 4;
const MAX_SIDE = 1600;          // côté le plus long après redimensionnement
const MAX_GIF_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
export const ACCEPT_ATTR = ACCEPTED.join(",");

export function isImage(file) {
  return !!file && (ACCEPTED.includes(file.type) || /^image\//.test(file.type));
}

function toBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

// Redimensionne (1600 px max) et réencode en WebP, ou JPEG si le navigateur ne sait pas.
// Les GIF sont gardés tels quels pour conserver l'animation.
export async function compressImage(file) {
  if (file.type === "image/gif") {
    if (file.size > MAX_GIF_BYTES) throw new Error("GIF trop lourd (5 Mo maximum).");
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return { blob: file, type: "image/gif", ext: "gif", ...size };
  }
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("Format d'image non reconnu."); }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale), height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // fond blanc pour les PNG transparents passés en JPEG
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  let blob = await toBlob(canvas, "image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.85);
  if (!blob) throw new Error("Impossible de préparer l'image.");
  return { blob, type: blob.type, ext: blob.type === "image/webp" ? "webp" : "jpg", width, height };
}

// Envoie les images préparées ; renvoie [{ path, w, h }] à ranger dans data.images du post
export async function uploadImages(userId, prepared) {
  const uploaded = [];
  for (const img of prepared) {
    const path = `${userId}/${crypto.randomUUID()}.${img.ext}`;
    const { error } = await supabase.storage.from(BUCKET)
      .upload(path, img.blob, { contentType: img.type, cacheControl: "31536000", upsert: false });
    if (error) {
      if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded.map(u => u.path));
      throw new Error("L'envoi de l'image a échoué. Réessaie.");
    }
    uploaded.push({ path, w: img.width, h: img.height });
  }
  return uploaded;
}

export async function removeImages(paths) {
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

// Adresse publique d'une image ; seuls les chemins du bucket sont acceptés (pas d'URL externe)
export function mediaUrl(path) {
  if (typeof path !== "string" || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|png|gif)$/.test(path)) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
