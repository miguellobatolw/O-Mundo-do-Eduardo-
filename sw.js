// Service Worker do EduKids — permite abrir e usar a app sem rede depois da primeira
// visita (quando publicada em HTTPS, como o GitHub Pages). Não interfere com o Firebase
// (login/sincronização continuam a precisar de rede quando disponível); cobre apenas os
// ficheiros estáticos da própria app.

const NOME_CACHE = 'edukids-cache-v1';

// Ficheiros a guardar em cache assim que o service worker é instalado. Ajustar esta lista
// se a app passar a ter mais páginas ou ficheiros próprios (ex: manifest.json, ícones).
const FICHEIROS_ESSENCIAIS = [
  './',
  './index.html',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(NOME_CACHE).then((cache) => {
      // addAll falha por inteiro se um só ficheiro desta lista não existir — por isso a
      // lista acima é propositadamente curta e certa, em vez de tentar adivinhar caminhos.
      return cache.addAll(FICHEIROS_ESSENCIAIS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  // Remove caches de versões antigas do service worker, para não acumular ficheiros
  // desatualizados indefinidamente no dispositivo do utilizador.
  evento.waitUntil(
    caches.keys().then((chaves) => {
      return Promise.all(
        chaves
          .filter((chave) => chave !== NOME_CACHE)
          .map((chave) => caches.delete(chave))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  // Só intercepta pedidos GET normais da própria origem — nunca chamadas ao Firebase,
  // Firestore ou a qualquer API externa (essas continuam a ir sempre à rede real).
  if(evento.request.method !== 'GET') return;
  const url = new URL(evento.request.url);
  if(url.origin !== self.location.origin) return;

  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      // Estratégia "cache primeiro, rede como recurso": se já está em cache, serve
      // imediatamente (rápido, funciona offline); tenta atualizar o cache em segundo
      // plano sempre que há rede, para a próxima vez já vir a versão mais recente.
      const buscarERenovar = fetch(evento.request).then((respostaRede) => {
        if(respostaRede && respostaRede.status === 200){
          const copia = respostaRede.clone();
          caches.open(NOME_CACHE).then((cache) => cache.put(evento.request, copia));
        }
        return respostaRede;
      }).catch(() => respostaCache); // sem rede: cai para o que já estiver em cache

      return respostaCache || buscarERenovar;
    })
  );
});
