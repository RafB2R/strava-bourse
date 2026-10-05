// Messagerie privée entre amis (supabase/migrations/20261009000001_messagerie.sql)
import { supabase } from "./supabase";

export async function fetchConversations() {
  const { data } = await supabase.rpc("my_conversations");
  return data || [];
}

export async function fetchUnreadTotal() {
  const list = await fetchConversations();
  return list.reduce((s, c) => s + (c.unread || 0), 0);
}

// Ouvre ou retrouve la conversation avec un ami ; { id } ou { error }
export async function startConversation(otherId) {
  const { data, error } = await supabase.rpc("start_conversation", { other: otherId });
  return error ? { error: error.message } : { id: data };
}

export async function fetchMessages(conversationId) {
  const { data } = await supabase
    .from("messages")
    .select("id, sender_id, content, images, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(500);
  return data || [];
}

export async function sendMessage(conversationId, senderId, content, images = []) {
  const row = { conversation_id: conversationId, sender_id: senderId, content };
  if (images.length) row.images = images;
  const { data, error } = await supabase
    .from("messages")
    .insert(row)
    .select("id, sender_id, content, images, created_at")
    .single();
  return error ? { error: error.message } : { message: data };
}

export async function markRead(conversationId) {
  await supabase.rpc("mark_conversation_read", { conv: conversationId });
}

// Nouveaux messages en temps réel ; renvoie la fonction de désabonnement
export function subscribeToConversation(conversationId, onMessage) {
  const channel = supabase
    .channel(`conversation-${conversationId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      payload => onMessage(payload.new))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Amis acceptés, pour démarrer une conversation
export async function fetchFriends(userId) {
  const { data } = await supabase
    .from("friendships")
    .select("requester_id, receiver_id, requester:profiles!friendships_requester_id_fkey(id, full_name, username), receiver:profiles!friendships_receiver_id_fkey(id, full_name, username)")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
  return (data || []).map(f => (f.requester_id === userId ? f.receiver : f.requester)).filter(Boolean);
}

// Heure si aujourd'hui, jour de la semaine si < 7 jours, sinon date courte
export function shortTime(date) {
  const d = new Date(date), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const days = (now - d) / 86400000;
  if (days < 7) return d.toLocaleDateString("fr-FR", { weekday: "short" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ---- Images des messages : bucket privé « message-media », un dossier par conversation ----
const MESSAGE_BUCKET = "message-media";

// Envoie les images préparées (voir compressImage dans media.js) ; renvoie [{ path, w, h }]
export async function uploadMessageImages(conversationId, prepared) {
  const uploaded = [];
  for (const img of prepared) {
    const path = `${conversationId}/${crypto.randomUUID()}.${img.ext}`;
    const { error } = await supabase.storage.from(MESSAGE_BUCKET)
      .upload(path, img.blob, { contentType: img.type, cacheControl: "3600", upsert: false });
    if (error) throw new Error("L'envoi de l'image a échoué. Réessaie.");
    uploaded.push({ path, w: img.width, h: img.height });
  }
  return uploaded;
}

// Adresses temporaires (1 h) des images d'une conversation : { [path]: url }
export async function signMessageImages(paths) {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(MESSAGE_BUCKET).createSignedUrls(paths, 3600);
  const urls = {};
  for (const d of data || []) if (d.signedUrl && !d.error) urls[d.path] = d.signedUrl;
  return urls;
}
