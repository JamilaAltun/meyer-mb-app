const CACHE_NAME = 'meyer-metallbau-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/components.css',
  './css/responsive.css',
  './assets/logo-placeholder.svg',
  './js/config.js',
  './js/storage.js',
  './js/auth.js',
  './js/notifications.js',
  './js/pdf.js',
  './js/signature.js',
  './js/zeiterfassung.js',
  './js/dashboard.js',
  './js/kunden.js',
  './js/anfragen.js',
  './js/auftraege.js',
  './js/nachkalkulation.js',
  './js/rechnungen.js',
  './js/aufgaben.js',
  './js/kalender.js',
  './js/chat.js',
  './js/urlaub.js',
  './js/tickets.js',
  './js/einstellungen.js',
  './js/app.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
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
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* Supabase API-Calls: immer Network-First, bei Fehler Cache */
  if (url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  /* Alle anderen: Cache-First */
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      });
    })
  );
});

/* Hintergrund-Sync (falls vom Browser unterstützt) */
self.addEventListener('sync', event => {
  if (event.tag === 'mmg-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_REQUESTED' }));
      })
    );
  }
});
