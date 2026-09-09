/* ═══════════════════════════════════════════════════════════════
   sw.js — service worker do Acervo Penal

   O acervo é inteiramente estático, então a estratégia certa é a mais
   simples: baixa tudo na instalação e passa a servir do cache. Depois
   da primeira visita, funciona sem rede.

   Por requisição: responde do cache na hora e revalida em segundo
   plano (stale-while-revalidate). A abertura fica instantânea e a
   versão nova entra na abertura seguinte.

   SOBRE A VERSÃO DO CACHE
   No projeto irmão, `CACHE` era um número incrementado à mão e a lista
   de precache tinha 56 caminhos mantidos à mão. Esquecer qualquer um
   dos dois quebrava o offline em silêncio. Aqui os dois são gerados
   por `node build.js`: a lista vem de uma varredura do disco e a versão
   é um hash do conteúdo. Não edite o bloco entre os marcadores.

   O ÁUDIO DA AULA FICA DE FORA, e de propósito: são 38,8 MB. Precachear
   isso empurraria o download inteiro para o celular de quem só queria
   ler um módulo. Além disso, o player usa requisições Range para
   permitir arrastar a barra, e a Cache API não lida bem com respostas
   parciais — interceptar só atrapalharia. O áudio passa direto para a
   rede e fica com o cache HTTP normal do navegador.
   ═══════════════════════════════════════════════════════════════ */

const CACHE = "acervo-penal-1c4480f9a2";

/* INICIO-PRECACHE — gerado por build.js, não edite à mão */
const ARQUIVOS = [
  "./",
  "aula.html",
  "css/base.css",
  "css/components.css",
  "css/layout.css",
  "css/paginas.css",
  "css/simulador.css",
  "css/variables.css",
  "data/_fontes.json",
  "data/audio_capitulos.json",
  "data/bundle.js",
  "data/casos_praticos.json",
  "data/culpabilidade.json",
  "data/dolo-e-culpa.json",
  "data/doutrina.json",
  "data/erro-de-tipo.json",
  "data/galeria.json",
  "data/ilicitude.json",
  "data/iter-criminis.json",
  "data/lei-penal-no-tempo.json",
  "data/modules.json",
  "data/principios.json",
  "data/quiz-bank.json",
  "data/teoria-do-crime.json",
  "data/vademecum.json",
  "doutrina.html",
  "favicon.ico",
  "galeria.html",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "js/app.js",
  "js/aula.js",
  "js/corretor.js",
  "js/doutrina.js",
  "js/exam.js",
  "js/galeria.js",
  "js/inicio.js",
  "js/modules.js",
  "js/modulo.js",
  "js/progress.js",
  "js/quiz.js",
  "js/simulador.js",
  "js/storage.js",
  "js/vademecum.js",
  "manifest.json",
  "modulo.html",
  "prova.html",
  "quiz.html",
  "simulador.html",
  "vademecum.html",
];
/* FIM-PRECACHE */

/* ── Instalação: baixa tudo ─────────────────────────────────────
   addAll é tudo-ou-nada: um único 404 aborta a instalação inteira e
   o app ficaria sem cache nenhum. Por isso cada arquivo vai em uma
   requisição própria, e uma falha isolada não derruba o resto.      */
self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        ARQUIVOS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {
            console.warn("[sw] não consegui cachear:", url);
          })
        )
      );
      await self.skipWaiting();
    })()
  );
});

/* ── Ativação: apaga as versões anteriores ────────────────────── */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

/* ── Requisições ────────────────────────────────────────────────
   Só GET de mesma origem. Links para o Planalto e para o YouTube
   passam direto, sem interceptação.                                */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Áudio: nunca intercepta. Ver a nota do cabeçalho sobre Range.
  if (/\.(m4a|mp3|ogg|wav)$/i.test(url.pathname)) return;
  if (req.headers.has("range")) return;

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      // ignoreSearch porque ?m=<modulo> não muda o arquivo servido.
      const cacheada = await cache.match(req, { ignoreSearch: true });

      const rede = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      if (cacheada) return cacheada;

      const res = await rede;
      if (res) return res;

      if (req.mode === "navigate") {
        const inicial = await cache.match("index.html");
        if (inicial) return inicial;
      }

      return new Response("Sem conexão e sem cópia local deste recurso.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    })()
  );
});
