/* ═══════════════════════════════════════════════════════════════
   aula.js — player do áudio com velocidade e marcos temáticos

   OS MINUTOS NASCEM VAZIOS, E ISSO É DELIBERADO
   Os TEMAS dos marcos saem dos slides catalogados — são verificáveis.
   Os MINUTOS não: eu não escutei a gravação e não há transcrição.
   Preencher "00:14:32" para a lista parecer completa seria inventar o
   que a aula diz e quando.

   Então cada marco nasce sem tempo e com um campo para você preencher
   ao ouvir. O que você digitar fica no localStorage — os marcos com
   tempo sobem para uma lista clicável; os pendentes seguem abaixo,
   visíveis, para não sumirem da sua vista.
   ═══════════════════════════════════════════════════════════════ */

const Aula = (() => {
  const esc = (s) => Modulos.esc(s);
  const CHAVE = "aula.tempos";
  const VELOCIDADES = [0.75, 1, 1.25, 1.5, 2];

  let audio = null;
  let tempos = {};

  const chaveDoMarco = (aula, i) => `${aula}#${i}`;

  function paraSegundos(txt) {
    const limpo = String(txt || "").trim();
    if (!limpo) return null;
    const partes = limpo.split(":").map((p) => Number(p));
    if (partes.some((p) => !Number.isFinite(p) || p < 0)) return null;
    if (partes.length === 3) return partes[0] * 3600 + partes[1] * 60 + partes[2];
    if (partes.length === 2) return partes[0] * 60 + partes[1];
    if (partes.length === 1) return partes[0];
    return null;
  }

  function paraTexto(seg) {
    if (seg == null) return "";
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = Math.floor(seg % 60);
    const dd = (v) => String(v).padStart(2, "0");
    return h ? `${h}:${dd(m)}:${dd(s)}` : `${m}:${dd(s)}`;
  }

  function marcoHTML(m, aula, i) {
    const k = chaveDoMarco(aula, i);
    const seg = tempos[k] != null ? tempos[k] : m.inicioSegundos;
    const definido = seg != null;

    return `<li class="marco">
        ${
          definido
            ? `<button type="button" class="marco-tempo btn btn-sm btn-fantasma" data-ir="${seg}"
                 aria-label="Ir para ${paraTexto(seg)}">${paraTexto(seg)}</button>`
            : `<span class="marco-tempo pendente">--:--</span>`
        }
        <span class="marco-txt">${esc(m.titulo)}
          <span class="marco-fonte">${esc(m.fonte)}</span>
        </span>
        <label class="visually-hidden" for="t-${esc(k)}">Tempo de "${esc(m.titulo)}"</label>
        <input class="marco-campo" id="t-${esc(k)}" data-k="${esc(k)}" type="text"
          inputmode="numeric" placeholder="0:00" value="${definido ? paraTexto(seg) : ""}">
      </li>`;
  }

  async function iniciar(raiz) {
    raiz.innerHTML = `<p class="vazio">Carregando…</p>`;

    let dados;
    try {
      dados = await Modulos.carregarJSON("data/audio_capitulos.json");
    } catch (e) {
      App.erroNaPagina(raiz, e.message);
      return;
    }

    tempos = Storage.ler(CHAVE, {});

    const totalMarcos = dados.gruposPorAula.reduce((s, g) => s + g.marcos.length, 0);
    const comTempo = Object.values(tempos).filter((v) => v != null).length;

    raiz.innerHTML = `
      <div class="player">
        <audio id="audioAula" controls preload="metadata" src="${esc(dados.arquivo)}">
          Seu navegador não reproduz áudio embutido.
        </audio>
        <div class="player-controles">
          <span class="player-rotulo">Velocidade</span>
          ${VELOCIDADES.map(
            (v) => `<button type="button" class="btn btn-sm vel" data-v="${v}"
              aria-pressed="${v === 1}">${String(v).replace(".", ",")}×</button>`
          ).join("")}
        </div>
        <p class="sim-nota-fonte">
          ${esc(dados.duracaoLegivel)} · ${esc(dados.origem.tamanhoFinal)} ·
          convertido de ${esc(dados.origem.tamanhoOriginal)} com
          <code>${esc(dados.origem.conversao)}</code>.
          Fica fora do cache offline de propósito: são dezenas de MB que ninguém pediu para baixar.
        </p>
      </div>

      <section class="secao" style="margin-top: var(--esp-8)">
        <div class="alerta-bloco">
          <p class="alerta-titulo">De qual aula é esta gravação?</p>
          <p>${esc(dados.aulaDeOrigem.nota)}</p>
        </div>

        <div class="destaque">
          <p class="destaque-titulo">Os minutos estão em aberto — e é você quem os preenche</p>
          <p>${esc(dados.sobre)}</p>
          <p><strong>${comTempo} de ${totalMarcos}</strong> marcos com tempo definido.</p>
        </div>

        ${dados.gruposPorAula
          .map(
            (g) => `<div class="grupo-aula">
              <h3>${esc(g.rotulo)}</h3>
              <ul class="marcos" data-aula="${esc(g.aula)}">
                ${g.marcos.map((m, i) => marcoHTML(m, g.aula, i)).join("")}
              </ul>
            </div>`
          )
          .join("")}
      </section>`;

    audio = raiz.querySelector("#audioAula");

    raiz.querySelectorAll(".vel").forEach((b) => {
      b.addEventListener("click", () => {
        const v = Number(b.dataset.v);
        audio.playbackRate = v;
        raiz
          .querySelectorAll(".vel")
          .forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      });
    });

    raiz.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ir]");
      if (!b) return;
      audio.currentTime = Number(b.dataset.ir);
      audio.play().catch(() => {});
    });

    raiz.querySelectorAll(".marco-campo").forEach((campo) => {
      const gravar = () => {
        const seg = paraSegundos(campo.value);
        if (campo.value.trim() && seg == null) {
          campo.classList.add("errada");
          return;
        }
        campo.classList.remove("errada");
        if (seg == null) delete tempos[campo.dataset.k];
        else tempos[campo.dataset.k] = seg;
        Storage.gravar(CHAVE, tempos);
        iniciar(raiz); // redesenha para o marco virar botão clicável
      };
      campo.addEventListener("change", gravar);
      campo.addEventListener("keydown", (e) => {
        if (e.key === "Enter") gravar();
      });
    });
  }

  return { iniciar };
})();

window.Aula = Aula;
