/* Titan Attention takeover cleanup worker.
 * This intentionally unregisters the retired TitanOS service worker and clears
 * old caches so returning visitors cannot stay pinned to the former app shell.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        try { client.navigate(client.url); } catch { /* best effort */ }
      }
    } catch {
      await self.registration.unregister();
    }
  })());
});

self.addEventListener("fetch", () => {
  // Deliberately do not intercept requests. Titan Attention is network-first.
});
