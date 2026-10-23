// Edge · Service Worker: hält die App offline bereit.
const VERSION = 'edge-1.1.0';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/app.js',
  './js/util.js',
  './js/store.js',
  './js/ui.js',
  './js/charts.js',
  './js/edge.js',
  './js/gemini.js',
  './js/img.js',
  './js/file.js',
  './js/speech.js',
  './js/demo.js',
  './js/settings.js',
  './js/views/today.js',
  './js/views/trades.js',
  './js/views/calendar.js',
  './js/views/stats.js',
  './js/views/journal.js',
  './js/views/check.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Nur eigene alte Caches löschen: Luna und Edge liegen auf derselben Adresse
      for (const k of await caches.keys()) if (k.startsWith('edge-') && k !== VERSION) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (r) =>
        r ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
