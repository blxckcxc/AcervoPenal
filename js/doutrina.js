/* ═══════════════════════════════════════════════════════════════
   doutrina.js — os três autores lado a lado

   A COLUNA VAZIA É INFORMAÇÃO, NÃO FALHA DE LAYOUT
   Quando um autor não tem posição localizada num tema, a coluna dele
   aparece assim mesmo, dizendo que não localizei. A alternativa —
   esconder a coluna e mostrar só quem tem — daria a impressão de que
   os três foram consultados e convergiram, quando na verdade um deles
   sequer foi encontrado sobre o ponto. Coluna vazia declarada é honesta;
   coluna omitida mente por silêncio.

   Cada localizador vem rotulado pelo que é: Masson tem página impressa,
   Sanches tem página do PDF (o número impresso não sobreviveu ao OCR) e
   Greco tem seção (o EPUB não traz paginação). Ver o cabeçalho de
   data/doutrina.json.
   ═══════════════════════════════════════════════════════════════ */

const Doutrina = (() => {
  const esc = (s) => Modulos.esc(s);
  const ORDEM = ["sanches", "masson", "greco"];

  const ROTULO_LOCALIZADOR = {
    paginaImpressa: "página impressa",
    paginaPdf: "página do PDF",
    secao: "seção da obra",
  };

  let dados = null;
  let modulos = [];
  let filtro = null;

  /** "art. 20, §3º" e "art. 73" viram links para o Vade Mecum. */
  function linkarArtigos(texto) {
    const seguro = esc(texto);
    return seguro.replace(
      /\b(arts?\.?|artigos?)\s*(\d{1,3})(\s*,?\s*(?:§|&sect;)\s*\d{1,2}\s*[ºo°]?)?/gi,
      (todo, prefixo, numero, paragrafo) =>
        `<a class="vm-link" href="vademecum.html#art${numero}"
            title="Abrir o art. ${numero} no Vade Mecum">${todo}</a>`
    );
  }

  function coluna(chave, tema) {
    const obra = dados.obras[chave] || {};
    const posicoes = tema.posicoes.filter((p) => p.autor === chave);

    if (!posicoes.length) {
      return `<div class="dout-coluna dout-vazia">
          <div class="dout-cab">
            <span class="dout-nome">${esc(obra.autor || chave)}</span>
          </div>
          <p class="dout-sem">Não localizei posição deste autor sobre o ponto.
          Nada é afirmado em seu nome.</p>
        </div>`;
    }

    return `<div class="dout-coluna">
        <div class="dout-cab">
          <span class="dout-nome">${esc(obra.autor || chave)}</span>
          <span class="dout-obra">${esc(obra.obra || "")}${
      obra.edicao ? ` · ${esc(obra.edicao)} ed.` : ""
    }${obra.ano ? ` · ${obra.ano}` : ""}</span>
        </div>
        ${posicoes
          .map(
            (p) => `<div class="dout-bloco">
              <span class="dout-loc" title="${esc(
                ROTULO_LOCALIZADOR[obra.tipoLocalizador] || ""
              )}">${esc(p.localizador)}</span>
              <p>${linkarArtigos(p.posicao)}</p>
              ${p.trecho ? `<blockquote>${linkarArtigos(p.trecho)}</blockquote>` : ""}
            </div>`
          )
          .join("")}
      </div>`;
  }

  function renderTema(tema) {
    const mod = modulos.find((m) => m.id === tema.moduloId);
    const presentes = new Set(tema.posicoes.map((p) => p.autor));

    return `<article class="dout-tema" id="${esc(tema.id)}">
        <header class="dout-tema-cab">
          <h2 class="dout-tema-tit">${esc(tema.titulo)}</h2>
          <div class="dout-tema-meta">
            ${
              mod
                ? `<a class="chip chip-link" href="modulo.html?m=${encodeURIComponent(
                    mod.id
                  )}">${esc(mod.titulo)}</a>`
                : ""
            }
            ${(tema.artigos || [])
              .map(
                (a) =>
                  `<a class="chip chip-link" href="vademecum.html#art${a}">art. ${a}</a>`
              )
              .join("")}
            <span class="dout-cobertura ${presentes.size === 3 ? "completa" : "parcial"}">
              ${presentes.size} de 3 autores</span>
          </div>
        </header>

        <div class="dout-colunas">${ORDEM.map((c) => coluna(c, tema)).join("")}</div>

        ${
          tema.convergencia
            ? `<p class="dout-sintese convergencia"><strong>Convergem:</strong>
               ${linkarArtigos(tema.convergencia)}</p>`
            : ""
        }
        ${
          tema.divergencia
            ? `<p class="dout-sintese divergencia"><strong>Divergem:</strong>
               ${linkarArtigos(tema.divergencia)}</p>`
            : ""
        }
        ${
          tema.notaDeAula
            ? `<p class="dout-nota-aula"><strong>Na aula:</strong> ${esc(tema.notaDeAula)}</p>`
            : ""
        }
        ${
          tema.curiosidade
            ? `<p class="dout-nota-aula">${esc(tema.curiosidade)}</p>`
            : ""
        }
        ${
          tema.alertaDeAtribuicao
            ? `<div class="alerta-bloco">
                 <p class="alerta-titulo">Atribuição que não consegui confirmar</p>
                 <p>${esc(tema.alertaDeAtribuicao.oQueOSlideDizia)}</p>
                 <p>${esc(tema.alertaDeAtribuicao.oQueVerifiquei)}</p>
                 <p>${esc(tema.alertaDeAtribuicao.comoOAcervoTrata)}</p>
               </div>`
            : ""
        }
      </article>`;
  }

  function desenhar(raiz) {
    const temas = filtro
      ? dados.temas.filter((t) => t.moduloId === filtro)
      : dados.temas;

    raiz.querySelector("#doutTemas").innerHTML = temas.length
      ? temas.map(renderTema).join("")
      : `<div class="vazio"><span class="vazio-icone" aria-hidden="true">📚</span>
         <p>Nenhum tema colhido para este módulo ainda.</p>
         <p class="nota-fonte">Só entra aqui posição com trecho localizado na obra.</p></div>`;

    raiz.querySelector("#doutContagem").textContent = filtro
      ? `${temas.length} de ${dados.temas.length} temas`
      : `${dados.temas.length} temas · ${dados.temas.reduce(
          (s, t) => s + t.posicoes.length,
          0
        )} posições localizadas`;
  }

  async function iniciar(raiz) {
    raiz.innerHTML = `<p class="vazio">Carregando a doutrina…</p>`;

    try {
      [dados, { modulos }] = await Promise.all([
        Modulos.doutrina(),
        Modulos.indice(),
      ]);
    } catch (e) {
      App.erroNaPagina(raiz, e.message);
      return;
    }

    const comTema = modulos.filter((m) => dados.temas.some((t) => t.moduloId === m.id));

    raiz.innerHTML = `
      <div class="card dout-aviso">
        <h2 class="card-titulo">Como ler os localizadores</h2>
        <p>${esc(dados.avisoDeLocalizadores.porQueNaoSaoTodosPagina)}</p>
        <ul class="dout-legenda">
          ${ORDEM.map((c) => {
            const o = dados.obras[c];
            return `<li><strong>${esc(o.autor)}</strong> —
              ${esc(ROTULO_LOCALIZADOR[o.tipoLocalizador] || o.tipoLocalizador)}.
              ${esc(dados.avisoDeLocalizadores[c] || "")}</li>`;
          }).join("")}
        </ul>
        <p class="nota-fonte">${esc(dados.avisoDeVigencia)}</p>
      </div>

      <div class="gal-filtros" id="doutFiltros">
        <button type="button" class="chip" data-m="" aria-pressed="true">
          <span class="chip-marca" aria-hidden="true">✓</span>Todos os módulos</button>
        ${comTema
          .map(
            (m) => `<button type="button" class="chip" data-m="${esc(m.id)}" aria-pressed="false">
              <span class="chip-marca" aria-hidden="true">✓</span>${esc(m.titulo)}
              <span class="chip-contagem">${
                dados.temas.filter((t) => t.moduloId === m.id).length
              }</span></button>`
          )
          .join("")}
      </div>
      <p class="vm-contagem" id="doutContagem" role="status" aria-live="polite"></p>
      <div id="doutTemas"></div>`;

    raiz.querySelectorAll("#doutFiltros .chip").forEach((b) => {
      b.addEventListener("click", () => {
        filtro = b.dataset.m || null;
        raiz
          .querySelectorAll("#doutFiltros .chip")
          .forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
        desenhar(raiz);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    desenhar(raiz);

    if (location.hash) {
      const alvo = document.getElementById(location.hash.slice(1));
      if (alvo) alvo.scrollIntoView();
    }
  }

  return { iniciar };
})();

window.Doutrina = Doutrina;
