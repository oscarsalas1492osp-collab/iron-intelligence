// Service worker: permite abrir la app sin conexión.
// Los datos del usuario NO viven aquí: están en IndexedDB y se sincronizan con Supabase.
const CACHE = 'iron-shell-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Red primero; si falla, caché. Así las actualizaciones llegan y sin red la app igual abre.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      // ignoreVary: los archivos se guardan también desde la página y sus cabeceras difieren de las de <script>.
      .catch(() => caches.match(req, { ignoreVary: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
