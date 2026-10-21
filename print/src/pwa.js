// The site as an app on the phone: a manifest for «Добавить на главный экран»
// and a service worker that keeps the last issue for reading without network.

const manifest = () => JSON.stringify({
  name: "Газета",
  short_name: "Газета",
  description: "Ежедневное издание для одного читателя: новости, погода в Москве, вакансии и барахолка.",
  lang: "ru",
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "any",
  background_color: "#d9d2c3",
  theme_color: "#f4efe3",
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
}, null, 2);

// The issue page goes network-first (fresh when online, the last copy when not);
// pictures from other sites are kept as they are seen, up to a limit.
const serviceWorker = () => `// «Газета»: reading without network.
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
`;

module.exports = { manifest, serviceWorker };
