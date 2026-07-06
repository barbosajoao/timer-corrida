// Service worker — estrategia "stale-while-revalidate".
//
// Por que essa estrategia: o app responde na hora a partir do cache (rapido e
// funciona offline) e, em paralelo, busca a versao nova na rede e atualiza o
// cache para a PROXIMA abertura.
//
// IMPORTANTE: incremente o CACHE_NAME (corrida-vN) A CADA modificacao. Sem o
// bump, o navegador serve o codigo antigo do cache e as mudancas so chegam
// depois de recarregar duas vezes — o que ja causou bugs de codigo
// desatualizado. Trocar a versao forca a reinstalacao e o rebaixo da rede.
//
// Quando adicionar um novo arquivo (ex.: data/<novo>.json), inclua-o em ASSETS
// para que fique disponivel offline desde a primeira vez.
const CACHE_NAME = 'corrida-v8';
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
  // Cacheia os assets individualmente: uma falha pontual (ex: conexao instavel)
  // nao aborta a instalacao inteira do service worker.
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS.map(url =>
        cache.add(url).catch(err => console.warn('[SW] falhou ao cachear', url, err))
      ))
    )
  );
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


// Responde a versao (CACHE_NAME) para o app poder exibir qual codigo esta
// realmente em execucao. O app envia 'GET_VERSION' via MessageChannel.
self.addEventListener('message', e => {
  if (e.data === 'GET_VERSION') {
    const reply = { type: 'VERSION', version: CACHE_NAME };
    if (e.ports && e.ports[0]) e.ports[0].postMessage(reply);
    else if (e.source) e.source.postMessage(reply);
  }
});
