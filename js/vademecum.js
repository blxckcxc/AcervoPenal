/* ═══════════════════════════════════════════════════════════════
   vademecum.js — arts. 1º a 120 do Código Penal, com busca

   A busca é feita sobre um índice normalizado montado uma vez na
   carga. São 120 artigos com 265 itens: filtrar isso a cada tecla
   sobre o texto original, com acento e maiúscula, custaria caro e
   ainda erraria — quem digita "codigo" não acharia "Código".
   ═══════════════════════════════════════════════════════════════ */

const VadeMecum = (() => {
  const esc = (s) => Modulos.esc(s);

  const normalizar = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  let artigos = [];
  let indice = [];

  function realce(texto, termo) {
    if (!termo) return esc(texto);
    const alvo = normalizar(termo);
    const base = normalizar(texto);
    const pos = base.indexOf(alvo);
    if (pos === -1) return esc(texto);
    // As posições coincidem porque a normalização não muda o comprimento:
    // ela só rebaixa maiúsculas e remove marcas combinantes de acento.
    return (
      esc(texto.slice(0, pos)) +
      `<mark class="vm-marca">${esc(texto.slice(pos, pos + alvo.length))}</mark>` +
      esc(texto.slice(pos + alvo.length))
    );
  }

  function renderArtigo(a, termo) {
    const itens = (a.itens || [])
      .map(
        (i) => `<li>
          ${i.rubrica ? `<span class="vm-item-rubrica">${esc(i.rubrica)}</span>` : ""}
          ${realce(i.texto, termo)}
        </li>`
      )
      .join("");

    return `<article class="vm-artigo" id="art${a.numero}">
        <div class="vm-artigo-cab">
          <span class="vm-numero">Art. ${a.numero}${a.numero <= 9 ? "º" : ""}</span>
          ${a.rubrica ? `<span class="vm-rubrica">${esc(a.rubrica)}</span>` : ""}
        </div>
        <p class="vm-caput">${realce(a.caput, termo)}</p>
        ${itens ? `<ul class="vm-itens">${itens}</ul>` : ""}
        ${
          a.alteracoes && a.alteracoes.length
            ? `<div class="vm-alteracoes">${a.alteracoes.map(esc).join(" · ")}</div>`
            : ""
        }
      </article>`;
  }

  function filtrar(termo) {
    const alvo = normalizar(termo);
    if (!alvo) return artigos;

    // "20" e "art 20" devem achar o artigo 20, não todo texto que
    // contenha o número 20 em outra frase.
    const soNumero = alvo.match(/^(?:art(?:igo)?\.?\s*)?(\d{1,3})$/);
    if (soNumero) {
      const n = Number(soNumero[1]);
      const exato = artigos.filter((a) => a.numero === n);
      if (exato.length) return exato;
    }

    return artigos.filter((_, i) => indice[i].includes(alvo));
  }

  async function iniciar(raiz) {
    raiz.innerHTML = `<p class="vazio">Carregando o Código Penal…</p>`;

    let dados;
    try {
      dados = await Modulos.vadeMecum();
    } catch (e) {
      App.erroNaPagina(raiz, e.message);
      return;
    }

    artigos = dados.artigos || [];
    indice = artigos.map((a) =>
      normalizar(
        [a.numero, a.rubrica, a.caput, ...(a.itens || []).map((i) => i.texto)].join(" ")
      )
    );

    raiz.innerHTML = `
      <div class="vm-busca">
        <label class="visually-hidden" for="vmCampo">Buscar no Código Penal</label>
        <input type="search" id="vmCampo" class="vm-campo" autocomplete="off"
          placeholder="Buscar por número, rubrica ou trecho — ex.: 73, erro na execução">
        <p class="vm-contagem" id="vmContagem" role="status" aria-live="polite"></p>
      </div>
      <div id="vmLista"></div>
      <p class="nota-fonte">
        Texto extraído de <a href="${esc(dados.fonte)}" target="_blank" rel="noopener">
        ${esc(dados.fonte)}</a> em ${esc(dados.extraidoEm)}.
        A página de origem vem em ${esc(dados.codificacaoDaOrigem)}.
        Confira sempre na fonte antes de usar em peça ou prova.
      </p>`;

    const campo = raiz.querySelector("#vmCampo");
    const lista = raiz.querySelector("#vmLista");
    const contagem = raiz.querySelector("#vmContagem");

    const desenhar = () => {
      const termo = campo.value.trim();
      const achados = filtrar(termo);

      contagem.textContent = termo
        ? `${achados.length} artigo${achados.length === 1 ? "" : "s"} para “${termo}”`
        : `${artigos.length} artigos — arts. 1º a 120`;

      lista.innerHTML = achados.length
        ? achados.map((a) => renderArtigo(a, termo)).join("")
        : `<div class="vazio">
             <span class="vazio-icone" aria-hidden="true">§</span>
             <p>Nenhum artigo com “${esc(termo)}”.</p>
             <p class="nota-fonte">Este acervo cobre só a Parte Geral, arts. 1º a 120.</p>
           </div>`;
    };

    let timer;
    campo.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(desenhar, 120);
    });

    desenhar();

    // Abrir com #art73 na URL rola até o artigo.
    if (location.hash) {
      const alvo = document.getElementById(location.hash.slice(1));
      if (alvo) alvo.scrollIntoView();
    }
  }

  return { iniciar };
})();

window.VadeMecum = VadeMecum;
