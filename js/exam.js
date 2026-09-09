/* ═══════════════════════════════════════════════════════════════
   exam.js — simulado cronometrado

   Sem feedback durante a prova: é o que a distingue do quiz. O relatório
   por tema vem no fim, ordenado do pior para o melhor, porque é o pior
   que interessa a quem vai estudar em seguida.
   ═══════════════════════════════════════════════════════════════ */

const Prova = (() => {
  const esc = (s) => Modulos.esc(s);
  const SEGUNDOS_POR_QUESTAO = 90;

  const estado = {
    questoes: [],
    indice: 0,
    respostas: [],
    meta: {},
    restante: 0,
    relogio: null,
    marcaDaQuestao: 0,
  };

  function formatar(seg) {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  /* ── Configuração ─────────────────────────────────────────── */

  async function iniciarPagina(raiz) {
    raiz.innerHTML = `<p class="vazio">Carregando…</p>`;

    let banco, indice;
    try {
      [banco, indice] = await Promise.all([Modulos.bancoQuestoes(), Modulos.indice()]);
    } catch (e) {
      App.erroNaPagina(raiz, e.message);
      return;
    }

    const comQuestoes = indice.modulos.filter((m) => (banco.bancos[m.id] || []).length > 0);
    const total = comQuestoes.reduce((s, m) => s + banco.bancos[m.id].length, 0);

    if (total < 5) {
      raiz.innerHTML = `<div class="vazio">
        <span class="vazio-icone" aria-hidden="true">⏱</span>
        <p>São necessárias ao menos 5 questões para uma prova, e o banco tem ${total}.</p>
        <p class="nota-fonte">O <a href="simulador.html">simulador de casos</a>
        está completo, com 64 casos.</p></div>`;
      return;
    }

    const mapa = {};
    const nomes = {};
    comQuestoes.forEach((m) => {
      nomes[m.id] = m.titulo;
      banco.bancos[m.id].forEach((q) => (mapa[q.id] = m.id));
    });

    const maximo = Math.min(40, total);
    raiz.innerHTML = `
      <section class="card">
        <h2 class="card-titulo">Quantas questões</h2>
        <div class="sim-qtd">
          <input type="range" id="qtdProva" min="5" max="${maximo}" value="${Math.min(10, maximo)}">
          <output class="sim-qtd-valor" id="qtdSaida">${Math.min(10, maximo)}</output>
        </div>
        <p class="sim-disponivel" id="tempoPrevisto"></p>
        <button type="button" class="btn btn-primario btn-bloco" id="btnComecar">Começar a prova</button>
        <p class="nota-fonte">Durante a prova não há correção nem justificativa.
        O relatório por tema aparece ao final.</p>
      </section>`;

    const range = raiz.querySelector("#qtdProva");
    const saida = raiz.querySelector("#qtdSaida");
    const previsto = raiz.querySelector("#tempoPrevisto");

    const atualizar = () => {
      saida.textContent = range.value;
      previsto.textContent = `Tempo: ${formatar(Number(range.value) * SEGUNDOS_POR_QUESTAO)} — ${
        SEGUNDOS_POR_QUESTAO
      } segundos por questão.`;
    };
    range.addEventListener("input", atualizar);
    atualizar();

    raiz.querySelector("#btnComecar").addEventListener("click", () => {
      const todas = comQuestoes.flatMap((m) => banco.bancos[m.id]);
      const sorteadas = Quiz.embaralhar(todas).slice(0, Number(range.value));
      iniciar(raiz, sorteadas, { mapaQuestaoModulo: mapa, nomes, modulos: indice.modulos });
    });
  }

  /* ── Prova ────────────────────────────────────────────────── */

  function iniciar(raiz, questoes, meta) {
    estado.questoes = questoes;
    estado.indice = 0;
    estado.respostas = [];
    estado.meta = meta;
    estado.restante = questoes.length * SEGUNDOS_POR_QUESTAO;
    estado.marcaDaQuestao = Date.now();

    clearInterval(estado.relogio);
    estado.relogio = setInterval(() => tique(raiz), 1000);
    render(raiz);
  }

  function tique(raiz) {
    estado.restante--;
    const el = raiz.querySelector("#relogio");
    if (el) {
      el.textContent = formatar(Math.max(0, estado.restante));
      el.classList.toggle("alerta", estado.restante <= 120 && estado.restante > 60);
      el.classList.toggle("critico", estado.restante <= 60);
    }
    if (estado.restante <= 0) {
      clearInterval(estado.relogio);
      relatorio(raiz, true);
    }
  }

  function render(raiz) {
    const q = estado.questoes[estado.indice];
    if (!q) return relatorio(raiz, false);

    const n = estado.indice + 1;
    const total = estado.questoes.length;
    estado.marcaDaQuestao = Date.now();

    let corpo = "";
    if (q.tipo === "vf") {
      corpo = `<div class="sim-alts">
          <button type="button" class="sim-alt" data-r="true"><span class="sim-alt-letra">V</span>
            <span class="sim-alt-txt">Verdadeiro</span></button>
          <button type="button" class="sim-alt" data-r="false"><span class="sim-alt-letra">F</span>
            <span class="sim-alt-txt">Falso</span></button>
        </div>`;
    } else if (q.tipo === "cloze") {
      corpo = `<label class="visually-hidden" for="pvCampo">Sua resposta</label>
        <input type="text" id="pvCampo" class="vm-campo" autocomplete="off" placeholder="Digite a resposta">
        <div class="sim-acoes-inline"><button type="button" class="btn btn-primario" data-cloze>Responder</button></div>`;
    } else {
      corpo = `<div class="sim-alts">${q.alternativas
        .map(
          (a, i) => `<button type="button" class="sim-alt" data-r="${i}">
            <span class="sim-alt-letra">${"ABCDE"[i]}</span>
            <span class="sim-alt-txt">${esc(a.texto)}</span></button>`
        )
        .join("")}</div>`;
    }

    raiz.innerHTML = `
      <div class="quiz-topo prova-topo">
        <span class="sim-passo">Questão ${n} de ${total}</span>
        <span class="prova-relogio" id="relogio">${formatar(Math.max(0, estado.restante))}</span>
      </div>
      <div class="barra"><div class="barra-preenchida" style="width:${((n - 1) / total) * 100}%"></div></div>
      <article class="card questao">
        <p class="questao-enunciado enunciado">${esc(q.enunciado)}</p>
        ${corpo}
        <div class="sim-acoes-inline">
          <button type="button" class="btn btn-fantasma" id="btnPular">Pular</button>
        </div>
      </article>`;

    const avancar = (acertou) => {
      estado.respostas.push({
        q,
        acertou,
        segundos: Math.round((Date.now() - estado.marcaDaQuestao) / 1000),
      });
      estado.indice++;
      render(raiz);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    raiz.querySelectorAll("[data-r]").forEach((b) => {
      b.addEventListener("click", () => {
        const v = b.dataset.r;
        if (q.tipo === "vf") avancar(v === "true" === q.resposta);
        else avancar(!!q.alternativas[Number(v)].correta);
      });
    });

    const bCloze = raiz.querySelector("[data-cloze]");
    if (bCloze) {
      const campo = raiz.querySelector("#pvCampo");
      campo.focus();
      const resp = () => {
        const norm = (s) =>
          String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
        avancar([q.resposta, ...(q.aceitas || [])].map(norm).includes(norm(campo.value)));
      };
      bCloze.addEventListener("click", resp);
      campo.addEventListener("keydown", (e) => e.key === "Enter" && resp());
    }

    // Pular grava `null`: não é acerto nem erro, e o relatório conta à parte.
    raiz.querySelector("#btnPular").addEventListener("click", () => avancar(null));
  }

  /* ── Relatório ────────────────────────────────────────────── */

  function relatorio(raiz, porTempo) {
    clearInterval(estado.relogio);

    const meta = estado.meta;
    const porTema = {};
    estado.respostas.forEach((r) => {
      const mid = meta.mapaQuestaoModulo[r.q.id] || "outros";
      porTema[mid] = porTema[mid] || { certas: 0, total: 0 };
      porTema[mid].total++;
      if (r.acertou === true) porTema[mid].certas++;
    });

    const temas = Object.entries(porTema)
      .map(([id, d]) => ({
        id,
        nome: meta.nomes[id] || id,
        certas: d.certas,
        total: d.total,
        pct: d.total ? Math.round((d.certas / d.total) * 100) : 0,
      }))
      .sort((a, b) => a.pct - b.pct);

    const fracos = temas.filter((t) => t.pct < 70);
    const certas = estado.respostas.filter((r) => r.acertou === true).length;
    const puladas = estado.respostas.filter((r) => r.acertou === null).length;
    const total = estado.questoes.length;
    const pct = Math.round((certas / total) * 100);
    const segundos = estado.respostas.reduce((s, r) => s + (r.segundos || 0), 0);

    Object.entries(porTema).forEach(([id, d]) => {
      if (meta.nomes[id]) Progresso.registrarQuiz(id, d.certas, d.total);
    });
    document.dispatchEvent(new CustomEvent("progresso:mudou"));

    raiz.innerHTML = `
      ${porTempo ? `<div class="alerta-bloco"><p class="alerta-titulo">Tempo esgotado</p>
        <p>A prova foi encerrada com ${total - estado.respostas.length} questão(ões) sem resposta.</p></div>` : ""}

      <section class="card sim-resumo">
        <div class="sim-nota-valor grande">${pct}%</div>
        <p class="sim-nota-rotulo">${certas} de ${total} corretas${
      puladas ? ` · ${puladas} pulada(s)` : ""
    }</p>
      </section>

      <section class="card">
        <h2 class="card-titulo">Desempenho por tema</h2>
        ${temas
          .map(
            (t) => `<div class="rel-tema">
              <div class="rel-tema-cab"><span>${esc(t.nome)}</span>
                <span class="rel-tema-pct">${t.pct}%</span></div>
              <div class="barra"><div class="barra-preenchida" style="width:${t.pct}%"></div></div>
              <div class="rel-tema-n">${t.certas} de ${t.total}</div>
            </div>`
          )
          .join("")}
      </section>

      <section class="card">
        <h2 class="card-titulo">Ritmo</h2>
        <div class="grade-stats">
          <div class="stat"><div class="stat-valor">${formatar(segundos)}</div><div class="stat-rotulo">tempo usado</div></div>
          <div class="stat"><div class="stat-valor">${
            estado.respostas.length ? Math.round(segundos / estado.respostas.length) : 0
          }s</div><div class="stat-rotulo">por questão</div></div>
          <div class="stat"><div class="stat-valor">${puladas}</div><div class="stat-rotulo">puladas</div></div>
          <div class="stat"><div class="stat-valor">${formatar(Math.max(0, estado.restante))}</div><div class="stat-rotulo">tempo restante</div></div>
        </div>
      </section>

      <section class="card">
        <h2 class="card-titulo">O que revisar</h2>
        ${
          fracos.length
            ? `<ol class="rel-fracos">${fracos
                .map(
                  (t) => `<li><strong>${esc(t.nome)}</strong> — ${t.pct}%.
                    <a href="modulo.html?m=${encodeURIComponent(t.id)}">abrir o módulo</a></li>`
                )
                .join("")}</ol>`
            : `<p>Nenhum tema abaixo de 70%. Vale aumentar o número de questões.</p>`
        }
      </section>

      <div class="sim-acoes-inline">
        <button type="button" class="btn btn-primario" id="btnNovaProva">Nova prova</button>
        <a class="btn" href="index.html">Voltar ao início</a>
      </div>`;

    raiz.querySelector("#btnNovaProva").addEventListener("click", () => iniciarPagina(raiz));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return { iniciarPagina, iniciar };
})();

window.Prova = Prova;
