/* ═══════════════════════════════════════════════════════════════
   galeria.js — as 44 imagens das aulas, com lightbox

   Não há campo de rotação aqui, e isso é resultado de uma decisão do
   processamento: o catálogo havia registrado "rotacao: 90" em algumas
   fotos, mas era o EXIF de orientação, não giro do arquivo. A
   orientação foi aplicada ao pixel em tools/preparar-galeria.py e o
   EXIF, descartado. Não sobrou nada para o CSS corrigir.
   ═══════════════════════════════════════════════════════════════ */

const Galeria = (() => {
  const esc = (s) => Modulos.esc(s);

  const ROTULO_TIPO = {
    slide: "slide",
    lousa: "lousa",
    anotacao: "caderno",
    referencia: "referência",
  };

  let itens = [];
  let visiveis = [];
  let atual = 0;
  let filtro = { aula: null, tipo: null };

  /* ── Lightbox ─────────────────────────────────────────────── */

  function abrir(indice) {
    atual = indice;
    const lb = document.getElementById("lightbox");
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    pintarLightbox();
    document.getElementById("lbFechar").focus();
  }

  function fechar() {
    document.getElementById("lightbox").hidden = true;
    document.body.style.overflow = "";
  }

  const mover = (passo) => {
    atual = (atual + passo + visiveis.length) % visiveis.length;
    pintarLightbox();
  };

  function pintarLightbox() {
    const it = visiveis[atual];
    if (!it) return;

    document.getElementById("lbTema").textContent = it.tema;
    document.getElementById("lbPosicao").textContent = `${atual + 1} de ${visiveis.length}`;
    const img = document.getElementById("lbImagem");
    img.src = "img/" + it.arquivo;
    img.alt = it.tema;
    img.width = it.largura;
    img.height = it.altura;

    const partes = [esc(it.rotuloAula), esc(ROTULO_TIPO[it.tipo] || it.tipo)];
    if (it.artigos && it.artigos.length) {
      partes.push("arts. " + it.artigos.join(", "));
    }

    document.getElementById("lbInfo").innerHTML =
      partes.join(" · ") +
      (it.duplicataDe
        ? `<br><span class="lb-aviso">Duplicata de ${esc(it.duplicataDe)} — mesma lousa, outro enquadramento.</span>`
        : "") +
      (it.confiancaLeitura === "baixa"
        ? `<br><span class="lb-aviso">Leitura insegura: a transcrição desta imagem foi marcada como
           não confiável no catálogo. Não use como fonte sem conferir.</span>`
        : "") +
      (it.nota ? `<br><span class="nota-fonte">${esc(it.nota)}</span>` : "");
  }

  /* ── Grade ────────────────────────────────────────────────── */

  function aplicarFiltro() {
    visiveis = itens.filter(
      (i) =>
        (!filtro.aula || i.aula === filtro.aula) && (!filtro.tipo || i.tipo === filtro.tipo)
    );

    const grade = document.getElementById("galGrade");
    grade.innerHTML = visiveis.length
      ? visiveis
          .map(
            (i, k) => `<button type="button" class="gal-item" data-k="${k}">
              <span class="gal-selo-tipo tipo-${esc(i.tipo)}">${esc(ROTULO_TIPO[i.tipo] || i.tipo)}</span>
              <img src="img/thumb/${esc(i.arquivo)}" alt="${esc(i.tema)}" loading="lazy"
                   width="${i.larguraMini || 480}" height="${i.alturaMini || 360}">
              <span class="gal-item-legenda">${esc(i.tema)}</span>
            </button>`
          )
          .join("")
      : `<div class="vazio"><span class="vazio-icone" aria-hidden="true">▣</span>
         <p>Nenhuma imagem com este filtro.</p></div>`;

    document.getElementById("galContagem").textContent =
      `${visiveis.length} de ${itens.length} imagens`;

    grade.querySelectorAll(".gal-item").forEach((b) => {
      b.addEventListener("click", () => abrir(Number(b.dataset.k)));
    });
  }

  async function iniciar(raiz) {
    raiz.innerHTML = `<p class="vazio">Carregando a galeria…</p>`;

    let dados;
    try {
      dados = await Modulos.carregarJSON("data/galeria.json");
    } catch (e) {
      App.erroNaPagina(raiz, e.message);
      return;
    }

    itens = dados.itens || [];
    const tipos = [...new Set(itens.map((i) => i.tipo))];

    raiz.innerHTML = `
      <div class="gal-filtros" id="galFiltros">
        <button type="button" class="chip" data-dim="aula" data-v="" aria-pressed="true">
          <span class="chip-marca" aria-hidden="true">✓</span>Todas as aulas</button>
        ${dados.aulas
          .map(
            (a) => `<button type="button" class="chip" data-dim="aula" data-v="${esc(a.data)}"
              aria-pressed="false"><span class="chip-marca" aria-hidden="true">✓</span>${esc(a.rotulo)}</button>`
          )
          .join("")}
      </div>
      <div class="gal-filtros" id="galTipos">
        <button type="button" class="chip" data-dim="tipo" data-v="" aria-pressed="true">
          <span class="chip-marca" aria-hidden="true">✓</span>Tudo</button>
        ${tipos
          .map(
            (t) => `<button type="button" class="chip" data-dim="tipo" data-v="${esc(t)}"
              aria-pressed="false"><span class="chip-marca" aria-hidden="true">✓</span>${esc(
              ROTULO_TIPO[t] || t
            )}</button>`
          )
          .join("")}
      </div>
      <p class="vm-contagem" id="galContagem" role="status" aria-live="polite"></p>
      <div class="gal-grade" id="galGrade"></div>

      <p class="nota-fonte">${esc(dados.sobreARotacao)}</p>

      <div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="Imagem ampliada">
        <div class="lb-topo">
          <span class="lb-tema" id="lbTema"></span>
          <button type="button" class="icon-btn" id="lbFechar" aria-label="Fechar">✕</button>
        </div>
        <div class="lb-palco"><img id="lbImagem" alt=""></div>
        <div class="lb-rodape">
          <div class="lb-nav">
            <button type="button" class="btn btn-sm" id="lbAnterior">‹ anterior</button>
            <button type="button" class="btn btn-sm" id="lbProxima">próxima ›</button>
          </div>
          <span id="lbPosicao"></span>
          <span id="lbInfo"></span>
        </div>
      </div>`;

    raiz.querySelectorAll("[data-dim]").forEach((b) => {
      b.addEventListener("click", () => {
        const dim = b.dataset.dim;
        filtro[dim] = b.dataset.v || null;
        raiz
          .querySelectorAll(`[data-dim="${dim}"]`)
          .forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
        aplicarFiltro();
      });
    });

    raiz.querySelector("#lbFechar").addEventListener("click", fechar);
    raiz.querySelector("#lbAnterior").addEventListener("click", () => mover(-1));
    raiz.querySelector("#lbProxima").addEventListener("click", () => mover(1));

    document.addEventListener("keydown", (e) => {
      if (document.getElementById("lightbox").hidden) return;
      if (e.key === "Escape") fechar();
      if (e.key === "ArrowLeft") mover(-1);
      if (e.key === "ArrowRight") mover(1);
    });

    aplicarFiltro();
  }

  return { iniciar };
})();

window.Galeria = Galeria;
