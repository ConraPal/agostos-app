const CACHE_NAME = 'ag-cache-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/livestock.css',
  '/css/finance.css',
  '/css/fields.css',
  '/css/agricultura.css',
  '/css/reports.css',
  '/css/print.css',
  '/js/storage.js',
  '/js/livestock.js',
  '/js/finance.js',
  '/js/fields.js',
  '/js/agricultura.js',
  '/js/insumos.js',
  '/js/reports.js',
  '/js/app.js',
  '/css/insumos.css',
  '/assets/vaca-sidebar.jpg',
  '/assets/campo-bg.jpg',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg',
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
