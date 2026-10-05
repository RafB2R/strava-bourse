// Service worker de Verio : ouverture rapide et écran de secours hors connexion.
//
// - Pages (navigation) : réseau d'abord, pour toujours avoir la dernière version
//   en ligne ; copie en cache pour ouvrir l'application sans réseau.
// - Fichiers de l'application (/assets/*, au nom unique à chaque version) :
//   cache d'abord, ils ne changent jamais.
// - Icônes et manifeste : cache, rafraîchi en arrière-plan.
// - Rien d'autre n'est mis en cache : ni /api (cours, taux…), ni Supabase
//   (données personnelles), ni les autres sites.

const VERSION = "verio-v2";
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

// ---- Notifications push (envoyées par /api/push) ----
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "Verio", {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag,
    renotify: !!data.tag,
    data: { url: data.url || "/" },
  }));
});

// Clic sur la notification : revient sur Verio (fenêtre existante si possible) au bon endroit
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      return existing.navigate(target);
    }
    return self.clients.openWindow(target);
  })());
});
