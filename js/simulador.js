/* ═══════════════════════════════════════════════════════════════
   simulador.js — Simulador de Casos Práticos

   Três telas: configuração → rodada → relatório.

   O PROBLEMA DO BANCO FINITO
   São 8 assuntos × 4 níveis = 32 combinações. Todo filtro estreito
   corre o risco de render menos casos do que o estudante pediu. Em vez
   de sortear em silêncio e entregar 3 quando ele pediu 10, a tela conta
   antes, mostra quantos existem, prende o máximo do seletor ao que há e
   diz qual filtro abrir quando não dá para começar.

   A NOTA DA DISCURSIVA É ESTIMATIVA
   Quem corrige é corretor.js, por casamento de termos — aproximação por
   natureza. A tela deixa isso explícito, mostra o espelho inteiro ao
   lado da resposta e dá ao estudante o botão de discordar de cada
   quesito. Ver o cabeçalho de corretor.js.
   ═══════════════════════════════════════════════════════════════ */

const Simulador = (() => {
  const esc = Modulos.esc;

  const NIVEIS = {
    1: { nome: "Básico", desc: "Fundamentos da graduação" },
    2: { nome: "Intermediário", desc: "Distinguir figuras próximas" },
    3: { nome: "Avançado", desc: "Concurso, erro acidental e teses de exclusão" },
    4: { nome: "Alta complexidade", desc: "Casos limítrofes e divergência doutrinária" },
  };

  const CHAVE_CONFIG = "simulador.ultimaConfig";
  const CHAVE_HISTORICO = "simulador.historico";

  let raiz = null;
  let banco = [];
  let modulos = [];
  let doutrina = null;

  const estado = {
    config: { assuntos: [], niveis: [1, 2, 3, 4], quantidade: 5, formato: "multipla" },
    rodada: [],
    indice: 0,
    respostas: [],
  };

  /* ── Disponibilidade ──────────────────────────────────────── */

  function filtrados(cfg) {
    return banco.filter(
      (c) =>
        (!cfg.assuntos.length || cfg.assuntos.includes(c.moduloId)) &&
        cfg.niveis.includes(c.nivel)
    );
  }

  const contarPorModulo = (id, niveis) =>
    banco.filter((c) => c.moduloId === id && niveis.includes(c.nivel)).length;

  /* ── Tela 1: configuração ─────────────────────────────────── */

  function telaConfig() {
    const cfg = estado.config;

    raiz.innerHTML = `
      <div class="sim-config">
        <section class="card">
          <h2 class="card-titulo">1 · Assuntos</h2>
          <p class="sim-ajuda">Sem nenhum marcado, entram todos os assuntos.</p>
          <div class="sim-chips" id="chipsAssunto"></div>
          <div class="sim-acoes-inline">
            <button type="button" class="btn btn-sm" id="btnTodos">Selecionar todos</button>
            <button type="button" class="btn btn-sm" id="btnNenhum">Limpar</button>
          </div>
        </section>

        <section class="card">
          <h2 class="card-titulo">2 · Nível</h2>
          <div class="sim-chips" id="chipsNivel"></div>
        </section>

        <section class="card">
          <h2 class="card-titulo">3 · Formato da resposta</h2>
          <div class="sim-formatos" id="formatos" role="radiogroup" aria-label="Formato da resposta"></div>
        </section>

        <section class="card">
          <h2 class="card-titulo">4 · Quantidade de casos</h2>
          <div class="sim-qtd">
            <input type="range" id="qtd" min="3" max="10" step="1" value="${cfg.quantidade}"
                   aria-describedby="dispon">
            <output id="qtdSaida" class="sim-qtd-valor">${cfg.quantidade}</output>
          </div>
          <p class="sim-disponivel" id="dispon" role="status" aria-live="polite"></p>
        </section>

        <button type="button" class="btn btn-primario btn-bloco" id="btnIniciar">
          Iniciar simulado
        </button>
      </div>`;

    montarChipsAssunto();
    montarChipsNivel();
    montarFormatos();

    const qtd = raiz.querySelector("#qtd");
    qtd.addEventListener("input", () => {
      cfg.quantidade = Number(qtd.value);
      raiz.querySelector("#qtdSaida").textContent = qtd.value;
      atualizarDisponibilidade();
    });

    raiz.querySelector("#btnTodos").addEventListener("click", () => {
      cfg.assuntos = modulos.map((m) => m.id);
      montarChipsAssunto();
      atualizarDisponibilidade();
    });
    raiz.querySelector("#btnNenhum").addEventListener("click", () => {
      cfg.assuntos = [];
      montarChipsAssunto();
      atualizarDisponibilidade();
    });
    raiz.querySelector("#btnIniciar").addEventListener("click", iniciarRodada);

    atualizarDisponibilidade();
  }

  function montarChipsAssunto() {
    const cfg = estado.config;
    const alvo = raiz.querySelector("#chipsAssunto");
    alvo.innerHTML = modulos
      .map((m) => {
        const n = contarPorModulo(m.id, cfg.niveis);
        const ativo = cfg.assuntos.includes(m.id);
        return `<button type="button" class="chip" data-modulo="${esc(m.id)}"
                  aria-pressed="${ativo}" ${n ? "" : "disabled"}>
            <span class="chip-marca" aria-hidden="true">✓</span>
            <span>${esc(m.titulo)}</span>
            <span class="chip-contagem">${n}</span>
          </button>`;
      })
      .join("");

    alvo.querySelectorAll(".chip").forEach((b) => {
      b.addEventListener("click", () => {
        const id = b.dataset.modulo;
        const i = cfg.assuntos.indexOf(id);
        if (i === -1) cfg.assuntos.push(id);
        else cfg.assuntos.splice(i, 1);
        b.setAttribute("aria-pressed", String(i === -1));
        atualizarDisponibilidade();
      });
    });
  }

  function montarChipsNivel() {
    const cfg = estado.config;
    const alvo = raiz.querySelector("#chipsNivel");
    alvo.innerHTML = [1, 2, 3, 4]
      .map((n) => {
        const ativo = cfg.niveis.includes(n);
        return `<button type="button" class="chip chip-nivel nivel-${n}" data-nivel="${n}"
                  aria-pressed="${ativo}" title="${esc(NIVEIS[n].desc)}">
            <span class="chip-marca" aria-hidden="true">✓</span>
            <span><strong>Nível ${n}</strong> · ${esc(NIVEIS[n].nome)}</span>
          </button>`;
      })
      .join("");

    alvo.querySelectorAll(".chip").forEach((b) => {
      b.addEventListener("click", () => {
        const n = Number(b.dataset.nivel);
        const i = cfg.niveis.indexOf(n);
        // Sempre ao menos um nível: zerar todos deixaria o banco vazio
        // sem que o estudante entendesse por quê.
        if (i !== -1 && cfg.niveis.length === 1) return;
        if (i === -1) cfg.niveis.push(n);
        else cfg.niveis.splice(i, 1);
        b.setAttribute("aria-pressed", String(i === -1));
        montarChipsAssunto();
        atualizarDisponibilidade();
      });
    });
  }

  function montarFormatos() {
    const cfg = estado.config;
    const opcoes = [
      { id: "multipla", titulo: "Múltipla escolha", desc: "Alternativas de A a E, com justificativa de cada uma." },
      { id: "discursiva", titulo: "Discursiva", desc: "Você redige a tese; a correção compara com o espelho pontuado." },
    ];
    const alvo = raiz.querySelector("#formatos");
    alvo.innerHTML = opcoes
      .map(
        (o) => `<button type="button" class="sim-formato" data-formato="${o.id}"
             role="radio" aria-checked="${cfg.formato === o.id}">
          <span class="sim-formato-tit">${esc(o.titulo)}</span>
          <span class="sim-formato-desc">${esc(o.desc)}</span>
        </button>`
      )
      .join("");

    alvo.querySelectorAll(".sim-formato").forEach((b) => {
      b.addEventListener("click", () => {
        cfg.formato = b.dataset.formato;
        alvo.querySelectorAll(".sim-formato").forEach((o) =>
          o.setAttribute("aria-checked", String(o.dataset.formato === cfg.formato))
        );
      });
    });
  }

  /**
   * O ponto honesto da tela de configuração: diz quantos casos existem
   * e ajusta o teto do seletor ao que há, em vez de aceitar 10 e
   * entregar 3 sem explicação.
   */
  function atualizarDisponibilidade() {
    const cfg = estado.config;
    const disponiveis = filtrados(cfg).length;
    const aviso = raiz.querySelector("#dispon");
    const botao = raiz.querySelector("#btnIniciar");
    const qtd = raiz.querySelector("#qtd");

    qtd.max = String(Math.max(3, Math.min(10, disponiveis)));
    if (cfg.quantidade > disponiveis) {
      cfg.quantidade = Math.max(3, disponiveis);
      qtd.value = String(cfg.quantidade);
      raiz.querySelector("#qtdSaida").textContent = String(cfg.quantidade);
    }

    if (disponiveis === 0) {
      aviso.innerHTML = `<span class="sim-alerta">Nenhum caso com este filtro.</span>
        Marque outro assunto ou inclua mais níveis.`;
      botao.disabled = true;
    } else if (disponiveis < 3) {
      aviso.innerHTML = `<span class="sim-alerta">Só ${disponiveis} caso${
        disponiveis > 1 ? "s" : ""
      } com este filtro</span> — o mínimo de uma rodada é 3.
        Inclua outro assunto ou outro nível.`;
      botao.disabled = true;
    } else {
      aviso.innerHTML = `<strong>${disponiveis}</strong> caso${
        disponiveis > 1 ? "s" : ""
      } disponíve${disponiveis > 1 ? "is" : "l"} com este filtro.
        A rodada usará ${cfg.quantidade}.`;
      botao.disabled = false;
    }
  }

  /* ── Tela 2: rodada ───────────────────────────────────────── */

  function embaralhar(a) {
    const v = a.slice();
    for (let i = v.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [v[i], v[j]] = [v[j], v[i]];
    }
    return v;
  }

  function iniciarRodada() {
    const cfg = estado.config;
    Storage.gravar(CHAVE_CONFIG, cfg);

    estado.rodada = embaralhar(filtrados(cfg)).slice(0, cfg.quantidade);
    estado.indice = 0;
    estado.respostas = [];
    renderCaso();
  }

  function renderCaso() {
    const caso = estado.rodada[estado.indice];
    const total = estado.rodada.length;
    const n = estado.indice + 1;
    const mod = modulos.find((m) => m.id === caso.moduloId);

    raiz.innerHTML = `
      <div class="sim-rodada">
        <div class="sim-topo">
          <div class="sim-passo">Caso ${n} de ${total}</div>
          <div class="barra"><div class="barra-preenchida" style="width:${((n - 1) / total) * 100}%"></div></div>
        </div>

        <article class="card sim-caso">
          <header class="sim-caso-cab">
            <span class="selo-nivel nivel-${caso.nivel}">Nível ${caso.nivel} · ${esc(NIVEIS[caso.nivel].nome)}</span>
            <span class="sim-caso-mod">${esc(mod ? mod.titulo : caso.moduloId)}</span>
          </header>
          <h2 class="sim-caso-tit">${esc(caso.titulo)}</h2>
          <p class="enunciado">${esc(caso.enunciado)}</p>
        </article>

        <div id="areaResposta"></div>
      </div>`;

    if (estado.config.formato === "multipla") renderMultipla(caso);
    else renderDiscursiva(caso);
  }

  function renderMultipla(caso) {
    const area = raiz.querySelector("#areaResposta");
    const alts = caso.multiplaEscolha.alternativas;

    area.innerHTML = `
      <div class="card">
        <h3 class="card-titulo">Assinale a alternativa correta</h3>
        <div class="sim-alts">
          ${alts
            .map(
              (a) => `<button type="button" class="sim-alt" data-letra="${esc(a.letra)}">
                <span class="sim-alt-letra">${esc(a.letra)}</span>
                <span class="sim-alt-txt">${esc(a.texto)}</span>
              </button>`
            )
            .join("")}
        </div>
        <div id="feedback"></div>
      </div>`;

    area.querySelectorAll(".sim-alt").forEach((b) => {
      b.addEventListener("click", () => {
        const escolhida = alts.find((a) => a.letra === b.dataset.letra);
        const acertou = !!escolhida.correta;

        area.querySelectorAll(".sim-alt").forEach((o) => {
          o.disabled = true;
          const alt = alts.find((a) => a.letra === o.dataset.letra);
          if (alt.correta) o.classList.add("correta");
          else if (o === b) o.classList.add("errada");
        });

        estado.respostas.push({ caso, acertou, nota: acertou ? 10 : 0, formato: "multipla" });

        area.querySelector("#feedback").innerHTML = `
          <div class="sim-veredito ${acertou ? "ok" : "nok"}">
            ${acertou ? "Correto." : "Incorreto."} A resposta é a alternativa ${esc(
          alts.find((a) => a.correta).letra
        )}.
          </div>
          <h4 class="sim-sub">Por que cada alternativa está certa ou errada</h4>
          <ul class="sim-justificativas">
            ${alts
              .map(
                (a) => `<li class="${a.correta ? "just-ok" : "just-nok"}">
                  <strong>${esc(a.letra)}.</strong> ${esc(a.justificativa)}
                  ${a.armadilha ? `<span class="sim-armadilha">Armadilha: ${esc(a.armadilha)}</span>` : ""}
                </li>`
              )
              .join("")}
          </ul>
          ${botaoAvancar()}`;

        ligarAvancar();
      });
    });
  }

  function renderDiscursiva(caso) {
    const area = raiz.querySelector("#areaResposta");
    area.innerHTML = `
      <div class="card">
        <h3 class="card-titulo">${esc(caso.discursiva.comando)}</h3>
        <label class="visually-hidden" for="resposta">Sua resposta</label>
        <textarea id="resposta" class="sim-textarea" rows="10"
          placeholder="Fundamente: tipificação, dispositivos legais e a tese jurídica."></textarea>
        <div class="sim-acoes-inline">
          <button type="button" class="btn btn-primario" id="btnCorrigir">Corrigir</button>
          <span class="sim-contador" id="contador" aria-live="polite">0 palavras</span>
        </div>
      </div>
      <div id="feedback"></div>`;

    const campo = area.querySelector("#resposta");
    campo.addEventListener("input", () => {
      const p = campo.value.trim() ? campo.value.trim().split(/\s+/).length : 0;
      area.querySelector("#contador").textContent = `${p} palavra${p === 1 ? "" : "s"}`;
    });
    campo.focus();

    area.querySelector("#btnCorrigir").addEventListener("click", () => {
      const resultado = Corretor.corrigir(campo.value, caso.discursiva.espelho);
      campo.disabled = true;
      area.querySelector("#btnCorrigir").disabled = true;
      const registro = { caso, resultado, nota: resultado.nota, acertou: null, formato: "discursiva" };
      estado.respostas.push(registro);
      renderCorrecao(caso, registro);
    });
  }

  function renderCorrecao(caso, registro) {
    const alvo = raiz.querySelector("#feedback");
    const r = registro.resultado;

    const acertos = r.quesitos.filter((q) => q.estado === "ok");
    const parciais = r.quesitos.filter((q) => q.estado === "parcial");
    const faltas = r.quesitos.filter((q) => q.estado === "falta");
    const mod = modulos.find((m) => m.id === caso.moduloId);

    alvo.innerHTML = `
      <div class="card sim-correcao">
        <div class="sim-nota">
          <div class="sim-nota-valor">${r.nota.toFixed(1).replace(".", ",")}</div>
          <div class="sim-nota-rotulo">
            nota <strong>estimada</strong> de 0 a 10
            ${r.ajustes ? `<br><span class="sim-ajustes">${r.ajustes} quesito(s) ajustado(s) por você</span>` : ""}
          </div>
        </div>

        <div class="alerta-bloco sim-ressalva">
          <p class="alerta-titulo">Esta correção é aproximada</p>
          <p>O motor procura os termos e os artigos do espelho no seu texto, e checa se
          aparecem afirmados ou negados. Ele não entende o que você escreveu. Se você
          defendeu a tese com outras palavras, ele vai marcar como ausente — e é por isso
          que cada quesito abaixo tem o botão para você discordar.</p>
        </div>

        <h4 class="sim-sub">Espelho de correção</h4>
        <ul class="sim-quesitos" id="quesitos">
          ${r.quesitos.map((q) => cartaoQuesito(q)).join("")}
        </ul>

        <div class="sim-diagnostico">
          <div class="diag diag-ok">
            <h5>🟢 O que você acertou</h5>
            ${acertos.length ? `<ul>${acertos.map((q) => `<li>${esc(q.quesito)}</li>`).join("")}</ul>` : "<p>Nenhum quesito integralmente atendido.</p>"}
          </div>
          <div class="diag diag-nok">
            <h5>🔴 O que faltou ou ficou pela metade</h5>
            ${
              parciais.length || faltas.length
                ? `<ul>${[...parciais, ...faltas].map((q) => `<li><strong>${esc(q.quesito)}</strong> — ${esc(q.motivo)}</li>`).join("")}</ul>`
                : "<p>Nada a apontar. Espelho inteiro atendido.</p>"
            }
          </div>
          <div class="diag diag-dica">
            <h5>💡 Onde estudar</h5>
            <p>Este caso é do módulo <strong>${esc(mod ? mod.titulo : caso.moduloId)}</strong>.</p>
            <a class="btn btn-sm" href="modulo.html?m=${encodeURIComponent(caso.moduloId)}">Abrir o módulo</a>
            ${
              caso.discursiva.avisoDeAtribuicao
                ? `<p class="sim-nota-fonte">${esc(caso.discursiva.avisoDeAtribuicao)}</p>`
                : ""
            }
          </div>
        </div>

        ${fundamentacao(caso)}
        ${botaoAvancar()}
      </div>`;

    ligarQuesitos(caso, registro);
    ligarAvancar();
  }

  function cartaoQuesito(q) {
    const rotulo = { ok: "atendido", parcial: "parcial", falta: "não atendido" }[q.estado];
    return `<li class="quesito quesito-${q.estado}" data-quesito="${esc(q.id)}">
      <div class="quesito-cab">
        <span class="quesito-texto">${esc(q.quesito)}</span>
        <span class="quesito-pontos">${q.pontos.toFixed(2).replace(".", ",")} / ${q.valor
      .toFixed(2)
      .replace(".", ",")}</span>
      </div>
      <div class="quesito-estado">${rotulo}${q.ajustadoAMao ? " · ajustado por você" : ""} — ${esc(q.motivo)}</div>
      <div class="quesito-acoes">
        <button type="button" class="btn btn-sm" data-ajuste="sim">Eu acertei isto</button>
        <button type="button" class="btn btn-sm" data-ajuste="nao">Não acertei</button>
        <button type="button" class="btn btn-sm btn-fantasma" data-ajuste="auto">Correção automática</button>
      </div>
    </li>`;
  }

  function ligarQuesitos(caso, registro) {
    raiz.querySelectorAll(".quesito").forEach((li) => {
      li.querySelectorAll("[data-ajuste]").forEach((b) => {
        b.addEventListener("click", () => {
          const v = b.dataset.ajuste;
          Corretor.ajustar(registro.resultado, li.dataset.quesito, v === "auto" ? null : v === "sim");
          registro.nota = registro.resultado.nota;
          renderCorrecao(caso, registro);
        });
      });
    });
  }

  function fundamentacao(caso) {
    const refs = (caso.discursiva && caso.discursiva.fundamentacaoDoutrinaria) || [];
    if (!refs.length || !doutrina) return "";

    const temas = refs.map((r) => doutrina.temas.find((t) => t.id === r)).filter(Boolean);
    if (!temas.length) return "";

    return `<details class="sim-doutrina">
      <summary>Como os três autores tratam este ponto</summary>
      ${temas
        .map(
          (t) => `<div class="doutrina-tema">
          <h5>${esc(t.titulo)}</h5>
          ${t.posicoes
            .map((p) => {
              const o = doutrina.obras[p.autor] || {};
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
        </div>`
        )
        .join("")}
      <p class="sim-nota-fonte">${esc(doutrina.avisoDeVigencia)}</p>
    </details>`;
  }

  const botaoAvancar = () => {
    const ultimo = estado.indice >= estado.rodada.length - 1;
    return `<button type="button" class="btn btn-primario btn-bloco" id="btnAvancar">
      ${ultimo ? "Ver relatório" : "Próximo caso"}
    </button>`;
  };

  function ligarAvancar() {
    const b = raiz.querySelector("#btnAvancar");
    if (!b) return;
    b.addEventListener("click", () => {
      if (estado.indice >= estado.rodada.length - 1) relatorio();
      else {
        estado.indice++;
        renderCaso();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    b.focus();
  }

  /* ── Tela 3: relatório ────────────────────────────────────── */

  function relatorio() {
    const porModulo = {};
    let somaNota = 0;
    let ajustes = 0;

    estado.respostas.forEach((r) => {
      const id = r.caso.moduloId;
      porModulo[id] = porModulo[id] || { soma: 0, n: 0 };
      porModulo[id].soma += r.nota;
      porModulo[id].n++;
      somaNota += r.nota;
      if (r.resultado) ajustes += r.resultado.ajustes;
    });

    const total = estado.respostas.length || 1;
    const media = somaNota / total;

    const temas = Object.entries(porModulo)
      .map(([id, d]) => {
        const m = modulos.find((x) => x.id === id);
        return { id, nome: m ? m.titulo : id, media: d.soma / d.n, n: d.n, pct: Math.round((d.soma / d.n) * 10) };
      })
      .sort((a, b) => a.pct - b.pct);

    // Persiste por módulo, na métrica própria — nunca em `questoes`,
    // que é do quiz e guarda o melhor aproveitamento.
    temas.forEach((t) => Progresso.registrarCasosPraticos(t.id, t.media, t.n));
    document.dispatchEvent(new CustomEvent("progresso:mudou"));

    const historico = Storage.ler(CHAVE_HISTORICO, []);
    historico.unshift({
      em: new Date().toISOString(),
      formato: estado.config.formato,
      casos: total,
      media: Math.round(media * 10) / 10,
      ajustes,
    });
    Storage.gravar(CHAVE_HISTORICO, historico.slice(0, 20));

    const fracos = temas.filter((t) => t.pct < 70);

    raiz.innerHTML = `
      <div class="sim-relatorio">
        <section class="card sim-resumo">
          <div class="sim-nota-valor grande">${media.toFixed(1).replace(".", ",")}</div>
          <p class="sim-nota-rotulo">média de ${total} caso${total > 1 ? "s" : ""}
            ${estado.config.formato === "discursiva" ? " · nota estimada" : ""}</p>
          ${
            ajustes
              ? `<p class="sim-ajustes">${ajustes} quesito(s) você corrigiu à mão — a média acima já os considera.</p>`
              : ""
          }
        </section>

        <section class="card">
          <h2 class="card-titulo">Aproveitamento por assunto</h2>
          ${temas
            .map(
              (t) => `<div class="rel-tema">
              <div class="rel-tema-cab">
                <span>${esc(t.nome)}</span>
                <span class="rel-tema-pct">${t.pct}%</span>
              </div>
              <div class="barra"><div class="barra-preenchida" style="width:${t.pct}%"></div></div>
              <div class="rel-tema-n">${t.n} caso${t.n > 1 ? "s" : ""}</div>
            </div>`
            )
            .join("")}
        </section>

        <section class="card">
          <h2 class="card-titulo">Diagnóstico</h2>
          ${
            fracos.length
              ? `<p>Os pontos abaixo ficaram abaixo de 70%. Vale revisar o módulo e refazer os flashcards antes de tentar de novo.</p>
                 <ol class="rel-fracos">
                   ${fracos
                     .map(
                       (t) => `<li>
                       <strong>${esc(t.nome)}</strong> — ${t.pct}%.
                       <a href="modulo.html?m=${encodeURIComponent(t.id)}">abrir o módulo</a>
                     </li>`
                     )
                     .join("")}
                 </ol>`
              : `<p>Nenhum assunto abaixo de 70% nesta rodada. Vale subir um nível de dificuldade.</p>`
          }
        </section>

        <div class="sim-acoes-inline">
          <button type="button" class="btn btn-primario" id="btnNovo">Nova rodada</button>
          <a class="btn" href="index.html">Voltar ao início</a>
        </div>
      </div>`;

    raiz.querySelector("#btnNovo").addEventListener("click", telaConfig);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ── Entrada ──────────────────────────────────────────────── */

  async function iniciar(container) {
    raiz = container;
    raiz.innerHTML = `<p class="vazio">Carregando os casos…</p>`;

    try {
      const [dadosCasos, indice] = await Promise.all([
        Modulos.casosPraticos(),
        Modulos.indice(),
      ]);
      banco = dadosCasos.casos || [];
      modulos = indice.modulos || [];
      try {
        doutrina = await Modulos.doutrina();
      } catch (e) {
        doutrina = null; // a fundamentação some, o simulador segue
      }
    } catch (e) {
      raiz.innerHTML = `<div class="vazio">
        <span class="vazio-icone" aria-hidden="true">⚠</span>
        <p>${esc(e.message)}</p></div>`;
      return;
    }

    if (!banco.length) {
      raiz.innerHTML = `<div class="vazio">
        <span class="vazio-icone" aria-hidden="true">📭</span>
        <p>O banco de casos está vazio.</p></div>`;
      return;
    }

    const salva = Storage.ler(CHAVE_CONFIG, null);
    if (salva) Object.assign(estado.config, salva);
    // Assunto que saiu do banco não pode continuar filtrando.
    estado.config.assuntos = estado.config.assuntos.filter((id) =>
      banco.some((c) => c.moduloId === id)
    );

    telaConfig();
  }

  return { iniciar };
})();

window.Simulador = Simulador;
