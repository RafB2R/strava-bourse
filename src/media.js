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

// ---- Fichiers joints (bucket « post-files », 10 Mo max) ----
const FILE_BUCKET = "post-files";
export const MAX_FILES = 3;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
// Le type est déduit de l'extension (les navigateurs le renseignent mal pour CSV ou Excel)
const FILE_TYPES = {
  pdf: "application/pdf",
  csv: "text/csv",
  txt: "text/plain",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
// Type d'un fichier d'après son extension (null si non accepté)
export function fileMime(name) {
  return FILE_TYPES[fileExt(name)] || null;
}

export const FILE_ACCEPT_ATTR = Object.keys(FILE_TYPES).map(e => `.${e}`).join(",");

export function fileExt(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return m ? m[1].toLowerCase() : "";
}

// Vérifie un fichier choisi ; renvoie un message d'erreur ou null
export function checkFile(file) {
  if (!FILE_TYPES[fileExt(file.name)]) return `« ${file.name} » : format non accepté (PDF, Excel, CSV, Word, PowerPoint, texte).`;
  if (file.size > MAX_FILE_BYTES) return `« ${file.name} » : 10 Mo maximum.`;
  return null;
}

// Envoie les fichiers ; renvoie [{ path, name, size }] à ranger dans data.files du post
export async function uploadFiles(userId, files) {
  const uploaded = [];
  for (const file of files) {
    const ext = fileExt(file.name);
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    // supabase-js envoie le type du Blob lui-même (et ignore contentType) : on le fixe d'après l'extension
    const body = new Blob([file], { type: FILE_TYPES[ext] });
    const { error } = await supabase.storage.from(FILE_BUCKET)
      .upload(path, body, { contentType: FILE_TYPES[ext], cacheControl: "31536000", upsert: false });
    if (error) {
      if (uploaded.length) await supabase.storage.from(FILE_BUCKET).remove(uploaded.map(u => u.path));
      throw new Error(`L'envoi de « ${file.name} » a échoué. Réessaie.`);
    }
    uploaded.push({ path, name: file.name.slice(0, 120), size: file.size });
  }
  return uploaded;
}

export async function removeFiles(paths) {
  if (paths.length) await supabase.storage.from(FILE_BUCKET).remove(paths);
}

// Adresse du fichier ; les PDF s'ouvrent dans le navigateur, le reste se télécharge sous son nom d'origine
export function fileUrl(file) {
  if (typeof file?.path !== "string" || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]+$/.test(file.path)) return null;
  const ext = fileExt(file.path);
  if (!FILE_TYPES[ext]) return null;
  const opts = ext === "pdf" ? undefined : { download: file.name || true };
  return supabase.storage.from(FILE_BUCKET).getPublicUrl(file.path, opts).data.publicUrl;
}

export function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}
