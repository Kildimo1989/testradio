const CACHE_NAME = 'radio-wave-v2';
const ASSETS = [
  './index.html',
  './app.js',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('.mp3') || e.request.url.includes('.m3u8') || e.request.url.includes('stream')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});