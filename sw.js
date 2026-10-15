/* ============================================================
   Autor — service worker (PWA).
   Script clássico (sem módulos). Dá suporte a funcionamento offline:
   estratégia "rede primeiro, cache como reserva" para as páginas e
   recursos do próprio app. Requisições a outros domínios (ex.: a API
   de IA configurada pelo usuário) NÃO são interceptadas.
   ============================================================ */

const CACHE = 'autor-v5';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/storage.js',
  './js/app.js',
  './js/editor.js',
  './js/review.js',
  './js/export.js',
  './js/reader.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .catch(function () { /* segue adiante mesmo se algum recurso falhar */ })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // só cuida do próprio app; deixa o resto passar direto pela rede
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
          return res;
        }
        // servidor respondeu com erro (ex.: 5xx): usa o cache como reserva
        return caches.match(req).then(function (hit) {
          if (hit) return hit;
          if (req.mode === 'navigate') {
            return caches.match('./index.html').then(function (idx) { return idx || res; });
          }
          return res;
        });
      })
      .catch(function () {
        // sem rede: serve do cache
        return caches.match(req).then(function (hit) {
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
      })
  );
});
