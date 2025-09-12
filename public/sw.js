// HatakeSocial - Optimized Service Worker
// Based on PWABuilder best practices for maximum PWA score

const CACHE_NAME = 'hatakesocial-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Files to cache immediately (App Shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/about.html',
  '/contact.html',
  '/app.html',
  '/my_collection.html',
  '/deck.html',
  '/marketplace.html',
  '/offline.html',
  '/manifest.json',
  '/css/style.css',
  '/js/main.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Runtime caching patterns
const RUNTIME_CACHE_URLS = [
  '/articles.html',
  '/events.html',
  '/community.html',
  '/gallery.html',
  '/shop.html',
  '/profile.html',
  '/settings.html'
];

// Install event - Cache app shell
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Pre-caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activate');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - Serve cached content when offline
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If online, cache the response and return it
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If offline, try to serve from cache
          return caches.match(event.request)
            .then(response => {
              if (response) {
                return response;
              }
              // If not in cache, serve offline page
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // Handle other requests (CSS, JS, images, etc.)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
          .then(fetchResponse => {
            // Cache successful responses
            if (fetchResponse.status === 200) {
              const responseClone = fetchResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return fetchResponse;
          })
          .catch(() => {
            // If it's an image request and we're offline, return a placeholder
            if (event.request.destination === 'image') {
              return new Response(
                '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999">Offline</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Background Sync - Handle offline form submissions
self.addEventListener('sync', event => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'contact-form-sync') {
    event.waitUntil(syncContactForm());
  }
  
  if (event.tag === 'deck-save-sync') {
    event.waitUntil(syncDeckSave());
  }
});

// Push Notifications
self.addEventListener('push', event => {
  console.log('[ServiceWorker] Push received');
  
  const options = {
    body: event.data ? event.data.text() : 'New update available!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-72x72.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('HatakeSocial', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('[ServiceWorker] Notification click received');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Periodic Background Sync (for updates)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'content-sync') {
    event.waitUntil(syncContent());
  }
});

// Helper functions for background sync
async function syncContactForm() {
  try {
    // Get stored form data from IndexedDB
    const formData = await getStoredFormData();
    if (formData) {
      const response = await fetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify(formData),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        await clearStoredFormData();
        console.log('[ServiceWorker] Contact form synced successfully');
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Contact form sync failed:', error);
  }
}

async function syncDeckSave() {
  try {
    // Sync saved decks when back online
    const decks = await getStoredDecks();
    for (const deck of decks) {
      await fetch('/api/decks', {
        method: 'POST',
        body: JSON.stringify(deck),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    await clearStoredDecks();
    console.log('[ServiceWorker] Decks synced successfully');
  } catch (error) {
    console.error('[ServiceWorker] Deck sync failed:', error);
  }
}

async function syncContent() {
  try {
    // Sync latest articles, events, etc.
    const response = await fetch('/api/content/latest');
    if (response.ok) {
      const content = await response.json();
      // Update cached content
      const cache = await caches.open(CACHE_NAME);
      await cache.put('/api/content/latest', new Response(JSON.stringify(content)));
      console.log('[ServiceWorker] Content synced successfully');
    }
  } catch (error) {
    console.error('[ServiceWorker] Content sync failed:', error);
  }
}

// IndexedDB helpers (simplified)
async function getStoredFormData() {
  // Implementation would use IndexedDB to retrieve stored form data
  return null;
}

async function clearStoredFormData() {
  // Implementation would clear stored form data from IndexedDB
}

async function getStoredDecks() {
  // Implementation would retrieve stored decks from IndexedDB
  return [];
}

async function clearStoredDecks() {
  // Implementation would clear stored decks from IndexedDB
}

// Share Target API support
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHARE_TARGET') {
    // Handle shared content (deck files, images, etc.)
    console.log('[ServiceWorker] Share target received:', event.data);
    
    event.waitUntil(
      clients.openWindow('/deck.html?shared=true')
    );
  }
});

// Update notification
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[ServiceWorker] HatakeSocial Service Worker loaded successfully');

