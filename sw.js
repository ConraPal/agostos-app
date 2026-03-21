const CACHE_NAME = 'ag-cache-v1';
const ASSETS = [
  '/agostos-app/',
  '/agostos-app/index.html',
  '/agostos-app/manifest.json',
  '/agostos-app/css/main.css',
  '/agostos-app/css/livestock.css',
  '/agostos-app/css/finance.css',
  '/agostos-app/css/fields.css',
  '/agostos-app/css/agricultura.css',
  '/agostos-app/css/reports.css',
  '/agostos-app/css/print.css',
  '/agostos-app/js/storage.js',
  '/agostos-app/js/livestock.js',
  '/agostos-app/js/finance.js',
  '/agostos-app/js/fields.js',
  '/agostos-app/js/agricultura.js',
  '/agostos-app/js/reports.js',
  '/agostos-app/js/app.js',
  '/agostos-app/assets/vaca-sidebar.jpg',
  '/agostos-app/assets/campo-bg.jpg',
  '/agostos-app/assets/icons/icon-192.svg',
  '/agostos-app/assets/icons/icon-512.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Skip cross-origin (CDN) requests — only cache same-origin
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
