/* EduKids — service worker
   Objetivo: a app abre offline, mas quando há internet mostra SEMPRE a versão mais recente
   do GitHub Pages (network-first), e uma versão nova de sw.js ativa-se logo (skipWaiting).
   Mudar qualquer byte deste ficheiro (por exemplo, a VERSAO) faz o telemóvel instalar a
   atualização na próxima vez que a app abrir. */
const VERSAO = 'edukids-2026-09-21-1';
const CACHE = VERSAO;
const ESPERA_REDE_MS = 5000; // sem resposta em 5 s, usa a cópia guardada (rede lenta/fraca)

self.addEventListener('install', (evento) => {
  self.skipWaiting(); // não esperar que a app seja fechada para ativar a versão nova
  evento.waitUntil(
    caches.open(CACHE)
      .then((c) => c.add(new Request('./', { cache: 'reload' })))
      .catch(() => {}) // sem rede na instalação: as visitas seguintes preenchem o cache
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function redeComLimite(pedido, ms){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(pedido).then(
      (r) => { clearTimeout(t); resolve(r); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

// Rede primeiro (ignorando a cache HTTP do GitHub Pages, que guarda 10 min); se falhar ou
// demorar, usa a cópia guardada.
async function redePrimeiro(pedido, chaveCache){
  const cache = await caches.open(CACHE);
  const pedidoFresco = new Request(pedido.url, { cache: 'no-cache', credentials: 'same-origin' });
  try{
    const resposta = await redeComLimite(pedidoFresco, ESPERA_REDE_MS);
    if(resposta && resposta.ok){ cache.put(chaveCache || pedido.url, resposta.clone()).catch(() => {}); }
    return resposta;
  }catch(erro){
    const guardada = await cache.match(chaveCache || pedido.url, { ignoreSearch: true })
                  || await cache.match('./', { ignoreSearch: true });
    if(guardada) return guardada;
    return fetch(pedidoFresco); // nada guardado: tenta a rede sem limite de tempo
  }
}

// Guardado primeiro e atualizado em segundo plano (para os módulos Firebase do CDN).
async function guardadoEAtualiza(pedido){
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(pedido);
  const emRede = fetch(pedido).then((r) => {
    if(r && r.ok) cache.put(pedido, r.clone()).catch(() => {});
    return r;
  }).catch(() => guardada);
  return guardada || emRede;
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if(pedido.method !== 'GET') return;
  const url = new URL(pedido.url);

  // Páginas da própria app (e ícones/ficheiros do mesmo site): rede primeiro.
  if(url.origin === self.location.origin){
    const chave = pedido.mode === 'navigate' ? './' : pedido.url;
    evento.respondWith(redePrimeiro(pedido, chave));
    return;
  }
  // Módulos do Firebase (CDN da Google): cópia local + atualização em segundo plano.
  if(url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0){
    evento.respondWith(guardadoEAtualiza(pedido));
    return;
  }
  // Tudo o resto (Firestore, autenticação, IA…) passa direto, sem cache.
});
