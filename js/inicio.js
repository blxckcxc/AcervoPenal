/* ═══════════════════════════════════════════════════════════════
   inicio.js — dashboard

   O radar mostra DUAS séries: domínio teórico e prática. Elas não são
   somadas nem misturadas numa nota só, porque medem coisas diferentes —
   ler e responder quiz de um lado, resolver casos com subsunção do
   outro. Um estudante pode ir muito bem no primeiro e mal no segundo, e
   é justamente essa diferença que interessa ver.
   ═══════════════════════════════════════════════════════════════ */

const Inicio = (() => {
  const esc = (s) => Modulos.esc(s);

  const ROTULO_ORIGEM = {
    aula: "material de aula",
    misto: "aula + manuais",
    manual: "a partir dos manuais",
  };

  function radar(modulos) {
    const n = modulos.length;
    const cx = 160;
    const cy = 150;
    const raio = 105;
    const anel = [0.25, 0.5, 0.75, 1];

    const ponto = (i, escala) => {
      const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
      return [cx + Math.cos(ang) * raio * escala, cy + Math.sin(ang) * raio * escala];
    };

    const teia = anel
      .map((e) => {
        const pts = modulos.map((_, i) => ponto(i, e).map((v) => v.toFixed(1)).join(",")).join(" ");
        return `<polygon class="radar-teia" points="${pts}"/>`;
      })
      .join("");

    const eixos = modulos
      .map((_, i) => {
        const [x, y] = ponto(i, 1);
        return `<line class="radar-eixo" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
      })
      .join("");

    const serie = (valorDe, classe) => {
      const pts = modulos
        .map((m, i) => ponto(i, Math.max(0.02, valorDe(m.id) / 100)).map((v) => v.toFixed(1)).join(","))
        .join(" ");
      return `<polygon class="${classe}" points="${pts}"/>`;
    };

    const rotulos = modulos
      .map((m, i) => {
        const [x, y] = ponto(i, 1.22);
        const ancora = x < cx - 8 ? "end" : x > cx + 8 ? "start" : "middle";
        return `<text class="radar-rotulo" x="${x.toFixed(1)}" y="${y.toFixed(1)}"
          text-anchor="${ancora}" dominant-baseline="middle">${String(m.ordem).padStart(2, "0")}</text>`;
      })
      .join("");

    return `<svg class="radar" viewBox="0 0 320 300" role="img"
        aria-label="Radar de domínio por módulo, comparando teoria e prática">
        ${teia}${eixos}
        ${serie(Progresso.percentual, "radar-area-teoria")}
        ${serie(Progresso.pratica, "radar-area-pratica")}
        ${rotulos}
      </svg>
      <div class="radar-legenda">
        <span class="radar-chave"><span class="radar-amostra teoria"></span>domínio teórico</span>
        <span class="radar-chave"><span class="radar-amostra pratica"></span>casos práticos</span>
      </div>`;
  }

  function cartaoModulo(m) {
    const pct = Progresso.percentual(m.id);
    const pratica = Progresso.pratica(m.id);
    return `<a class="card-modulo${m.destaque ? " destaque-modulo" : ""}"
        href="modulo.html?m=${encodeURIComponent(m.id)}">
        <div class="card-modulo-topo">
          <span class="card-modulo-num">${String(m.ordem).padStart(2, "0")}</span>
          <h3 class="card-modulo-tit">${esc(m.titulo)}</h3>
        </div>
        <p class="card-modulo-resumo">${esc(m.resumo)}</p>
        <span class="selo-fonte selo-${esc(m.origem)}">${esc(ROTULO_ORIGEM[m.origem] || m.origem)}</span>
        <div class="barra"><div class="barra-preenchida" style="width:${pct}%"></div></div>
        <div class="card-modulo-rodape">
          <span>teoria ${pct}%</span>
          <span>prática ${pratica}%</span>
        </div>
      </a>`;
  }

  async function iniciar(raiz) {
    raiz.innerHTML = `<p class="vazio">Carregando…</p>`;

    let indice, casos;
    try {
      indice = await Modulos.indice();
    } catch (e) {
      App.erroNaPagina(raiz, e.message);
      return;
    }
    try {
      casos = await Modulos.casosPraticos();
    } catch (e) {
      casos = { casos: [] };
    }

    const modulos = indice.modulos;
    const stats = Progresso.estatisticasGerais(modulos);
    const comAula = modulos.filter((m) => m.origem === "aula").length;
    const mistos = modulos.filter((m) => m.origem === "misto").length;

    const desenhar = () => {
      raiz.innerHTML = `
        <section class="secao">
          <div class="grade-stats">
            <div class="stat"><div class="stat-valor">${stats.progressoGeral}%</div><div class="stat-rotulo">domínio teórico</div></div>
            <div class="stat"><div class="stat-valor">${stats.praticaGeral}%</div><div class="stat-rotulo">casos práticos</div></div>
            <div class="stat"><div class="stat-valor">${stats.streak}</div><div class="stat-rotulo">dias seguidos</div></div>
            <div class="stat"><div class="stat-valor">${casos.casos.length}</div><div class="stat-rotulo">casos no banco</div></div>
          </div>
        </section>

        <section class="secao">
          <h2 class="secao-titulo">Onde você está</h2>
          <div class="card">${radar(modulos)}</div>
        </section>

        <section class="secao">
          <h2 class="secao-titulo">Módulos</h2>
          <div class="mod-aviso-origem">
            Dos oito módulos, <strong>${comAula}</strong> saem direto do material de aula e
            <strong>${mistos}</strong> combinam aula e manuais; os demais foram escritos a
            partir dos três manuais recomendados pelo professor, porque as quatro aulas não
            os cobriram. Cada módulo diz de onde veio — a etiqueta no cartão não é decorativa.
          </div>
          <div class="grade">${modulos.map(cartaoModulo).join("")}</div>
        </section>

        <section class="secao">
          <h2 class="secao-titulo">Atalhos</h2>
          <div class="grade">
            <a class="card card-modulo" href="simulador.html">
              <h3 class="card-modulo-tit">⚖ Simulador de casos</h3>
              <p class="card-modulo-resumo">${casos.casos.length} casos com narrativa fática, em
              múltipla escolha ou discursiva com espelho pontuado.</p>
            </a>
            <a class="card card-modulo" href="vademecum.html">
              <h3 class="card-modulo-tit">§ Vade Mecum</h3>
              <p class="card-modulo-resumo">Arts. 1º a 120 do Código Penal, com busca instantânea.</p>
            </a>
            <a class="card card-modulo" href="galeria.html">
              <h3 class="card-modulo-tit">▣ Galeria das aulas</h3>
              <p class="card-modulo-resumo">As 44 fotos que sustentam o acervo, por aula e por tema.</p>
            </a>
            <a class="card card-modulo" href="aula.html">
              <h3 class="card-modulo-tit">♪ Áudio da aula</h3>
              <p class="card-modulo-resumo">2h39min com controle de velocidade e marcos temáticos.</p>
            </a>
          </div>
        </section>`;
    };

    desenhar();
    document.addEventListener("progresso:mudou", desenhar);
  }

  return { iniciar };
})();

window.Inicio = Inicio;
