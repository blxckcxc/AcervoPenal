/* ═══════════════════════════════════════════════════════════════
   modulo.js — página de um módulo

   Quatro abas: conteúdo, mapa mental, flashcards e questões.

   O SELO DE ORIGEM É A PRIMEIRA COISA QUE APARECE, e não por acaso.
   A catalogação mostrou que quatro dos oito módulos não têm material
   de aula nenhum. Quem estuda por este acervo precisa saber, antes de
   ler a primeira linha, se está diante do que o professor deu ou do
   que os manuais dizem. Esconder isso seria fingir uniformidade.
   ═══════════════════════════════════════════════════════════════ */

const Modulo = (() => {
  const esc = (s) => Modulos.esc(s);

  const ROTULO_ORIGEM = {
    aula: "material de aula",
    misto: "aula + manuais",
    manual: "a partir dos manuais",
  };

  let meta = null;
  let conteudo = null;
  let banco = [];
  let doutrina = null;
  let galeria = [];

  /* ── Flashcards ───────────────────────────────────────────
     A repetição espaçada já existia em progress.js (1 → 3 → 7 → 30
     dias, persistida em localStorage), mas era invisível: o estudante
     respondia e nada lhe dizia quando aquele cartão voltaria, nem
     quantos estavam vencidos hoje. Um sistema de revisão que não mostra
     o próprio estado vira um baralho embaralhado ao acaso — some
     justamente a razão de existir do método.

     Agora a aba abre com o estado do baralho e cada resposta informa o
     próximo intervalo. ─────────────────────────────────────────────── */

  const INTERVALOS = [1, 3, 7, 30];

  function estadoDoBaralho(cards) {
    const p = Progresso.doModulo(meta.id);
    const agora = Date.now();
    let novos = 0;
    let vencidos = 0;
    let agendados = 0;
    let dominados = 0;
    let proxima = null;

    for (let i = 0; i < cards.length; i++) {
      const c = p.cards[i];
      if (!c || !c.proximaEm) {
        novos++;
        continue;
      }
      const quando = new Date(c.proximaEm).getTime();
      if (c.nivel >= 2) dominados++;
      if (quando <= agora) vencidos++;
      else {
        agendados++;
        if (proxima === null || quando < proxima) proxima = quando;
      }
    }
    return { novos, vencidos, agendados, dominados, proxima, total: cards.length };
  }

  function emQuantoTempo(ms) {
    const dias = Math.ceil((ms - Date.now()) / 86400000);
    if (dias <= 0) return "hoje";
    if (dias === 1) return "amanhã";
    return `em ${dias} dias`;
  }

  function abaFlashcards(alvo) {
    const cards = (conteudo && conteudo.flashcards) || [];
    if (!cards.length) {
      alvo.innerHTML = `<div class="vazio"><span class="vazio-icone" aria-hidden="true">🗂</span>
        <p>Este módulo ainda não tem flashcards.</p></div>`;
      return;
    }

    let fila = Progresso.cardsParaHoje(meta.id, cards.length);
    let revisandoTudo = false;
    let pos = 0;
    let ultimo = null; // feedback da resposta anterior

    const painelEstado = () => {
      const e = estadoDoBaralho(cards);
      return `<div class="baralho-estado">
          <div class="grade-stats">
            <div class="stat"><div class="stat-valor">${e.vencidos + e.novos}</div>
              <div class="stat-rotulo">para hoje</div></div>
            <div class="stat"><div class="stat-valor">${e.novos}</div>
              <div class="stat-rotulo">nunca vistos</div></div>
            <div class="stat"><div class="stat-valor">${e.dominados}</div>
              <div class="stat-rotulo">dominados</div></div>
            <div class="stat"><div class="stat-valor">${e.total}</div>
              <div class="stat-rotulo">no baralho</div></div>
          </div>
          ${
            e.proxima
              ? `<p class="nota-fonte">Próxima revisão agendada ${emQuantoTempo(e.proxima)}.
                 Intervalos: 1 → 3 → 7 → 30 dias, e errar devolve o cartão ao início.</p>`
              : `<p class="nota-fonte">Intervalos: 1 → 3 → 7 → 30 dias.
                 Acertar sobe um degrau; errar devolve o cartão ao início.</p>`
          }
        </div>`;
    };

    const desenhar = () => {
      if (pos >= fila.length) {
        const e = estadoDoBaralho(cards);
        alvo.innerHTML = `
          ${painelEstado()}
          <div class="vazio">
            <span class="vazio-icone" aria-hidden="true">✓</span>
            <p>${
              fila.length
                ? `Fila concluída — ${fila.length} cartão(ões) revisado(s).`
                : "Nenhum cartão vencido hoje."
            }</p>
            <p class="nota-fonte">${
              e.proxima
                ? `Os próximos vencem ${emQuantoTempo(e.proxima)}.`
                : "Todos os cartões já foram agendados."
            }</p>
            <button type="button" class="btn btn-primario" id="btnRevisarTudo">
              Revisar o baralho inteiro assim mesmo
            </button>
          </div>`;
        alvo.querySelector("#btnRevisarTudo").addEventListener("click", () => {
          fila = cards.map((_, i) => i);
          revisandoTudo = true;
          pos = 0;
          ultimo = null;
          desenhar();
        });
        return;
      }

      const i = fila[pos];
      const c = cards[i];
      const nivel = Progresso.estadoCard(meta.id, i).nivel;

      alvo.innerHTML = `
        ${painelEstado()}
        ${
          ultimo
            ? `<p class="card-feedback ${ultimo.acertou ? "ok" : "nok"}">
                 ${ultimo.acertou ? "Acertou" : "Errou"} — esse cartão volta ${ultimo.quando}.</p>`
            : ""
        }
        <p class="flashcard-dica">
          Cartão ${pos + 1} de ${fila.length}${revisandoTudo ? " (baralho inteiro)" : ""} ·
          nível ${nivel} de ${INTERVALOS.length} ·
          clique para virar · <kbd>Espaço</kbd> vira · <kbd>1</kbd> não sei · <kbd>2</kbd> sei
        </p>
        <div class="flashcard" id="cartao" tabindex="0" role="button" aria-label="Virar o cartão">
          <div class="flashcard-inner">
            <div class="flashcard-face">${esc(c.frente)}</div>
            <div class="flashcard-face flashcard-verso">${esc(c.verso)}</div>
          </div>
        </div>
        <div class="sim-acoes-inline">
          <button type="button" class="btn" id="btnNaoSei">Ainda não sei</button>
          <button type="button" class="btn btn-primario" id="btnSei">Sei</button>
        </div>`;

      const cartao = alvo.querySelector("#cartao");
      const virar = () => cartao.classList.toggle("virado");
      cartao.addEventListener("click", virar);

      const responder = (acertou) => {
        Progresso.registrarCard(meta.id, i, acertou, cards.length);
        document.dispatchEvent(new CustomEvent("progresso:mudou"));
        const depois = Progresso.estadoCard(meta.id, i);
        ultimo = {
          acertou,
          quando: depois.proximaEm ? emQuantoTempo(new Date(depois.proximaEm).getTime()) : "hoje",
        };
        pos++;
        desenhar();
      };
      alvo.querySelector("#btnSei").addEventListener("click", () => responder(true));
      alvo.querySelector("#btnNaoSei").addEventListener("click", () => responder(false));

      cartao.focus();
      const teclas = (e) => {
        if (!document.body.contains(cartao)) {
          document.removeEventListener("keydown", teclas);
          return;
        }
        if (e.key === " ") {
          e.preventDefault();
          virar();
        }
        if (e.key === "1") responder(false);
        if (e.key === "2" || e.key === "3") responder(true);
      };
      document.addEventListener("keydown", teclas);
    };

    desenhar();
  }

  /* ── Mapa mental ──────────────────────────────────────────── */

  function abaMapa(alvo) {
    const mapa = conteudo && conteudo.mapaMental;
    const fotos = galeria.filter((g) => (g.modulos || []).includes(meta.ordem));

    if (!mapa && !fotos.length) {
      alvo.innerHTML = `<div class="vazio"><span class="vazio-icone" aria-hidden="true">🕸</span>
        <p>Este módulo não tem mapa mental nem imagens vinculadas.</p></div>`;
      return;
    }

    alvo.innerHTML =
      (mapa
        ? `<div class="card">
             <h3 class="card-titulo">${esc(mapa.titulo)}</h3>
             ${desenharMapa(mapa)}
             ${mapa.fonte ? `<p class="nota-fonte">Fonte: ${esc(mapa.fonte)}</p>` : ""}
           </div>`
        : "") +
      (fotos.length
        ? `<section class="secao" style="margin-top: var(--esp-8)">
             <h3 class="secao-titulo">Imagens da aula que servem a este módulo</h3>
             <div class="gal-grade">
               ${fotos
                 .map(
                   (f) => `<a class="gal-item" href="galeria.html">
                     <img src="img/thumb/${esc(f.arquivo)}" alt="${esc(f.tema)}" loading="lazy">
                     <span class="gal-item-legenda">${esc(f.tema)}</span></a>`
                 )
                 .join("")}
             </div>
           </section>`
        : "");
  }

  /** Mapa mental em SVG, desenhado a partir de uma árvore simples. */
  function desenharMapa(mapa) {
    const ramos = mapa.ramos || [];
    const alturaLinha = 34;
    const alturaTotal = Math.max(
      200,
      ramos.reduce((s, r) => s + Math.max(1, (r.folhas || []).length) * alturaLinha, 0) + 40
    );
    const larg = 720;

    let y = 30;
    let corpo = "";

    ramos.forEach((r) => {
      const nFolhas = Math.max(1, (r.folhas || []).length);
      const yRamo = y + ((nFolhas - 1) * alturaLinha) / 2;

      corpo += `<path d="M180 ${alturaTotal / 2} C 240 ${alturaTotal / 2}, 240 ${yRamo}, 300 ${yRamo}"
          fill="none" stroke="var(--vinho)" stroke-width="2"/>`;
      corpo += `<text x="308" y="${yRamo}" class="mapa-ramo" dominant-baseline="middle">${esc(r.titulo)}</text>`;

      (r.folhas || []).forEach((f, k) => {
        const yf = y + k * alturaLinha;
        corpo += `<path d="M520 ${yRamo} C 545 ${yRamo}, 545 ${yf}, 570 ${yf}"
            fill="none" stroke="var(--borda-forte)" stroke-width="1.5"/>`;
        corpo += `<text x="578" y="${yf}" class="mapa-folha" dominant-baseline="middle">${esc(f)}</text>`;
      });

      y += nFolhas * alturaLinha;
    });

    return `<div class="tabela-scroll">
      <svg class="mapa" viewBox="0 0 ${larg} ${alturaTotal}" role="img"
           aria-label="Mapa mental de ${esc(mapa.titulo)}" style="min-width:720px">
        <rect x="20" y="${alturaTotal / 2 - 22}" width="160" height="44" rx="10"
              fill="var(--vinho)" />
        <text x="100" y="${alturaTotal / 2}" class="mapa-raiz" text-anchor="middle"
              dominant-baseline="middle">${esc(mapa.raiz)}</text>
        ${corpo}
      </svg></div>`;
  }

  /* ── Doutrina ─────────────────────────────────────────────── */

  function abaDoutrina(alvo) {
    const temas = doutrina
      ? doutrina.temas.filter((t) => t.moduloId === meta.id)
      : [];

    if (!temas.length) {
      alvo.innerHTML = `<div class="vazio"><span class="vazio-icone" aria-hidden="true">📚</span>
        <p>Ainda não colhi doutrina comparada para este módulo.</p>
        <p class="nota-fonte">Só entra aqui posição com trecho localizado na obra.</p></div>`;
      return;
    }

    alvo.innerHTML =
      temas
        .map(
          (t) => `<section class="card">
            <h3 class="card-titulo">${esc(t.titulo)}</h3>
            ${t.posicoes
              .map((p) => {
                const o = (doutrina.obras || {})[p.autor] || {};
                return `<div class="doutrina-posicao">
                  <div class="doutrina-autor">${esc(o.autor || p.autor)}
                    <span class="doutrina-loc">${esc(p.localizador)}${o.ano ? " · " + o.ano : ""}</span>
                  </div>
                  <p>${esc(p.posicao)}</p>
                  ${p.trecho ? `<blockquote>${esc(p.trecho)}</blockquote>` : ""}
                </div>`;
              })
              .join("")}
            ${t.convergencia ? `<p class="doutrina-nota"><strong>Convergência:</strong> ${esc(t.convergencia)}</p>` : ""}
            ${t.divergencia ? `<p class="doutrina-nota"><strong>Divergência:</strong> ${esc(t.divergencia)}</p>` : ""}
            ${t.notaDeAula ? `<p class="nota-fonte">${esc(t.notaDeAula)}</p>` : ""}
            ${
              t.alertaDeAtribuicao
                ? `<div class="alerta-bloco" style="margin-top:var(--esp-4)">
                     <p class="alerta-titulo">Atribuição não confirmada</p>
                     <p>${esc(t.alertaDeAtribuicao.oQueOSlideDizia)}</p>
                     <p>${esc(t.alertaDeAtribuicao.oQueVerifiquei)}</p>
                     <p>${esc(t.alertaDeAtribuicao.comoOAcervoTrata)}</p>
                   </div>`
                : ""
            }
          </section>`
        )
        .join("") +
      `<p class="nota-fonte">${esc(doutrina.avisoDeVigencia)}
       ${esc(doutrina.avisoDeLocalizadores.porQueNaoSaoTodosPagina)}</p>`;
  }

  /* ── Abas ─────────────────────────────────────────────────── */

  function montarAbas(raiz) {
    const abas = [
      { id: "conteudo", rotulo: "Conteúdo" },
      { id: "mapa", rotulo: "Mapa mental" },
      { id: "doutrina", rotulo: "Doutrina" },
      { id: "flashcards", rotulo: "Flashcards" },
      { id: "questoes", rotulo: `Questões (${banco.length})` },
    ];

    raiz.querySelector("#abas").innerHTML = abas
      .map(
        (a, i) => `<button type="button" class="aba" role="tab" data-aba="${a.id}"
          aria-selected="${i === 0}">${esc(a.rotulo)}</button>`
      )
      .join("");

    const painel = raiz.querySelector("#painel");

    const abrir = (id) => {
      raiz
        .querySelectorAll(".aba")
        .forEach((b) => b.setAttribute("aria-selected", String(b.dataset.aba === id)));
      painel.innerHTML = "";

      if (id === "conteudo") {
        if (!conteudo || !(conteudo.secoes || []).length) {
          painel.innerHTML = `<div class="vazio"><span class="vazio-icone" aria-hidden="true">📄</span>
            <p>O conteúdo deste módulo ainda não foi escrito.</p></div>`;
        } else {
          Modulos.montarAccordion(painel, conteudo.secoes, meta.id);
        }
      } else if (id === "mapa") abaMapa(painel);
      else if (id === "doutrina") abaDoutrina(painel);
      else if (id === "flashcards") abaFlashcards(painel);
      else if (id === "questoes") {
        if (!banco.length) {
          painel.innerHTML = `<div class="vazio"><span class="vazio-icone" aria-hidden="true">✎</span>
            <p>Sem questões objetivas para este módulo.</p>
            <p class="nota-fonte">O <a href="simulador.html">simulador</a> tem 8 casos
            práticos deste assunto.</p></div>`;
        } else {
          Quiz.criar(painel, Quiz.embaralhar(banco), { moduloId: meta.id });
        }
      }
    };

    raiz.querySelectorAll(".aba").forEach((b) => {
      b.addEventListener("click", () => abrir(b.dataset.aba));
    });
    abrir("conteudo");
  }

  /* ── Entrada ──────────────────────────────────────────────── */

  async function iniciar(raiz, id) {
    if (!id) {
      App.erroNaPagina(raiz, "Nenhum módulo indicado na URL (falta ?m=…).");
      return;
    }

    raiz.innerHTML = `<p class="vazio">Carregando o módulo…</p>`;

    let indice;
    try {
      indice = await Modulos.indice();
    } catch (e) {
      App.erroNaPagina(raiz, e.message);
      return;
    }

    meta = indice.modulos.find((m) => m.id === id);
    if (!meta) {
      App.erroNaPagina(raiz, `Não existe módulo com id "${id}".`);
      return;
    }

    document.title = `${meta.titulo} — Acervo Penal`;
    document.getElementById("tituloPagina").textContent = meta.titulo;
    document.getElementById("subPagina").textContent = meta.resumo;

    // Cada peça é opcional: o módulo abre mesmo sem conteúdo escrito.
    try {
      conteudo = await Modulos.modulo(meta.arquivo);
    } catch (e) {
      conteudo = null;
    }
    try {
      const b = await Modulos.bancoQuestoes();
      banco = b.bancos[meta.id] || [];
    } catch (e) {
      banco = [];
    }
    try {
      doutrina = await Modulos.doutrina();
    } catch (e) {
      doutrina = null;
    }
    try {
      const g = await Modulos.carregarJSON("data/galeria.json");
      galeria = g.itens || [];
    } catch (e) {
      galeria = [];
    }

    const casos = 8; // o banco tem 2 casos por nível em cada módulo

    raiz.innerHTML = `
      <div class="mod-selo-linha">
        <span class="selo-fonte selo-${esc(meta.origem)}">${esc(
      ROTULO_ORIGEM[meta.origem] || meta.origem
    )}</span>
        ${
          meta.artigos && meta.artigos.length
            ? `<span class="sim-ajuda" style="margin:0">arts. ${meta.artigos.join(", ")} do CP</span>`
            : ""
        }
        <a class="btn btn-sm" href="simulador.html">${casos} casos práticos deste módulo</a>
      </div>
      <p class="mod-aviso-origem">${esc(meta.notaOrigem)}</p>
      <div class="mod-abas" id="abas" role="tablist"></div>
      <div id="painel" role="tabpanel"></div>`;

    montarAbas(raiz);
  }

  return { iniciar };
})();

window.Modulo = Modulo;
