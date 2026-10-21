// «Газета»: reading without network.
const PAGES = "gazeta-pages-v1";
const PICTURES = "gazeta-pictures-v1";
const SHELL = ["./", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
const MAX_PICTURES = 300;

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (![PAGES, PICTURES].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_PICTURES))) await cache.delete(k);
}

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  if (url.origin === location.origin) {
    e.respondWith(fetch(r).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(r.mode === "navigate" ? "./" : r, copy)); }
      return res;
    }).catch(async () => (await caches.match(r.mode === "navigate" ? "./" : r)) || caches.match("./")));
    return;
  }
  if (r.destination === "image") {
    e.respondWith(caches.open(PICTURES).then(async (c) => {
      const hit = await c.match(r);
      if (hit) return hit;
      try {
        const res = await fetch(r);
        c.put(r, res.clone()).then(() => trim(c));
        return res;
      } catch {
        return Response.error();
      }
    }));
  }
});
