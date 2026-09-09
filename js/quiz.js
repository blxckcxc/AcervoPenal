/* ═══════════════════════════════════════════════════════════════
   quiz.js — questões objetivas curtas

   Distinto do simulador de casos: aqui a questão é curta e cobra um
   conceito ou um dispositivo; lá é narrativa fática e cobra subsunção.
   Os dois bancos são separados de propósito, e o progresso também.

   Três formatos: múltipla escolha, verdadeiro/falso e lacuna (cloze).
   ═══════════════════════════════════════════════════════════════ */

const Quiz = (() => {
  const esc = (s) => Modulos.esc(s);

  const normalizar = (s) =>
    String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9/ ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  /* ── Motor reaproveitável ─────────────────────────────────── */

  function criar(container, questoes, opcoes = {}) {
    const estado = {
      questoes: questoes.slice(),
      indice: 0,
      respostas: [],
      moduloId: opcoes.moduloId || null,
    };

    function render() {
      const q = estado.questoes[estado.indice];
      if (!q) return resultado();

      const n = estado.indice + 1;
      const total = estado.questoes.length;
      const rotuloTipo =
        { multipla: "Múltipla escolha", vf: "Verdadeiro ou falso", cloze: "Complete" }[q.tipo] ||
        q.tipo;

      container.innerHTML = `
        <div class="quiz-topo">
          <span class="sim-passo">Questão ${n} de ${total}</span>
          <div class="barra"><div class="barra-preenchida" style="width:${((n - 1) / total) * 100}%"></div></div>
        </div>
        <article class="card questao">
          <span class="selo-fonte selo-misto questao-tipo">${esc(rotuloTipo)}</span>
          <p class="questao-enunciado enunciado">${esc(q.enunciado)}</p>
          <div class="corpo-questao" id="corpoQuestao"></div>
          <div class="area-feedback" id="areaFeedback"></div>
        </article>`;

      const corpo = container.querySelector("#corpoQuestao");
      if (q.tipo === "vf") renderVF(q, corpo);
      else if (q.tipo === "cloze") renderCloze(q, corpo);
      else renderMultipla(q, corpo);
    }

    function renderMultipla(q, corpo) {
      corpo.innerHTML = `<div class="sim-alts">${q.alternativas
        .map(
          (a, i) => `<button type="button" class="sim-alt" data-i="${i}">
            <span class="sim-alt-letra">${"ABCDE"[i]}</span>
            <span class="sim-alt-txt">${esc(a.texto)}</span>
          </button>`
        )
        .join("")}</div>`;

      corpo.querySelectorAll(".sim-alt").forEach((b) => {
        b.addEventListener("click", () => {
          const i = Number(b.dataset.i);
          const acertou = !!q.alternativas[i].correta;
          corpo.querySelectorAll(".sim-alt").forEach((o, k) => {
            o.disabled = true;
            if (q.alternativas[k].correta) o.classList.add("correta");
            else if (o === b) o.classList.add("errada");
          });
          feedback(
            acertou,
            `<ul class="sim-justificativas">${q.alternativas
              .map(
                (a, k) =>
                  `<li class="${a.correta ? "just-ok" : "just-nok"}">
                     <strong>${"ABCDE"[k]}.</strong> ${esc(a.justificativa || "")}</li>`
              )
              .join("")}</ul>`,
            q
          );
        });
      });
    }

    function renderVF(q, corpo) {
      corpo.innerHTML = `<div class="sim-alts">
          <button type="button" class="sim-alt" data-v="true">
            <span class="sim-alt-letra">V</span><span class="sim-alt-txt">Verdadeiro</span></button>
          <button type="button" class="sim-alt" data-v="false">
            <span class="sim-alt-letra">F</span><span class="sim-alt-txt">Falso</span></button>
        </div>`;

      corpo.querySelectorAll(".sim-alt").forEach((b) => {
        b.addEventListener("click", () => {
          const escolha = b.dataset.v === "true";
          const acertou = escolha === q.resposta;
          corpo.querySelectorAll(".sim-alt").forEach((o) => {
            o.disabled = true;
            const v = o.dataset.v === "true";
            if (v === q.resposta) o.classList.add("correta");
            else if (o === b) o.classList.add("errada");
          });
          feedback(acertou, `<p>${esc(q.justificativa || "")}</p>`, q);
        });
      });
    }

    function renderCloze(q, corpo) {
      corpo.innerHTML = `
        <label class="visually-hidden" for="clozeCampo">Sua resposta</label>
        <input type="text" id="clozeCampo" class="vm-campo cloze-campo" autocomplete="off"
          placeholder="Digite a resposta">
        <div class="sim-acoes-inline">
          <button type="button" class="btn btn-primario" id="btnResponder">Responder</button>
        </div>`;

      const campo = corpo.querySelector("#clozeCampo");
      campo.focus();

      const responder = () => {
        const dado = normalizar(campo.value);
        const aceitas = [q.resposta, ...(q.aceitas || [])].map(normalizar);
        const acertou = aceitas.includes(dado);
        campo.disabled = true;
        campo.classList.add(acertou ? "correta" : "errada");
        corpo.querySelector("#btnResponder").disabled = true;
        feedback(
          acertou,
          `<p><strong>Resposta:</strong> ${esc(q.resposta)}</p><p>${esc(q.justificativa || "")}</p>`,
          q
        );
      };

      corpo.querySelector("#btnResponder").addEventListener("click", responder);
      campo.addEventListener("keydown", (e) => {
        if (e.key === "Enter") responder();
      });
    }

    function feedback(acertou, html, q) {
      estado.respostas.push({ q, acertou });
      const ultimo = estado.indice >= estado.questoes.length - 1;

      container.querySelector("#areaFeedback").innerHTML = `
        <div class="sim-veredito ${acertou ? "ok" : "nok"}">${acertou ? "Correto." : "Incorreto."}</div>
        ${html}
        ${q.referencia ? `<p class="nota-fonte">Fonte: ${esc(q.referencia)}</p>` : ""}
        <button type="button" class="btn btn-primario btn-bloco" id="btnProxima">
          ${ultimo ? "Ver resultado" : "Próxima questão"}
        </button>`;

      const prox = container.querySelector("#btnProxima");
      prox.addEventListener("click", () => {
        estado.indice++;
        if (estado.indice >= estado.questoes.length) resultado();
        else {
          render();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
      prox.focus();
    }

    function resultado() {
      const certas = estado.respostas.filter((r) => r.acertou).length;
      const total = estado.respostas.length || 1;
      const pct = Math.round((certas / total) * 100);
      const faixa = pct >= 70 ? "ok" : "nok";
      const erradas = estado.respostas.filter((r) => !r.acertou).map((r) => r.q);

      if (estado.moduloId) {
        Progresso.registrarQuiz(estado.moduloId, certas, total);
        document.dispatchEvent(new CustomEvent("progresso:mudou"));
      }

      container.innerHTML = `
        <div class="card sim-resumo">
          <div class="sim-nota-valor grande">${pct}%</div>
          <p class="sim-nota-rotulo">${certas} de ${total} corretas</p>
          <div class="sim-veredito ${faixa}" style="margin-top: var(--esp-4)">
            ${
              pct >= 85
                ? "Domínio sólido deste recorte."
                : pct >= 70
                ? "Bom desempenho; revise o que escapou."
                : pct >= 50
                ? "Metade do caminho. Vale reler o módulo antes de repetir."
                : "Convém voltar ao conteúdo antes de tentar de novo."
            }
          </div>
          <div class="sim-acoes-inline" style="justify-content:center">
            ${
              erradas.length
                ? `<button type="button" class="btn btn-primario" id="btnErradas">
                     Refazer as ${erradas.length} erradas</button>`
                : ""
            }
            <button type="button" class="btn" id="btnTudo">Refazer tudo</button>
          </div>
        </div>`;

      const todas = questoes.slice();
      const bErr = container.querySelector("#btnErradas");
      if (bErr) bErr.addEventListener("click", () => criar(container, erradas, opcoes));
      container
        .querySelector("#btnTudo")
        .addEventListener("click", () => criar(container, todas, opcoes));
    }

    render();
  }

  /* ── Página de quiz geral ─────────────────────────────────── */

  const embaralhar = (a) => {
    const v = a.slice();
    for (let i = v.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [v[i], v[j]] = [v[j], v[i]];
    }
    return v;
  };

  async function iniciarPagina(raiz) {
    raiz.innerHTML = `<p class="vazio">Carregando as questões…</p>`;

    let banco, indice;
    try {
      [banco, indice] = await Promise.all([Modulos.bancoQuestoes(), Modulos.indice()]);
    } catch (e) {
      App.erroNaPagina(raiz, e.message);
      return;
    }

    const comQuestoes = indice.modulos.filter(
      (m) => (banco.bancos[m.id] || []).length > 0
    );

    if (!comQuestoes.length) {
      raiz.innerHTML = `<div class="vazio">
        <span class="vazio-icone" aria-hidden="true">✎</span>
        <p>O banco de questões objetivas ainda está vazio.</p>
        <p class="nota-fonte">Enquanto isso, o
        <a href="simulador.html">simulador de casos práticos</a> tem 64 casos prontos.</p>
      </div>`;
      return;
    }

    const escolhidos = new Set(comQuestoes.map((m) => m.id));

    const desenharConfig = () => {
      const disponiveis = comQuestoes
        .filter((m) => escolhidos.has(m.id))
        .reduce((s, m) => s + (banco.bancos[m.id] || []).length, 0);

      raiz.innerHTML = `
        <section class="card">
          <h2 class="card-titulo">Assuntos</h2>
          <div class="sim-chips" id="chipsQuiz">
            ${comQuestoes
              .map(
                (m) => `<button type="button" class="chip" data-m="${esc(m.id)}"
                  aria-pressed="${escolhidos.has(m.id)}">
                  <span class="chip-marca" aria-hidden="true">✓</span>${esc(m.titulo)}
                  <span class="chip-contagem">${(banco.bancos[m.id] || []).length}</span>
                </button>`
              )
              .join("")}
          </div>
          <p class="sim-disponivel" role="status" aria-live="polite">
            <strong>${disponiveis}</strong> quest${disponiveis === 1 ? "ão" : "ões"} com este filtro.
          </p>
          <button type="button" class="btn btn-primario btn-bloco" id="btnIniciarQuiz"
            ${disponiveis ? "" : "disabled"}>Começar</button>
        </section>`;

      raiz.querySelectorAll("#chipsQuiz .chip").forEach((b) => {
        b.addEventListener("click", () => {
          const id = b.dataset.m;
          if (escolhidos.has(id)) escolhidos.delete(id);
          else escolhidos.add(id);
          desenharConfig();
        });
      });

      raiz.querySelector("#btnIniciarQuiz").addEventListener("click", () => {
        const questoes = embaralhar(
          comQuestoes
            .filter((m) => escolhidos.has(m.id))
            .flatMap((m) => (banco.bancos[m.id] || []).map((q) => ({ ...q, moduloId: m.id })))
        );
        // Sem moduloId no motor: o quiz geral mistura módulos, e gravar
        // o aproveitamento num só deles falsearia o progresso.
        criar(raiz, questoes, {});
      });
    };

    desenharConfig();
  }

  return { criar, iniciarPagina, embaralhar };
})();

window.Quiz = Quiz;
