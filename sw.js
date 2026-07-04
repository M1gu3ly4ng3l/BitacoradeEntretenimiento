// Service Worker de la Bitácora
// Estrategia: "network-first" para el HTML (para que siempre agarres la versión
// más nueva que subas a GitHub cuando haya internet), con respaldo en caché para
// cuando no haya conexión. Así nunca hay que tocar este archivo al actualizar la app.

const CACHE_NAME = 'bitacora-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return; // no interferir con las llamadas a la API de Drive, etc.

  const url = new URL(req.url);
  if(url.origin !== self.location.origin){
    return; // deja pasar directo las llamadas externas (Google Drive, fuentes, etc.)
  }

  const isNavigation = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if(isNavigation){
    // Network-first: intenta traer lo último; si falla (sin internet), usa la copia guardada
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Resto de archivos propios (manifest, íconos): cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if(cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
