/* TitanOS service worker — app shell + stale-while-revalidate hashed assets */
const CACHE = "titanos-shell-v8";
const PRECACHE = [
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/fonts/plus-jakarta-sans-latin.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isBypass(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase") ||
    url.pathname.includes("auth")
  );
}

function isHashedAsset(url) {
  return url.pathname.startsWith("/assets/");
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/fonts/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname.startsWith("/pwa-") ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname.startsWith("/brand/")
  );
}

/** Stale-while-revalidate — never stick on a broken hashed chunk after deploy */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) {
    network.catch(() => {});
    return hit;
  }
  const res = await network;
  return res || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isBypass(url)) return;

  if (isHashedAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // Navigations — always prefer network so shell HTML stays fresh
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => res)
        .catch(async () => {
          const cache = await caches.open(CACHE);
          return (await cache.match("/offline.html")) || Response.error();
        })
    );
  }
});
