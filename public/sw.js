// Service worker de Verio : ouverture rapide et écran de secours hors connexion.
//
// - Pages (navigation) : réseau d'abord, pour toujours avoir la dernière version
//   en ligne ; copie en cache pour ouvrir l'application sans réseau.
// - Fichiers de l'application (/assets/*, au nom unique à chaque version) :
//   cache d'abord, ils ne changent jamais.
// - Icônes et manifeste : cache, rafraîchi en arrière-plan.
// - Rien d'autre n'est mis en cache : ni /api (cours, taux…), ni Supabase
//   (données personnelles), ni les autres sites.

const VERSION = "verio-v1";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(["/", "/manifest.webmanifest", "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) caches.open(SHELL).then(cache => cache.put("/", response.clone()));
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok) { const copy = response.clone(); caches.open(ASSETS).then(cache => cache.put(request, copy)); }
        return response;
      }))
    );
    return;
  }

  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest" || url.pathname === "/favicon.svg") {
    event.respondWith(
      caches.open(SHELL).then(cache => cache.match(request).then(cached => {
        const network = fetch(request).then(response => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || network;
      }))
    );
  }
});
