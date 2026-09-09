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

  /* ── Flashcards ───────────────────────────────────────────── */

  function abaFlashcards(alvo) {
    const cards = (conteudo && conteudo.flashcards) || [];
    if (!cards.length) {
      alvo.innerHTML = `<div class="vazio"><span class="vazio-icone" aria-hidden="true">🗂</span>
        <p>Este módulo ainda não tem flashcards.</p></div>`;
      return;
    }

    let fila = Progresso.cardsParaHoje(meta.id, cards.length);
    if (!fila.length) fila = cards.map((_, i) => i);
    let pos = 0;

    const desenhar = () => {
      if (pos >= fila.length) {
        alvo.innerHTML = `<div class="vazio"><span class="vazio-icone" aria-hidden="true">✓</span>
          <p>Fila do dia concluída — ${fila.length} cartões revisados.</p>
          <button type="button" class="btn btn-primario" id="btnRefazerCards">Revisar tudo de novo</button></div>`;
        alvo.querySelector("#btnRefazerCards").addEventListener("click", () => {
          fila = cards.map((_, i) => i);
          pos = 0;
          desenhar();
        });
        return;
      }

      const i = fila[pos];
      const c = cards[i];

      alvo.innerHTML = `
        <p class="flashcard-dica">Cartão ${pos + 1} de ${fila.length} ·
          clique para virar · <kbd>Espaço</kbd> vira · <kbd>1</kbd> não sei · <kbd>2</kbd> sei</p>
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
             ${mapa.fonte ? `<p class="sim-nota-fonte">Fonte: ${esc(mapa.fonte)}</p>` : ""}
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
            fill="none" stroke="var(--ambar-escuro)" stroke-width="1.5"/>`;
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
        <p class="sim-nota-fonte">Só entra aqui posição com trecho localizado na obra.</p></div>`;
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
            ${t.notaDeAula ? `<p class="sim-nota-fonte">${esc(t.notaDeAula)}</p>` : ""}
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
      `<p class="sim-nota-fonte">${esc(doutrina.avisoDeVigencia)}
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
            <p class="sim-nota-fonte">O <a href="simulador.html">simulador</a> tem 8 casos
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
