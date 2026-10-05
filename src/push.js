// Notifications push : abonnement de cet appareil (voir api/push.js et
// supabase/migrations/20261014000001_notifications_push.sql)
import { supabase } from "./supabase";
import { isStandalone, isIosSafari } from "./pwa";

// Clé publique VAPID (la même que dans api/push.js ; elle n'a rien de secret)
const VAPID_PUBLIC_KEY = "BDwFtRF-NhQFspShPQpzHrry6wLC4PmHdVLEL90rbv8udXd_h1ey1kra8Ss48rbQb2zj8w5VnBGzfSGlhf314GA";

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

// « unsupported » : navigateur sans push · « install-first » : iPhone, il faut d'abord installer l'app
// « denied » : refusé dans les réglages · « on » / « off » : activé ou non sur cet appareil
export async function pushStatus() {
  if (isIosSafari() && !isStandalone()) return "install-first";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

// Demande l'autorisation puis enregistre l'appareil ; renvoie le nouvel état
export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  const { endpoint, keys } = sub.toJSON();
  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth, p_user_agent: navigator.userAgent,
  });
  if (error) { await sub.unsubscribe(); throw new Error("Enregistrement impossible. Réessaie."); }
  return "on";
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
  return "off";
}
