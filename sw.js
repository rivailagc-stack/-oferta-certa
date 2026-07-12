const CACHE_NAME = "oferta-certa-v40-completa";
const APP_SHELL = [
  "/",
  "/index.html",
  "/admin.html",
  "/style.css",
  "/config.js",
  "/loja.js",
  "/admin.js",
  "/manifest.webmanifest",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  // Não cacheia chamadas da API/Supabase.
  if (
    request.url.includes("/api/") ||
    request.url.includes("supabase.co")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached || caches.match("/offline.html")
        )
      )
  );
});
