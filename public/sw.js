/* TitanOS service worker — offline shell without version-fragile JS caching */
const CACHE = "titanos-shell-v9";
const PRECACHE = [
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/fonts/plus-jakarta-sans-latin.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isBypass(url) {
  return url.pathname.startsWith("/api/") || url.hostname.includes("supabase") || url.pathname.includes("auth");
}

function isHashedAsset(url) {
  return url.pathname.startsWith("/assets/");
}

function isStaticAsset(url) {
  return url.pathname.startsWith("/fonts/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname.startsWith("/pwa-") ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname.startsWith("/brand/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isBypass(url)) return;

  // Hashed Vite assets are immutable per build, but old HTML can point to chunks
  // removed by a newer build. Never let a service-worker cache serve those assets.
  if (isHashedAsset(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) await cache.put(request, response.clone());
          return response;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // Always fetch navigation HTML from the network so every launch sees the
  // current asset manifest. Only the explicit offline page is cached fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match("/offline.html")) || Response.error();
      })
    );
  }
});
