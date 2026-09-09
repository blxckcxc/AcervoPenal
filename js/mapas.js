/* ═══════════════════════════════════════════════════════════════
   mapas.js — mapas mentais interativos

   POR QUE SVG ESCRITO À MÃO E NÃO UMA BIBLIOTECA
   D3, Cytoscape e Mermaid resolveriam o desenho, mas todas chegam
   por CDN ou por npm — e este acervo tem duas exigências que isso
   quebra: abrir com duplo clique em file:// e funcionar offline sem
   nada além dos arquivos da pasta. SVG gerado por string cumpre as
   duas, e ainda sai imprimível e exportável sem plugin.

   O QUE O MAPA MOSTRA QUE UM RESUMO NÃO MOSTRA
   Um tema sozinho vira árvore hierárquica. De dois a cinco temas,
   as árvores entram como faixas empilhadas e as CONEXÕES CRUZADAS
   aparecem tracejadas entre elas — o erro de tipo puxando o dolo,
   a teoria da atividade puxando a menoridade. Essa costura é o que
   a prova cobra e o que estudar módulo por módulo esconde.

   O LIMITE DE CINCO É PEDAGÓGICO, NÃO TÉCNICO
   O desenho aguentaria os oito. Oito faixas viram emaranhado e o
   mapa deixa de ensinar; cinco ainda cabem numa tela e numa cabeça.
   ═══════════════════════════════════════════════════════════════ */

const Mapas = (() => {
  const MAX_TEMAS = 5;
  const CHAVE = "mapas.temas";

  /* ── Geometria ──────────────────────────────────────────────
     Tudo em unidades do palco (não em pixels de tela): o zoom é
     uma transformação sobre esse sistema, então nada aqui muda. */
  const NO_LARG = 190;
  const NO_PAD = 11;
  const LINHA_H = 17;
  const ART_H = 14;
  const COL_W = 258;      // distância entre um nível e o seguinte
  const GAP_IRMAO = 14;   // respiro vertical entre nós vizinhos
  const GAP_FAIXA = 76;   // respiro entre faixas de módulo
  const RECUO = 168;      // corredor à esquerda para o rótulo da faixa
  const MARGEM = 44;

  const Z_MIN = 0.25;
  const Z_MAX = 3;

  const esc = (s) => Modulos.esc(s);

  let base = null;          // data/mapas_mentais.json
  let porId = new Map();    // id do nó -> nó (com _modulo anexado)
  let entrantes = new Map(); // id -> [{ de, motivo }] — conexões que APONTAM para o nó
  let selecionados = [];
  let desenho = null;       // resultado do último layout
  let vista = { k: 1, tx: 0, ty: 0 };
  let tocado = false;       // o usuário já arrastou/zoomou? então não reenquadro
  let raiz = null;
  let noSelecionado = null;

  /* ── Medição de texto ───────────────────────────────────────
     SVG não quebra linha sozinho, e chutar largura por número de
     caracteres erra feio com fonte proporcional ("Ilicitude" e
     "MMMMMMMMM" têm nove letras e larguras muito diferentes). O
     canvas mede de verdade, com a mesma fonte que vai desenhar. */

  const medir = (() => {
    let ctx = null;
    try {
      ctx = document.createElement("canvas").getContext("2d");
    } catch (e) {
      /* sem canvas, cai na estimativa abaixo */
    }
    return (texto, fonte) => {
      if (ctx) {
        ctx.font = fonte;
        return ctx.measureText(texto).width;
      }
      return String(texto).length * 6.7;
    };
  })();

  function fonteDoNo(raizDaArvore) {
    const cs = getComputedStyle(document.documentElement);
    const familia = (raizDaArvore
      ? cs.getPropertyValue("--fonte-titulo")
      : cs.getPropertyValue("--fonte-ui")
    ).trim() || "sans-serif";
    return (raizDaArvore ? "600 14px " : "600 13px ") + familia;
  }

  function quebrar(texto, largura, fonte, maxLinhas) {
    const palavras = String(texto).split(/\s+/).filter(Boolean);
    const linhas = [];
    let atual = "";

    for (const p of palavras) {
      const tentativa = atual ? atual + " " + p : p;
      if (medir(tentativa, fonte) <= largura || !atual) {
        atual = tentativa;
      } else {
        linhas.push(atual);
        atual = p;
        if (linhas.length === maxLinhas) break;
      }
    }
    if (linhas.length < maxLinhas && atual) linhas.push(atual);

    /* Sobrou texto: a última linha ganha reticências em vez de sumir
       em silêncio — o título inteiro está na gaveta de qualquer jeito. */
    const cabeTudo = linhas.join(" ") === palavras.join(" ");
    if (!cabeTudo && linhas.length) {
      let ultima = linhas[linhas.length - 1];
      while (ultima && medir(ultima + " …", fonte) > largura) {
        ultima = ultima.slice(0, -1);
      }
      linhas[linhas.length - 1] = ultima.replace(/\s+$/, "") + " …";
    }
    return linhas;
  }

  /* ── Layout ─────────────────────────────────────────────────
     Árvore da esquerda para a direita, uma faixa por módulo. O y de
     cada folha vem de um cursor que só anda; o de cada pai é a média
     dos filhos. É o algoritmo mais simples que não gera sobreposição
     em árvore rasa como esta (profundidade 3). */

  function medirNo(no) {
    const fonte = fonteDoNo(!no.pai);
    const linhas = quebrar(no.titulo, NO_LARG - NO_PAD * 2, fonte, 3);
    const alt = NO_PAD * 2 + linhas.length * LINHA_H + (no.artigo ? ART_H : 0);
    return { linhas, alt: Math.max(38, alt) };
  }

  function montarFaixa(modulo, deslocamentoY) {
    const nos = modulo.nos.map((n) => Object.assign({}, n, medirNo(n)));
    const indice = new Map(nos.map((n) => [n.id, n]));
    const filhos = new Map();
    const raizes = [];

    for (const n of nos) {
      if (n.pai && indice.has(n.pai)) {
        if (!filhos.has(n.pai)) filhos.set(n.pai, []);
        filhos.get(n.pai).push(n);
      } else {
        raizes.push(n);
      }
    }

    let cursor = deslocamentoY;

    function posicionar(n, prof) {
      n.prof = prof;
      n.x = RECUO + prof * COL_W;
      const fs = filhos.get(n.id) || [];
      if (!fs.length) {
        n.y = cursor + n.alt / 2;
        cursor += n.alt + GAP_IRMAO;
      } else {
        fs.forEach((f) => posicionar(f, prof + 1));
        n.y = (fs[0].y + fs[fs.length - 1].y) / 2;
      }
    }

    raizes.forEach((r) => posicionar(r, 0));

    const topo = Math.min(...nos.map((n) => n.y - n.alt / 2));
    const base_ = Math.max(...nos.map((n) => n.y + n.alt / 2));

    const arestas = [];
    for (const [paiId, fs] of filhos) {
      const pai = indice.get(paiId);
      for (const f of fs) arestas.push({ de: pai, para: f });
    }

    return { modulo, nos, arestas, topo, base: base_ };
  }

  function montarDesenho(ids) {
    const faixas = [];
    let y = MARGEM;

    for (const id of ids) {
      const mod = base.modulos.find((m) => m.id === id);
      if (!mod) continue;
      const faixa = montarFaixa(mod, y);
      faixas.push(faixa);
      y = faixa.base + GAP_FAIXA;
    }

    /* Índice dos nós efetivamente desenhados: só entre eles é que uma
       conexão cruzada pode virar linha. As demais viram badge e item
       na gaveta, com o convite para trazer o outro tema. */
    const visiveis = new Map();
    faixas.forEach((f) => f.nos.forEach((n) => visiveis.set(n.id, n)));

    const cruzadas = [];
    const vistas = new Set();
    for (const f of faixas) {
      for (const n of f.nos) {
        for (const c of n.conexoes_cruzadas || []) {
          const alvo = visiveis.get(c.para);
          if (!alvo) continue;
          const chave = [n.id, c.para].sort().join("|");
          if (vistas.has(chave)) continue;
          vistas.add(chave);
          cruzadas.push({ de: n, para: alvo, motivo: c.motivo });
        }
      }
    }

    const todos = [...visiveis.values()];
    const larg =
      Math.max(...todos.map((n) => n.x + NO_LARG)) + MARGEM;
    const alt = (faixas.length ? faixas[faixas.length - 1].base : 0) + MARGEM;

    return { faixas, cruzadas, visiveis, larg, alt };
  }

  /* ── SVG ────────────────────────────────────────────────────── */

  function caminhoEstrutural(a, b) {
    const x1 = a.x + NO_LARG;
    const y1 = a.y;
    const x2 = b.x;
    const y2 = b.y;
    const d = (x2 - x1) * 0.45;
    return `M ${x1} ${y1} C ${x1 + d} ${y1}, ${x2 - d} ${y2}, ${x2} ${y2}`;
  }

  function caminhoCruzado(a, b) {
    /* As faixas se empilham, então a conexão entre módulos é uma
       curva vertical: sai por baixo de um nó e entra por cima do
       outro, sem atravessar as caixas no caminho. */
    const acima = a.y <= b.y ? a : b;
    const abaixo = a.y <= b.y ? b : a;
    const x1 = acima.x + NO_LARG / 2;
    const y1 = acima.y + acima.alt / 2;
    const x2 = abaixo.x + NO_LARG / 2;
    const y2 = abaixo.y - abaixo.alt / 2;
    const d = Math.max(40, (y2 - y1) * 0.42);
    return `M ${x1} ${y1} C ${x1} ${y1 + d}, ${x2} ${y2 - d}, ${x2} ${y2}`;
  }

  function svgDoNo(n, cor) {
    const x = n.x;
    const y = n.y - n.alt / 2;
    const ehRaiz = !n.pai;
    const primeiraBase = y + NO_PAD + 12;

    const linhas = n.linhas
      .map(
        (t, i) =>
          `<tspan x="${x + NO_PAD}" y="${primeiraBase + i * LINHA_H}">${esc(t)}</tspan>`
      )
      .join("");

    const artigo = n.artigo
      ? `<text class="mp-no-art" x="${x + NO_PAD}"
           y="${y + n.alt - NO_PAD}">${esc(n.artigo.rotulo)}</text>`
      : "";

    const fora = (n.conexoes_cruzadas || []).length + (entrantes.get(n.id) || []).length;
    const elo = fora
      ? `<circle class="mp-no-elo" cx="${x + NO_LARG - 11}" cy="${y + 11}" r="8.5"/>
         <text class="mp-no-elo-n" x="${x + NO_LARG - 11}" y="${y + 14.5}"
           text-anchor="middle">${fora}</text>`
      : "";

    const rotuloElo = fora
      ? ` — ${fora} ${fora === 1 ? "conexão" : "conexões"} com outros módulos`
      : "";

    return `<g class="mp-no mp-cor-${esc(cor)}" data-no="${esc(n.id)}"
        data-raiz="${ehRaiz ? 1 : 0}" tabindex="0" role="button"
        aria-label="${esc(n.titulo)}${n.artigo ? ", " + esc(n.artigo.rotulo) : ""}${rotuloElo}. Abrir detalhe.">
        <rect class="mp-no-caixa" x="${x}" y="${y}" width="${NO_LARG}"
          height="${n.alt}" rx="10"/>
        <text class="mp-no-tit">${linhas}</text>
        ${artigo}${elo}
      </g>`;
  }

  function svgDoMapa(d) {
    const faixas = d.faixas
      .map((f) => {
        const cor = f.modulo.cor;
        const rotuloY = f.topo + 4;
        const cabecalho = `<g class="mp-cor-${esc(cor)}">
            <text class="mp-faixa-rot" x="${MARGEM}" y="${rotuloY + 14}">${esc(
          f.modulo.titulo
        )}</text>
            <line class="mp-faixa-linha" x1="${MARGEM}" y1="${rotuloY + 26}"
              x2="${RECUO - 24}" y2="${rotuloY + 26}"/>
          </g>`;

        const arestas = f.arestas
          .map((a) => `<path class="mp-aresta" d="${caminhoEstrutural(a.de, a.para)}"/>`)
          .join("");

        const nos = f.nos.map((n) => svgDoNo(n, cor)).join("");
        return `<g class="mp-faixa" data-modulo="${esc(f.modulo.id)}">
            ${cabecalho}${arestas}${nos}
          </g>`;
      })
      .join("");

    /* Desenhadas ANTES das faixas seria mais simples, mas elas
       precisam ficar sob as caixas e sobre as arestas estruturais —
       por isso o grupo próprio, inserido antes dos nós de cada faixa
       não daria certo: aqui vão todas juntas, atrás de tudo. */
    const cruzadas = d.cruzadas
      .map(
        (c) =>
          `<path class="mp-aresta-cruzada" d="${caminhoCruzado(c.de, c.para)}"
             data-de="${esc(c.de.id)}" data-para="${esc(c.para.id)}">
             <title>${esc(c.de.titulo)} ↔ ${esc(c.para.titulo)} — ${esc(c.motivo)}</title>
           </path>`
      )
      .join("");

    return `<g id="mpPalco">${cruzadas}${faixas}</g>`;
  }

  /* ── Pan, zoom e enquadramento ──────────────────────────────── */

  function aplicarVista() {
    const g = document.getElementById("mpPalco");
    if (g) g.setAttribute("transform", `translate(${vista.tx} ${vista.ty}) scale(${vista.k})`);
    const rot = document.getElementById("mpZoom");
    if (rot) rot.textContent = Math.round(vista.k * 100) + "%";
  }

  function tamanhoDaTela() {
    const svg = document.getElementById("mpSvg");
    if (!svg) return { w: 800, h: 500 };
    const r = svg.getBoundingClientRect();
    return { w: r.width || 800, h: r.height || 500 };
  }

  function enquadrar() {
    if (!desenho) return;
    const { w, h } = tamanhoDaTela();
    const k = Math.min(1.1, w / desenho.larg, h / desenho.alt);
    vista.k = Math.max(Z_MIN, Math.min(Z_MAX, k));
    vista.tx = (w - desenho.larg * vista.k) / 2;
    vista.ty = (h - desenho.alt * vista.k) / 2;
    tocado = false;
    aplicarVista();
  }

  function zoomEm(fator, cx, cy) {
    const k = Math.max(Z_MIN, Math.min(Z_MAX, vista.k * fator));
    if (k === vista.k) return;
    /* O ponto sob o cursor tem de continuar sob o cursor. */
    vista.tx = cx - ((cx - vista.tx) * k) / vista.k;
    vista.ty = cy - ((cy - vista.ty) * k) / vista.k;
    vista.k = k;
    tocado = true;
    aplicarVista();
  }

  function ligarNavegacao(palco) {
    const svg = document.getElementById("mpSvg");
    if (!svg) return;

    const ponteiros = new Map();
    let arrastando = false;
    let ini = null;
    let pinca = null;
    let andou = 0;

    const local = (e) => {
      const r = svg.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    svg.addEventListener("pointerdown", (e) => {
      ponteiros.set(e.pointerId, local(e));
      if (ponteiros.size === 1) {
        arrastando = true;
        andou = 0;
        const p = ponteiros.get(e.pointerId);
        ini = { x: p.x - vista.tx, y: p.y - vista.ty };
        palco.classList.add("arrastando");
        svg.setPointerCapture(e.pointerId);
      } else if (ponteiros.size === 2) {
        arrastando = false;
        const [a, b] = [...ponteiros.values()];
        pinca = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          cx: (a.x + b.x) / 2,
          cy: (a.y + b.y) / 2,
        };
      }
    });

    svg.addEventListener("pointermove", (e) => {
      if (!ponteiros.has(e.pointerId)) return;
      const p = local(e);
      ponteiros.set(e.pointerId, p);

      if (ponteiros.size === 2 && pinca) {
        const [a, b] = [...ponteiros.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinca.dist > 0) zoomEm(dist / pinca.dist, pinca.cx, pinca.cy);
        pinca.dist = dist;
        pinca.cx = (a.x + b.x) / 2;
        pinca.cy = (a.y + b.y) / 2;
        return;
      }

      if (!arrastando || !ini) return;
      const ntx = p.x - ini.x;
      const nty = p.y - ini.y;
      andou += Math.abs(ntx - vista.tx) + Math.abs(nty - vista.ty);
      vista.tx = ntx;
      vista.ty = nty;
      tocado = true;
      aplicarVista();
    });

    const soltar = (e) => {
      ponteiros.delete(e.pointerId);
      if (ponteiros.size < 2) pinca = null;
      if (!ponteiros.size) {
        arrastando = false;
        palco.classList.remove("arrastando");
      }
    };
    svg.addEventListener("pointerup", soltar);
    svg.addEventListener("pointercancel", soltar);
    svg.addEventListener("pointerleave", soltar);

    /* Clique só vale se a mão ficou parada: quem arrastou o mapa
       inteiro não queria abrir o nó que estava sob o dedo. */
    svg.addEventListener("click", (e) => {
      if (andou > 8) return;
      const g = e.target.closest(".mp-no");
      if (g) abrirGaveta(g.dataset.no);
    });

    svg.addEventListener("keydown", (e) => {
      const g = e.target.closest && e.target.closest(".mp-no");
      if (!g) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        abrirGaveta(g.dataset.no);
      }
    });

    svg.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const p = local(e);
        zoomEm(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
      },
      { passive: false }
    );

    addEventListener("resize", () => {
      if (!tocado) enquadrar();
    });
  }

  /* ── Gaveta de detalhe ──────────────────────────────────────── */

  const ROTULO_AUTOR = {
    Sanches: "Rogério Sanches Cunha",
    Masson: "Cleber Masson",
    Greco: "Rogério Greco",
    aula: "Material de aula",
  };

  function focarNo(id) {
    const alvo = desenho && desenho.visiveis.get(id);
    if (!alvo) return;
    const { w, h } = tamanhoDaTela();
    vista.tx = w / 2 - (alvo.x + NO_LARG / 2) * vista.k;
    vista.ty = h / 2 - alvo.y * vista.k;
    tocado = true;
    aplicarVista();

    document.querySelectorAll(".mp-no.selecionado").forEach((g) =>
      g.classList.remove("selecionado")
    );
    const g = document.querySelector(`.mp-no[data-no="${CSS.escape(id)}"]`);
    if (g) g.classList.add("selecionado");
  }

  function listaConexoes(no) {
    const saindo = (no.conexoes_cruzadas || []).map((c) => ({
      alvo: c.para,
      motivo: c.motivo,
    }));
    const chegando = (entrantes.get(no.id) || []).map((c) => ({
      alvo: c.de,
      motivo: c.motivo,
    }));

    /* Uma conexão declarada dos dois lados apareceria duas vezes. */
    const vistos = new Set();
    return [...saindo, ...chegando].filter((c) => {
      if (vistos.has(c.alvo)) return false;
      vistos.add(c.alvo);
      return true;
    });
  }

  function abrirGaveta(id) {
    const no = porId.get(id);
    if (!no) return;
    noSelecionado = id;

    const gaveta = document.getElementById("mpGaveta");
    const fundo = document.getElementById("mpGavetaFundo");
    const corpo = document.getElementById("mpGavetaCorpo");
    const topo = document.getElementById("mpGavetaTopo");
    if (!gaveta || !corpo) return;

    const mod = base.modulos.find((m) => m.id === no.modulo);
    const cor = mod ? mod.cor : "principios";

    topo.innerHTML = `
      <div class="mp-cor-${esc(cor)}" style="flex:1">
        <span class="mp-gaveta-modulo" style="color:currentColor">${esc(
          mod ? mod.titulo : no.modulo
        )}</span>
        <h2 class="mp-gaveta-tit">${esc(no.titulo)}</h2>
      </div>
      <button class="icon-btn" id="mpFechar" aria-label="Fechar detalhe">✕</button>`;

    const artigo = no.artigo
      ? `<div class="mp-gaveta-secao">
           <p class="mp-gaveta-rot">Dispositivo</p>
           <a class="mp-artigo-link" href="vademecum.html#${esc(no.artigo.ancora)}">
             § Ver ${esc(no.artigo.rotulo)} no Vade Mecum ↗
           </a>
         </div>`
      : "";

    const doutrina = (no.doutrina_chave || []).length
      ? `<div class="mp-gaveta-secao">
           <p class="mp-gaveta-rot">Ancoragem doutrinária</p>
           ${no.doutrina_chave
             .map(
               (d) => `<div class="mp-pos">
                 <span class="mp-pos-autor">${esc(
                   ROTULO_AUTOR[d.autor] || d.autor
                 )}</span>
                 <span class="mp-pos-loc"> · ${esc(d.localizador)}</span>
                 <p>${esc(d.posicao)}</p>
               </div>`
             )
             .join("")}
         </div>`
      : "";

    const exemplo = no.exemplo
      ? `<div class="mp-gaveta-secao">
           <p class="mp-gaveta-rot">Na prática</p>
           <div class="mp-exemplo"><p>${esc(no.exemplo)}</p></div>
         </div>`
      : "";

    const elos = listaConexoes(no);
    const conexoes = elos.length
      ? `<div class="mp-gaveta-secao">
           <p class="mp-gaveta-rot">Conecta com</p>
           ${elos
             .map((c) => {
               const alvo = porId.get(c.alvo);
               if (!alvo) return "";
               const modAlvo = base.modulos.find((m) => m.id === alvo.modulo);
               const dentro = desenho && desenho.visiveis.has(c.alvo);
               return `<button class="mp-elo" data-elo="${esc(c.alvo)}"
                   data-modulo="${esc(alvo.modulo)}">
                   <span class="mp-elo-alvo">${esc(alvo.titulo)}</span>
                   <span class="mp-elo-motivo">${esc(c.motivo)}</span>
                   ${
                     dentro
                       ? `<span class="mp-elo-fora">↦ ir até este nó</span>`
                       : `<span class="mp-elo-fora">＋ trazer “${esc(
                           modAlvo ? modAlvo.titulo : alvo.modulo
                         )}” para o mapa</span>`
                   }
                 </button>`;
             })
             .join("")}
         </div>`
      : "";

    corpo.innerHTML =
      `<div class="mp-gaveta-secao"><p>${esc(no.resumo)}</p></div>` +
      artigo +
      doutrina +
      exemplo +
      conexoes +
      `<div class="mp-gaveta-secao">
         <a class="mp-artigo-link" href="modulo.html?m=${encodeURIComponent(
           no.modulo
         )}">▤ Estudar o módulo inteiro</a>
       </div>`;

    gaveta.classList.add("aberta");
    gaveta.setAttribute("aria-hidden", "false");
    if (fundo) fundo.classList.add("visivel");

    const btnFechar = document.getElementById("mpFechar");
    if (btnFechar) {
      btnFechar.addEventListener("click", fecharGaveta);
      btnFechar.focus();
    }

    corpo.querySelectorAll("[data-elo]").forEach((b) => {
      b.addEventListener("click", () => {
        const alvoId = b.dataset.elo;
        const modAlvo = b.dataset.modulo;
        if (desenho && desenho.visiveis.has(alvoId)) {
          abrirGaveta(alvoId);
          focarNo(alvoId);
          return;
        }
        if (selecionados.length >= MAX_TEMAS) {
          avisarLimite(
            "Para trazer esse tema, tire um dos cinco que já estão no mapa."
          );
          return;
        }
        selecionados.push(modAlvo);
        gravarSelecao();
        redesenhar();
        abrirGaveta(alvoId);
        focarNo(alvoId);
      });
    });

    focarNo(id);
  }

  function fecharGaveta() {
    const gaveta = document.getElementById("mpGaveta");
    const fundo = document.getElementById("mpGavetaFundo");
    if (gaveta) {
      gaveta.classList.remove("aberta");
      gaveta.setAttribute("aria-hidden", "true");
    }
    if (fundo) fundo.classList.remove("visivel");
    document.querySelectorAll(".mp-no.selecionado").forEach((g) =>
      g.classList.remove("selecionado")
    );
    if (noSelecionado) {
      const g = document.querySelector(`.mp-no[data-no="${CSS.escape(noSelecionado)}"]`);
      if (g) g.focus();
    }
    noSelecionado = null;
  }

  /* ── Exportação ─────────────────────────────────────────────
     O SVG da tela pinta por classe CSS e variável de tema. Salvo
     como está, abriria preto no preto fora do acervo. Então a cópia
     recebe, elemento por elemento, os valores JÁ RESOLVIDOS pelo
     navegador — o arquivo sai igual ao que estava na tela, sem
     depender de nenhum CSS externo. */

  const PROPS = [
    "fill", "stroke", "stroke-width", "stroke-dasharray", "opacity",
    "font-family", "font-size", "font-weight", "letter-spacing", "text-anchor",
  ];

  function exportarSVG() {
    const svg = document.getElementById("mpSvg");
    if (!svg || !desenho) return;

    const copia = svg.cloneNode(true);
    const vivos = svg.querySelectorAll("*");
    const copias = copia.querySelectorAll("*");

    for (let i = 0; i < vivos.length; i++) {
      const cs = getComputedStyle(vivos[i]);
      const alvo = copias[i];
      if (!alvo || alvo.nodeName === "title") continue;
      for (const p of PROPS) {
        const v = cs.getPropertyValue(p);
        if (v && v !== "none" && v !== "normal") alvo.setAttribute(p, v.trim());
      }
      alvo.removeAttribute("class");
      alvo.removeAttribute("tabindex");
    }

    const fundo = getComputedStyle(
      document.getElementById("mpPalcoBox")
    ).backgroundColor;

    const g = copia.querySelector("#mpPalco");
    if (g) g.setAttribute("transform", `translate(${MARGEM} ${MARGEM})`);
    copia.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copia.setAttribute("width", desenho.larg + MARGEM * 2);
    copia.setAttribute("height", desenho.alt + MARGEM * 2);
    copia.setAttribute(
      "viewBox",
      `0 0 ${desenho.larg + MARGEM * 2} ${desenho.alt + MARGEM * 2}`
    );
    copia.removeAttribute("style");
    copia.insertAdjacentHTML(
      "afterbegin",
      `<rect x="0" y="0" width="100%" height="100%" fill="${fundo}"/>`
    );

    const texto =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      new XMLSerializer().serializeToString(copia);

    const blob = new Blob([texto], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mapa-" + selecionados.join("-") + ".svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ── Seleção de temas ───────────────────────────────────────── */

  function gravarSelecao() {
    Storage.gravar(CHAVE, selecionados);
  }

  let timerLimite = null;
  function avisarLimite(mensagem) {
    const caixa = document.getElementById("mpLimite");
    if (!caixa) return;
    caixa.textContent = mensagem;
    caixa.hidden = false;
    clearTimeout(timerLimite);
    timerLimite = setTimeout(() => {
      caixa.hidden = true;
    }, 6000);
  }

  function alternarTema(id) {
    const i = selecionados.indexOf(id);
    if (i >= 0) {
      selecionados.splice(i, 1);
    } else {
      if (selecionados.length >= MAX_TEMAS) {
        const mod = base.modulos.find((m) => m.id === id);
        avisarLimite(
          `Cinco temas é o teto — e é de propósito: com seis o mapa vira ` +
            `emaranhado e para de ensinar. Tire um dos que estão no mapa para ` +
            `entrar com “${mod ? mod.titulo : id}”.`
        );
        return;
      }
      selecionados.push(id);
    }
    gravarSelecao();
    redesenhar();
  }

  function atualizarSeletor() {
    document.querySelectorAll("[data-tema-id]").forEach((b) => {
      b.setAttribute(
        "aria-pressed",
        String(selecionados.includes(b.dataset.temaId))
      );
    });
    const cont = document.getElementById("mpContador");
    if (cont) {
      cont.innerHTML = `Temas selecionados: <strong>${selecionados.length}/${MAX_TEMAS}</strong>`;
      cont.classList.toggle("cheio", selecionados.length >= MAX_TEMAS);
    }
  }

  /* ── Lista textual ──────────────────────────────────────────── */

  function listaAlternativa(d) {
    if (!d.faixas.length) return "";
    const blocos = d.faixas
      .map((f) => {
        const filhos = new Map();
        const raizes = [];
        const indice = new Map(f.nos.map((n) => [n.id, n]));
        for (const n of f.nos) {
          if (n.pai && indice.has(n.pai)) {
            if (!filhos.has(n.pai)) filhos.set(n.pai, []);
            filhos.get(n.pai).push(n);
          } else raizes.push(n);
        }
        const ramo = (n) => {
          const fs = filhos.get(n.id) || [];
          return `<li>${esc(n.titulo)}${
            n.artigo ? ` <span class="mp-pos-loc">(${esc(n.artigo.rotulo)})</span>` : ""
          }${fs.length ? `<ul>${fs.map(ramo).join("")}</ul>` : ""}</li>`;
        };
        return `<h3 class="mp-alt-mod">${esc(f.modulo.titulo)}</h3>
          <ul>${raizes.map(ramo).join("")}</ul>`;
      })
      .join("");

    const cruz = d.cruzadas.length
      ? `<h3 class="mp-alt-mod">Conexões entre os temas</h3>
         <ul>${d.cruzadas
           .map(
             (c) =>
               `<li>${esc(c.de.titulo)} ↔ ${esc(c.para.titulo)} — ${esc(c.motivo)}</li>`
           )
           .join("")}</ul>`
      : "";

    return blocos + cruz;
  }

  /* ── Redesenho ──────────────────────────────────────────────── */

  function redesenhar() {
    atualizarSeletor();
    const palco = document.getElementById("mpPalcoBox");
    const alt = document.getElementById("mpAlt");
    if (!palco) return;

    if (!selecionados.length) {
      desenho = null;
      palco.hidden = true;
      if (alt) alt.hidden = true;
      const vazio = document.getElementById("mpVazio");
      if (vazio) vazio.hidden = false;
      return;
    }

    const vazio = document.getElementById("mpVazio");
    if (vazio) vazio.hidden = true;
    palco.hidden = false;

    desenho = montarDesenho(selecionados);

    const svg = document.getElementById("mpSvg");
    const nomes = selecionados
      .map((id) => {
        const m = base.modulos.find((x) => x.id === id);
        return m ? m.titulo : id;
      })
      .join(", ");
    svg.setAttribute(
      "aria-label",
      selecionados.length === 1
        ? `Mapa mental de ${nomes}`
        : `Mapa combinado de ${selecionados.length} temas: ${nomes}`
    );
    svg.innerHTML = svgDoMapa(desenho);

    if (alt) {
      alt.hidden = false;
      const corpo = document.getElementById("mpAltCorpo");
      if (corpo) corpo.innerHTML = listaAlternativa(desenho);
      const resumo = document.getElementById("mpAltResumo");
      if (resumo) {
        const n = desenho.visiveis.size;
        resumo.textContent = `Ver o mesmo mapa em lista — ${n} ${
          n === 1 ? "conceito" : "conceitos"
        }, ${desenho.cruzadas.length} ${
          desenho.cruzadas.length === 1 ? "conexão" : "conexões"
        } entre temas`;
      }
    }

    enquadrar();
  }

  /* ── Montagem ───────────────────────────────────────────────── */

  function montarPagina(raizEl) {
    const chips = base.modulos
      .map(
        (m) => `<button class="mp-tema" type="button" data-tema-id="${esc(m.id)}"
            data-cor="${esc(m.cor)}" aria-pressed="false">
            <span class="mp-tema-bolha" aria-hidden="true"></span>
            <span class="mp-tema-rot">${esc(m.titulo)}</span>
          </button>`
      )
      .join("");

    const atalhos = (base.atalhos || [])
      .map(
        (a) => `<button class="mp-atalho" type="button" data-atalho="${esc(a.id)}"
            title="${esc(a.descricao)}">${esc(a.rotulo)}</button>`
      )
      .join("");

    raizEl.innerHTML = `
      <section class="mp-setup card">
        <div class="mp-setup-topo">
          <h2 class="secao-titulo" style="margin:0">Escolha os temas</h2>
          <p class="mp-contador" id="mpContador" role="status">Temas selecionados: <strong>0/${MAX_TEMAS}</strong></p>
        </div>
        <div class="mp-temas">${chips}</div>
        <div class="mp-atalhos">
          <button class="mp-atalho" type="button" data-atalho="limpar">Limpar</button>
          ${atalhos}
        </div>
        <p class="mp-limite" id="mpLimite" hidden></p>
      </section>

      <div class="vazio" id="mpVazio">
        <span class="vazio-icone" aria-hidden="true">🧠</span>
        <p>Escolha ao menos um tema acima.</p>
        <p class="mp-nota">Um tema abre a árvore inteira daquele instituto.
        De dois a cinco, as árvores se fundem e as linhas tracejadas mostram onde
        eles se tocam na dogmática.</p>
      </div>

      <div class="mp-palco" id="mpPalcoBox" hidden>
        <svg id="mpSvg" role="img" aria-label="Mapa mental"></svg>
        <span class="mp-zoom-rot" id="mpZoom">100%</span>
        <div class="mp-controles">
          <button class="mp-ctrl" type="button" id="mpMais" aria-label="Aproximar">＋</button>
          <button class="mp-ctrl" type="button" id="mpMenos" aria-label="Afastar">−</button>
          <button class="mp-ctrl" type="button" id="mpCentro" aria-label="Centralizar o mapa">⟲</button>
          <button class="mp-ctrl" type="button" id="mpTela" aria-label="Tela cheia">⛶</button>
        </div>
      </div>

      <div class="mp-acoes">
        <button class="btn btn-fantasma" type="button" id="mpExportar">↓ Exportar SVG</button>
        <button class="btn btn-fantasma" type="button" id="mpImprimir">⎙ Imprimir / salvar em PDF</button>
      </div>

      <details class="mp-alt" id="mpAlt" hidden>
        <summary id="mpAltResumo">Ver o mesmo mapa em lista</summary>
        <div id="mpAltCorpo"></div>
      </details>

      <p class="mp-nota">Clique num nó para ver o conceito, a ancoragem doutrinária com
      localizador e o link direto para o artigo no Vade Mecum. As posições citadas trazem
      autor e página; onde o mapa é só estrutura dogmática, não há citação — e é assim
      que deve ser lido.</p>

      <div class="mp-gaveta-fundo" id="mpGavetaFundo"></div>
      <aside class="mp-gaveta" id="mpGaveta" aria-hidden="true" aria-label="Detalhe do conceito">
        <div class="mp-gaveta-topo" id="mpGavetaTopo"></div>
        <div class="mp-gaveta-corpo" id="mpGavetaCorpo"></div>
      </aside>`;

    raizEl.querySelectorAll("[data-tema-id]").forEach((b) => {
      b.addEventListener("click", () => alternarTema(b.dataset.temaId));
    });

    raizEl.querySelectorAll("[data-atalho]").forEach((b) => {
      b.addEventListener("click", () => {
        const id = b.dataset.atalho;
        if (id === "limpar") {
          selecionados = [];
        } else {
          const a = (base.atalhos || []).find((x) => x.id === id);
          if (a) selecionados = a.modulos.slice(0, MAX_TEMAS);
        }
        gravarSelecao();
        redesenhar();
      });
    });

    document.getElementById("mpMais").addEventListener("click", () => {
      const { w, h } = tamanhoDaTela();
      zoomEm(1.25, w / 2, h / 2);
    });
    document.getElementById("mpMenos").addEventListener("click", () => {
      const { w, h } = tamanhoDaTela();
      zoomEm(1 / 1.25, w / 2, h / 2);
    });
    document.getElementById("mpCentro").addEventListener("click", enquadrar);

    const palco = document.getElementById("mpPalcoBox");
    document.getElementById("mpTela").addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (palco.requestFullscreen) palco.requestFullscreen().catch(() => {});
    });
    document.addEventListener("fullscreenchange", () => {
      /* A tela mudou de tamanho; o enquadramento anterior não vale mais. */
      setTimeout(enquadrar, 60);
    });

    document.getElementById("mpExportar").addEventListener("click", exportarSVG);
    document.getElementById("mpImprimir").addEventListener("click", () => {
      const alt = document.getElementById("mpAlt");
      if (alt) alt.open = true;   /* no papel a lista vale mais que o zoom */
      window.print();
    });

    document.getElementById("mpGavetaFundo").addEventListener("click", fecharGaveta);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fecharGaveta();
    });

    ligarNavegacao(palco);
  }

  /* ── Entrada ────────────────────────────────────────────────── */

  async function iniciar(raizEl) {
    raiz = raizEl;
    raizEl.innerHTML = `<p class="vazio">Carregando…</p>`;

    try {
      base = await Modulos.carregarJSON("data/mapas_mentais.json");
    } catch (e) {
      App.erroNaPagina(raizEl, e.message);
      return;
    }

    porId = new Map();
    entrantes = new Map();
    for (const mod of base.modulos) {
      for (const no of mod.nos) porId.set(no.id, no);
    }
    for (const mod of base.modulos) {
      for (const no of mod.nos) {
        for (const c of no.conexoes_cruzadas || []) {
          if (!porId.has(c.para)) continue;   /* alvo inexistente não vira aresta fantasma */
          if (!entrantes.has(c.para)) entrantes.set(c.para, []);
          entrantes.get(c.para).push({ de: no.id, motivo: c.motivo });
        }
      }
    }

    const gravados = Storage.ler(CHAVE, null);
    const validos = Array.isArray(gravados)
      ? gravados.filter((id) => base.modulos.some((m) => m.id === id))
      : [];
    selecionados = validos.slice(0, MAX_TEMAS);
    if (!selecionados.length) selecionados = ["erro-de-tipo"];

    montarPagina(raizEl);
    redesenhar();
  }

  return { iniciar };
})();

window.Mapas = Mapas;
