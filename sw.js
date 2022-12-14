self.addEventListener('install', function (e) {
  e.waitUntil(caches.open('rssc').then(function (cache) {
    return cache.addAll([
      '',
      'index.html',
      'app.css',
      'app.js'
    ]);
  }));
});

self.addEventListener('fetch', function (event) {
  event.respondWith(caches.match(event.request).then(function (response) {
    return response || fetch(event.request);
  }));
});