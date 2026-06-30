// Service worker — estrategia "stale-while-revalidate".
//
// Por que essa estrategia: o app responde na hora a partir do cache (rapido e
// funciona offline) e, em paralelo, busca a versao nova na rede e atualiza o
// cache para a PROXIMA abertura. Resultado: nao e mais preciso incrementar o
// CACHE_NAME a cada mudanca — as alteracoes chegam sozinhas ao recarregar.
//
// Quando adicionar um novo arquivo (ex.: data/<novo>.json), inclua-o em ASSETS
// para que fique disponivel offline desde a primeira vez.
const CACHE_NAME = 'corrida-v3';
const ASSETS = [
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './sounds/run.mp3',
  './sounds/walk.mp3',
  './sounds/done.mp3',
  './data/programs.json',
  './data/c25k_16week.json',
  './data/10k_16week.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          // so cacheia respostas validas do mesmo origin
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(e.request, res.clone());
          }
          return res;
        }).catch(() => cached); // offline: usa o cache
        // responde com o cache imediatamente; atualiza em segundo plano
        return cached || network;
      })
    )
  );
});
