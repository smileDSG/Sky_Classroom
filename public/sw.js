/**
 * OpenMAIC Service Worker
 *
 * Cache strategies:
 * - cache-first: static assets (_next/static/*)
 * - network-first: API calls (/api/*)
 * - stale-while-revalidate: HTML pages
 */

const CACHE_NAME = 'openmaic-v1';
const STATIC_CACHE = 'openmaic-static-v1';
const API_CACHE = 'openmaic-api-v1';

// Pre-cache shell assets on install
const SHELL_ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME && n !== STATIC_CACHE && n !== API_CACHE).map((n) => caches.delete(n))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Static assets — cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API calls — network-first with offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Pages — stale-while-revalidate
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default — network-first
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ success: false, error: 'You are offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => cached || new Response('Offline', { status: 503 }));

  return cached || fetchPromise;
}

export {};
