// Application installable (PWA) : service worker et invitation à l'installation

// Le navigateur propose l'installation (Android, Chrome, Edge) via l'événement
// « beforeinstallprompt », qui peut arriver avant même l'affichage de React :
// on le garde de côté pour le bouton « Installer ».
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

export function initPwa() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
  // En développement, pas de service worker (il garderait d'anciennes versions en cache)
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* sans service worker, l'app fonctionne normalement */ });
    });
  }
}

export function onInstallAvailable(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function canPromptInstall() {
  return !!deferredPrompt;
}

// Ouvre la fenêtre d'installation du navigateur ; true si acceptée
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const e = deferredPrompt;
  deferredPrompt = null;
  notify();
  e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === "accepted";
}

// Déjà ouverte comme application (écran d'accueil)
export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// iPhone / iPad dans Safari : pas d'invitation automatique, il faut passer par « Partager »
export function isIosSafari() {
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}
