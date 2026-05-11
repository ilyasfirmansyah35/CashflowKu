// CashflowKu Service Worker v1.0
const CACHE_NAME = 'cashflowku-v1';
const OFFLINE_URL = 'offline.html';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/CashflowKu/',
  '/CashflowKu/index.html',
  '/CashflowKu/offline.html',
  '/CashflowKu/manifest.json',
  '/CashflowKu/icons/icon-192x192.png',
  '/CashflowKu/icons/icon-512x512.png'
];

// Install event — precache shell assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        // Activate immediately, don't wait for open tabs to close
        return self.skipWaiting();
      })
  );
});

// Activate event — clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Take control of all open tabs immediately
        return self.clients.claim();
      })
  );
});

// Fetch event — network-first strategy for dynamic content, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (except for the Google Apps Script iframe)
  // We don't cache the Apps Script content since it's dynamic
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    // Try network first
    fetch(request)
      .then((response) => {
        // If we got a good response, clone it and cache it
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        // Network failed — try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // If it's a navigation request, show offline page
        if (request.mode === 'navigate') {
          const offlineResponse = await caches.match(OFFLINE_URL);
          if (offlineResponse) {
            return offlineResponse;
          }
        }

        // Return a basic offline response
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
