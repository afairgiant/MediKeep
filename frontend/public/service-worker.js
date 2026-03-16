// Safe Medical Records PWA Service Worker
// IMPORTANT: No structured logging to prevent infinite loops
const SW_VERSION = '__SW_VERSION__';
const CACHE_NAME = 'medical-records-' + SW_VERSION;
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-256.png',
  '/icon-192.png',
  '/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(error => {
        console.error('SW: Cache installation failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network-first for navigation, cache-first for hashed assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // CRITICAL: Skip ALL API calls to prevent logging loops
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip authentication-related requests
  if (url.pathname.includes('login') ||
      url.pathname.includes('logout') ||
      url.pathname.includes('auth') ||
      url.pathname.includes('token')) {
    return;
  }

  // Skip service worker files to prevent loops
  if (url.pathname.includes('service-worker') ||
      url.pathname.includes('sw.js')) {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Navigation requests (HTML pages) — network-first strategy
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, responseToCache))
            .catch(error => console.error('SW: Cache put failed:', error));
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cached => cached || caches.match('/offline.html'));
        })
    );
    return;
  }

  // Hashed assets (/assets/*) — cache-first (immutable content-hashed filenames)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(request).then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, responseToCache))
              .catch(error => console.error('SW: Cache put failed:', error));
            return networkResponse;
          });
        })
        .catch(error => {
          console.error('SW: Fetch failed:', error);
          return caches.match(request);
        })
    );
    return;
  }

  // All other static resources — network-first
  event.respondWith(
    fetch(request)
      .then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(request, responseToCache))
          .catch(error => console.error('SW: Cache put failed:', error));
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Handle messages from client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
