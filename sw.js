// sw.js – the service worker. It keeps a copy of the app on the phone so UNTANGLED
// opens instantly and keeps working with no internet.
//
// IMPORTANT: when you add a NEW file to the app, add it to ASSETS below and bump CACHE
// (untangled-v1 -> untangled-v2) so phones pick it up.

const CACHE = "untangled-v1";
const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "store.js",
  "pwa.js",
  "logo.svg",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Remove caches from older versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Our own files: show the saved copy straight away, and refresh it in the background.
  // (So an update you push shows up the next time the app is opened.)
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req, { ignoreSearch: true });
        const update = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        event.waitUntil(update);
        return cached || (await update) || (req.mode === "navigate" ? cache.match("index.html") : Response.error());
      })()
    );
    return;
  }

  // Google Fonts: save after the first load so the lettering also works offline.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          cache.put(req, res.clone());
          return res;
        } catch {
          return Response.error();
        }
      })()
    );
  }
});
