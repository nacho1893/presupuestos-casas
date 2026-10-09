// Presupuestos Casas · service worker (funcionamiento sin conexión)
const VERSION = 'pc-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './css/estilos.css', './js/inicio.js', './js/app.js', './js/costo.js', './js/visor3d.js',
  './data/modelos.json', './data/precios.json', './img/icons/icon-192.png', './img/icons/icon-512.png', './img/planos/m36.png', './img/planos/m54.png', './img/planos/m63.png', './img/planos/m72.png', './img/planos/m84.png', './img/planos/m70.png', './img/planos/m86.png', './img/planos/m97.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const enRed = req => fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(ca => ca.put(req, c)); } return r; }).catch(() => caches.match(req, { ignoreSearch: true }));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // archivos propios (página, estilos, código, datos y precios): primero la red para recibir cambios, si no hay conexión lo guardado
  if (url.origin === location.origin && !url.pathname.includes('/planos/') && !url.pathname.includes('/img/')) {
    if (url.pathname.endsWith('/data/precios.json')) {
      e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(ca => ca.put('./data/precios.json', c)); return r; }).catch(() => caches.match('./data/precios.json')));
    } else e.respondWith(req.mode === 'navigate' ? fetch(req).catch(() => caches.match('./index.html')) : enRed(req));
    return;
  }
  // librerías externas (three.js, fuentes, SheetJS, JSZip), imágenes y planos: primero lo guardado
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(VERSION).then(ca => ca.put(req, c)); }
    return r;
  })));
});
