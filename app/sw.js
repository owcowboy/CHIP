const CACHE_VERSION = 'chip-v2';

const STATIC_ASSETS = [
  '/CHIP/',
  '/CHIP/index.html',
  '/CHIP/manifest.json',
  '/CHIP/css/chip.css',
  '/CHIP/js/store.js',
  '/CHIP/js/api.js',
  '/CHIP/js/app.js',
  '/CHIP/js/views/planning.js',
  '/CHIP/js/views/tasks.js',
  '/CHIP/js/views/morning.js',
  '/CHIP/js/views/sport.js',
  '/CHIP/js/views/agent.js',
  '/CHIP/icons/icon-192.png',
  '/CHIP/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for API calls (different origin or Worker API paths)
  const isApiCall =
    url.origin !== self.location.origin ||
    ['/health', '/planning', '/chat', '/morning'].some((p) => url.pathname.startsWith(p));

  if (isApiCall) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
