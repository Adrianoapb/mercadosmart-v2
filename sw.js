/* ==========================================
   MERCADOSMART - SERVICE WORKER (Offline)
   ========================================== */

const CACHE_NAME = 'mercadosmart-v15-auth-fix';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/animations.css',
  './js/db.js',
  './js/utils.js',
  './js/auth.js',
  './js/cloud.js',
  './js/categories.js',
  './js/charts.js',
  './js/list.js',
  './js/dashboard.js',
  './js/history.js',
  './js/stock.js',
  './js/reports.js',
  './js/family.js',
  './js/settings.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const isNavigation = request.mode === 'navigate';
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  if (isNavigation) {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => {
        if (request.destination === 'document') {
          return caches.match('./index.html');
        }
        return Response.error();
      });
    })
  );
});
