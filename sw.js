// Service worker : la mini-appli de pointage s'ouvre même sans réseau (réseau d'abord, copie en secours).
const CACHE = "pointage-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copie = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copie)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })),
  );
});
