/* Voluptia Service Worker v119 — Web Push */
const CACHE_NAME = 'voluptia-v119';
const CORE_ASSETS = [
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/landing-hero-voluptia.png',
  '/gifs/coeur.gif',
  '/gifs/clin-doeil.gif',
  '/gifs/flamme.gif',
  '/gifs/champagne.gif',
  '/gifs/bisou.gif',
  '/gifs/spark.gif',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('voluptia-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => null);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Ne jamais mettre en cache HTML, JS, CSS — toujours récupérer la version fraîche
  if (request.mode === 'navigate') return;
  if (/\.(?:html|js|mjs|css)$/i.test(url.pathname)) return;

  // Cache uniquement les assets statiques stables
  if (/\.(?:png|jpg|jpeg|gif|webp|svg|ico|webmanifest|woff2?)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});


// --- Notifications push ---
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Voluptia';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.notificationId || data.type || 'voluptia',
    renotify: true,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl !== '/') client.navigate(targetUrl).catch(() => null);
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
