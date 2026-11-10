// Mi Entreno: funciona sin conexión. La página se pide primero a la red (para recibir
// actualizaciones) con un límite de 3 s; si no hay cobertura, se usa la copia guardada.
const VERSION = 'entreno-3.9.0';
const CORE = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './inter.woff2'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== 'entreno-fotos-2').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function timeout(ms) { return new Promise(r => setTimeout(r, ms)); }
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // Google (inicio de sesión y Drive): siempre directo a la red, nunca en caché
  if (/(^|\.)googleapis\.com$|(^|\.)google\.com$/.test(url.hostname) && !/^fonts\./.test(url.hostname)) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match('./index.html');
      const net = fetch(req).then(r => { if (r.ok) cache.put('./index.html', r.clone()); return r; });
      if (!cached) return net;
      return Promise.race([net.catch(() => cached), timeout(3000).then(() => cached)]);
    })());
    return;
  }
  // Fotos de Unsplash: se guardan la primera vez para verlas sin conexión
  if (url.hostname === 'images.unsplash.com') {
    e.respondWith(caches.open('entreno-fotos-2').then(async cache => {
      const hit = await cache.match(req.url);
      if (hit) return hit;
      // Unsplash permite CORS: así la foto se guarda con su tamaño real (las «opacas» cuentan ~7 MB cada una)
      const r = await fetch(req.url, { mode: 'cors', credentials: 'omit' }).catch(() => fetch(req));
      if (r.ok) cache.put(req.url, r.clone());
      return r;
    }));
    return;
  }
  // Fuentes y archivos propios: primero la caché
  if (url.origin === location.origin || /^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(VERSION).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') cache.put(req, r.clone());
      return r;
    }));
  }
});
