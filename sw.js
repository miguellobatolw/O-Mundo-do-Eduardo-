// Service Worker da EduKids — permite abrir e usar a app mesmo sem rede, depois de
// pelo menos uma visita com rede. Como a app é um único ficheiro HTML autossuficiente
// (CSS, JS e imagens já embutidos), só é preciso cachear o próprio index.html.
//
// IMPORTANTE: subir a versão do cache (CACHE_NOME) sempre que o index.html for
// atualizado no repositório — sem isso, quem já tem o Service Worker instalado
// continua a ver a versão antiga em cache mesmo depois de tu publicares uma nova,
// até o browser decidir por si só verificar de novo (pode demorar).
const CACHE_NOME = 'edukids-cache-v1';
const FICHEIRO_PRINCIPAL = './index.html';

// Instalação: guarda o ficheiro principal em cache assim que o Service Worker é
// instalado pela primeira vez (normalmente na primeira visita com rede).
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.add(FICHEIRO_PRINCIPAL))
  );
  // Ativa este Service Worker imediatamente, sem esperar que todas as abas antigas
  // fechem — importante para uma app usada em sessões curtas e frequentes.
  self.skipWaiting();
});

// Ativação: remove versões antigas do cache (de uma versão anterior deste ficheiro),
// para não acumular ficheiros desatualizados no dispositivo indefinidamente.
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) => nome !== CACHE_NOME)
          .map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

// Estratégia "network first, cache fallback": tenta sempre a rede primeiro (para a
// Celeste ver atualizações assim que existam), e só usa a versão em cache se a rede
// falhar ou demorar — é o que garante que a app abre mesmo offline.
self.addEventListener('fetch', (evento) => {
  // Só intercepta pedidos de navegação (abrir a página em si), não pedidos de outro
  // tipo — não há mais nada para cachear, já que tudo vive dentro do próprio HTML.
  if(evento.request.mode !== 'navigate') return;

  evento.respondWith(
    fetch(evento.request)
      .then((respostaDaRede) => {
        // Rede disponível: atualiza a cache com a versão mais recente para a próxima
        // vez que a app for aberta sem rede, e devolve essa mesma resposta agora.
        const copia = respostaDaRede.clone();
        caches.open(CACHE_NOME).then((cache) => cache.put(FICHEIRO_PRINCIPAL, copia));
        return respostaDaRede;
      })
      .catch(() => {
        // Sem rede: serve a última versão guardada em cache, se existir.
        return caches.match(FICHEIRO_PRINCIPAL);
      })
  );
});
