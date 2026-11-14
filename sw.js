// Vanta · Service Worker: hält die App offline bereit.
const VERSION = 'vanta-1.0.0';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/db.js',
  './js/store.js',
  './js/model.js',
  './js/ui.js',
  './js/chart.js',
  './js/demo.js',
  './js/views/list.js',
  './js/views/form.js',
  './js/views/detail.js',
  './js/views/close.js',
  './js/views/stats.js',
  './js/views/calendar.js',
  './js/views/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Eigene alte Caches und die der Vorgänger-App Edge löschen
      for (const k of await caches.keys()) {
        if ((k.startsWith('vanta-') || k.startsWith('edge-')) && k !== VERSION) await caches.delete(k);
      }
      await self.clients.claim();
    })(),
  );
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
