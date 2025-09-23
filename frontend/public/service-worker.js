// Safe Medical Records PWA Service Worker
// IMPORTANT: No structured logging to prevent infinite loops
const CACHE_NAME = 'medical-records-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-256.png',
  '/icon-192.png',
  '/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('SW: Installing service worker');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Caching static assets');
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
  console.log('SW: Activating service worker');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
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
      url.pathname === '/manifest.json' ||
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

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          return response;
        }

        // Fetch from network and cache successful responses
        return fetch(request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, responseToCache))
            .catch(error => console.error('SW: Cache put failed:', error));

          return response;
        });
      })
      .catch(error => {
        console.error('SW: Fetch failed:', error);
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        // For other requests, try to return a cached version
        return caches.match(request);
      })
  );
});

// Handle messages from client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('SW: Received SKIP_WAITING message');
    self.skipWaiting();
  }
});