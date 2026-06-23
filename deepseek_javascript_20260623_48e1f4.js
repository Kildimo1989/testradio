const CACHE = 'irish-radio-v2';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install event - cache assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first for streams, cache for assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // Don't cache stream URLs
  if (url.href.includes('.m3u8') || url.href.includes('.mp3') || url.href.includes('stream')) {
    e.respondWith(fetch(e.request));
    return;
  }
  
  // Cache static assets
  e.respondWith(
    caches.match(e.request)
      .then(response => response || fetch(e.request))
  );
});