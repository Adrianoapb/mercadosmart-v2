/* ==========================================
   MERCADOSMART - SERVICE WORKER (Offline)
   ========================================== */

const CACHE_NAME = 'mercadosmart-v20-offline-core';
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
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isNavigation = request.mode === 'navigate';
  const isApi = url.pathname.startsWith('/api/');

  if (isApi) {
    event.respondWith(fetch(request).catch(() => Response.json({ ok: false, error: 'OFFLINE_API', message: 'Sem conexão com a API no momento.' }, { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (error) {
        return caches.match('./index.html');
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const shouldCache = url.origin === self.location.origin;

    if (cached) {
      event.waitUntil(fetch(request).then(response => {
        if (shouldCache && response && response.ok) return cache.put(request, response.clone());
      }).catch(() => null));
      return cached;
    }

    try {
      const fresh = await fetch(request);
      if (shouldCache && fresh && fresh.ok) await cache.put(request, fresh.clone());
      return fresh;
    } catch (error) {
      if (request.destination === 'document') return caches.match('./index.html');
      return Response.error();
    }
  })());
});
