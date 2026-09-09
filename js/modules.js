/* ═══════════════════════════════════════════════════════════════
   modules.js — carregamento dos dados e renderização do conteúdo

   SOBRE O CARREGAMENTO
   Abrir index.html direto (file://) faz o Chrome bloquear fetch de
   arquivos locais por CORS. Para o acervo funcionar com duplo clique,
   os JSON também são embutidos em data/bundle.js.

   A ordem é: tenta fetch (funciona se você servir por HTTP e permite
   editar o JSON sem rebuild); se falhar, usa o bundle. Depois de criar
   ou editar um JSON, rode `node build.js`.
   ═══════════════════════════════════════════════════════════════ */

const Modulos = (() => {
  const cache = new Map();

  function doBundle(caminho) {
    const b = window.__ACERVO_BUNDLE__;
    if (!b) return null;
    const nome = caminho.replace(/^.*\//, "");
    return b[nome] || null;
  }

  async function carregarJSON(caminho) {
    if (cache.has(caminho)) return cache.get(caminho);

    let dados = null;
    try {
      const res = await fetch(caminho, { cache: "no-cache" });
      if (res.ok) dados = await res.json();
    } catch (e) {
      /* file:// bloqueia — cai no bundle abaixo */
    }

    if (!dados) dados = doBundle(caminho);

    if (!dados) {
      throw new Error(
        "Não consegui carregar " + caminho + ". Rode `node build.js` " +
          "para gerar o bundle, ou sirva a pasta por HTTP."
      );
    }

    cache.set(caminho, dados);
    return dados;
  }

  const indice = () => carregarJSON("data/modules.json");
  const modulo = (arquivo) => carregarJSON("data/" + arquivo);
  const bancoQuestoes = () => carregarJSON("data/quiz-bank.json");
  const casosPraticos = () => carregarJSON("data/casos_praticos.json");
  const fontes = () => carregarJSON("data/_fontes.json");
  const doutrina = () => carregarJSON("data/doutrina.json");
  const vadeMecum = () => carregarJSON("data/vademecum.json");

  /* ── Renderização de blocos de conteúdo ─────────────────────── */

  const URL_CP =
    "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm";

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  /**
   * Selo de origem. É o que impede o acervo de fingir uniformidade:
   * quatro dos oito módulos não têm material de aula nenhum, e quem
   * estuda precisa saber quando está lendo a aula e quando está lendo
   * o manual.
   */
  function seloFonte(fonte) {
    if (!fonte) return "";
    const tipo = fonte.tipo || "aula";
    const rotulos = {
      aula: "material de aula",
      manual: "a partir dos manuais",
      lei: "texto de lei",
    };
    return `<span class="selo-fonte selo-${esc(tipo)}" title="${esc(
      fonte.detalhe || ""
    )}">${esc(rotulos[tipo] || tipo)}${
      fonte.referencia ? " · " + esc(fonte.referencia) : ""
    }</span>`;
  }

  function renderBloco(b) {
    switch (b.tipo) {
      case "paragrafo":
        return `<p>${esc(b.texto)}</p>`;

      case "lista":
        return (
          (b.titulo ? `<p><strong>${esc(b.titulo)}</strong></p>` : "") +
          `<ul>${b.itens.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
        );

      case "citacao":
        return `<blockquote>${esc(b.texto)}<cite>— ${esc(b.autor)}${
          b.pagina ? ", p. " + esc(b.pagina) : ""
        }</cite></blockquote>`;

      case "destaque":
        return `<div class="destaque">
            ${b.titulo ? `<p class="destaque-titulo">${esc(b.titulo)}</p>` : ""}
            <p>${esc(b.texto)}</p>
          </div>`;

      case "alerta":
        return `<div class="alerta-bloco">
            ${b.titulo ? `<p class="alerta-titulo">${esc(b.titulo)}</p>` : ""}
            <p>${esc(b.texto)}</p>
          </div>`;

      case "artigo": {
        // Todo artigo citado vira link para o texto oficial no Planalto.
        const href = URL_CP + (b.anchor ? "#" + esc(b.anchor) : "");
        return `<div class="artigo-cp">
            <a class="artigo-cp-ref" href="${href}" target="_blank" rel="noopener">
              ${esc(b.referencia)} ↗
            </a>
            <p>${esc(b.texto)}</p>
          </div>`;
      }

      default:
        return `<p>${esc(b.texto || "")}</p>`;
    }
  }

  function renderTabela(t) {
    const cabecalho = t.colunas.map((c) => `<th>${esc(c)}</th>`).join("");
    const corpo = t.linhas
      .map(
        (l) =>
          `<tr>${l
            .map(
              (c, i) =>
                `<td data-col="${esc(t.colunas[i] || "")}">${esc(c)}</td>`
            )
            .join("")}</tr>`
      )
      .join("");

    return `<div class="tabela-wrap">
        <div class="tabela-titulo">${esc(t.titulo)}</div>
        <div class="tabela-scroll">
          <table class="tabela-responsiva">
            <thead><tr>${cabecalho}</tr></thead>
            <tbody>${corpo}</tbody>
          </table>
        </div>
      </div>`;
  }

  /* ── Accordion ──────────────────────────────────────────────── */

  function montarAccordion(container, secoes, moduloId) {
    container.innerHTML = "";
    const total = secoes.length;

    secoes.forEach((sec) => {
      const item = document.createElement("div");
      item.className = "acc-item";
      item.dataset.secao = sec.id;

      const head = document.createElement("button");
      head.className = "acc-head";
      head.type = "button";
      head.setAttribute("aria-expanded", "false");
      head.innerHTML =
        `<span class="acc-seta" aria-hidden="true">›</span>` +
        `<span class="acc-tit">${esc(sec.titulo)}</span>` +
        seloFonte(sec.fonte);

      const corpo = document.createElement("div");
      corpo.className = "acc-corpo";
      const wrapper = document.createElement("div");
      const inner = document.createElement("div");
      inner.className = "acc-inner";
      inner.innerHTML = (sec.blocos || []).map(renderBloco).join("");
      (sec.tabelas || []).forEach((t) => {
        inner.insertAdjacentHTML("beforeend", renderTabela(t));
      });
      wrapper.appendChild(inner);
      corpo.appendChild(wrapper);

      head.addEventListener("click", () => {
        const abrindo = !item.classList.contains("aberto");
        item.classList.toggle("aberto", abrindo);
        head.setAttribute("aria-expanded", String(abrindo));
        if (abrindo && moduloId) {
          Progresso.marcarSecaoLida(moduloId, sec.id, total);
          document.dispatchEvent(new CustomEvent("progresso:mudou"));
        }
      });

      item.append(head, corpo);
      container.appendChild(item);
    });
  }

  return {
    carregarJSON,
    indice,
    modulo,
    bancoQuestoes,
    casosPraticos,
    fontes,
    doutrina,
    vadeMecum,
    renderBloco,
    renderTabela,
    montarAccordion,
    seloFonte,
    esc,
  };
})();

window.Modulos = Modulos;
