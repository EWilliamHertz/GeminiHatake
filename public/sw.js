// HatakeSocial PWA Service Worker - Perfect Score Version
// Version: 2.0.0

const CACHE_NAME = 'hatakesocial-v2.0.0';
const OFFLINE_URL = '/offline.html';

// Critical files that MUST be cached for offline functionality
const PRECACHE_URLS = [
  '/',                    // Root URL - CRITICAL for PWABuilder detection
  '/index.html',          // Main page
  '/offline.html',        // Offline fallback
  '/manifest.json',       // PWA manifest
  '/app.html',           // Main app
  '/my_collection.html', // Collection page
  '/deck.html',          // Deck builder
  '/marketplace.html',   // Marketplace
  '/css/main.css',       // Main styles
  '/css/homepage.css',   // Homepage styles
  '/css/platform.css',  // Platform styles
  '/js/main.js',         // Main JavaScript
  '/js/forms.js',        // Forms JavaScript
  '/images/hatakesocial-logo.png', // Logo
  '/icons/icon-192x192.png',       // PWA icons
  '/icons/icon-512x512.png'
];

// Install event - cache critical resources
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('[SW] Caching app shell and content');
        
        // Cache critical files
        await cache.addAll(PRECACHE_URLS);
        
        // Force activation of new service worker
        await self.skipWaiting();
        
        console.log('[SW] App shell and content cached successfully');
      } catch (error) {
        console.error('[SW] Failed to cache app shell:', error);
      }
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
        
        // Take control of all clients
        await self.clients.claim();
        
        console.log('[SW] Service worker activated and ready');
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) return;
  
  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        
        // For navigation requests (HTML pages)
        if (event.request.mode === 'navigate') {
          try {
            // Try network first for navigation
            const networkResponse = await fetch(event.request);
            
            // Cache successful navigation responses
            if (networkResponse.ok) {
              await cache.put(event.request, networkResponse.clone());
            }
            
            return networkResponse;
          } catch (error) {
            console.log('[SW] Network failed for navigation, serving from cache');
            
            // Try to serve from cache
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Fallback to offline page
            return await cache.match(OFFLINE_URL);
          }
        }
        
        // For other requests (CSS, JS, images, etc.)
        // Try cache first, then network
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          // Serve from cache and update in background
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
            })
            .catch(() => {}); // Ignore network errors for background updates
          
          return cachedResponse;
        }
        
        // Not in cache, try network
        const networkResponse = await fetch(event.request);
        
        // Cache successful responses
        if (networkResponse.ok) {
          await cache.put(event.request, networkResponse.clone());
        }
        
        return networkResponse;
        
      } catch (error) {
        console.error('[SW] Fetch failed:', error);
        
        // For failed requests, try to serve offline page for HTML requests
        if (event.request.destination === 'document') {
          const cache = await caches.open(CACHE_NAME);
          return await cache.match(OFFLINE_URL);
        }
        
        // For other resources, let them fail
        throw error;
      }
    })()
  );
});

// Background Sync - for offline form submissions
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Get pending requests from IndexedDB
    const pendingRequests = await getPendingRequests();
    
    for (const request of pendingRequests) {
      try {
        await fetch(request.url, request.options);
        await removePendingRequest(request.id);
        console.log('[SW] Background sync completed for:', request.url);
      } catch (error) {
        console.error('[SW] Background sync failed for:', request.url, error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync error:', error);
  }
}

// Push notifications
self.addEventListener('push', event => {
  console.log('[SW] Push received');
  
  const options = {
    body: event.data ? event.data.text() : 'New update from HatakeSocial!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open HatakeSocial',
        icon: '/icons/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-192x192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('HatakeSocial', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification click received');
  
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
    event.waitUntil(updateContent());
  }
});

async function updateContent() {
  try {
    // Update critical content in background
    const cache = await caches.open(CACHE_NAME);
    
    // Update main pages
    const urlsToUpdate = ['/', '/app.html', '/my_collection.html'];
    
    for (const url of urlsToUpdate) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.error('[SW] Failed to update:', url);
      }
    }
    
    console.log('[SW] Content updated successfully');
  } catch (error) {
    console.error('[SW] Content update failed:', error);
  }
}

// Share Target handling
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/share') && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
  }
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const title = formData.get('title') || '';
    const text = formData.get('text') || '';
    const url = formData.get('url') || '';
    
    // Redirect to share handler page with data
    const shareUrl = `/share?title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    
    return Response.redirect(shareUrl, 302);
  } catch (error) {
    console.error('[SW] Share target error:', error);
    return new Response('Share failed', { status: 500 });
  }
}

// IndexedDB helpers for background sync
async function getPendingRequests() {
  // Simplified - in real implementation, use IndexedDB
  return [];
}

async function removePendingRequest(id) {
  // Simplified - in real implementation, use IndexedDB
  return true;
}

// Message handling for client communication
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] HatakeSocial Service Worker loaded successfully');

