/* ═══════════════════════════════════════════════════════════════
   app.js — shell comum a todas as páginas

   A NAVEGAÇÃO É INJETADA, NÃO COPIADA
   No projeto irmão o markup da sidebar estava copiado literalmente em
   cada HTML, e os links fixos ("Quiz geral", "Modo Prova") marcavam o
   item ativo por classe escrita à mão em cada arquivo. Bastava criar
   uma página nova e esquecer de atualizar as outras para a navegação
   divergir entre elas.

   Aqui existe uma única lista de destinos, abaixo, e cada página só
   declara qual é a sua chave. O item ativo sai correto por construção,
   e leva `aria-current="page"` — que lá não existia em lugar nenhum,
   deixando quem usa leitor de tela sem saber onde estava.
   ═══════════════════════════════════════════════════════════════ */

const App = (() => {
  const CHAVE_TEMA = "tema";

  const DESTINOS = [
    {
      grupo: "Prática",
      itens: [
        { chave: "quiz", href: "quiz.html", marca: "Q", rotulo: "Quiz geral", icone: "✓" },
        { chave: "prova", href: "prova.html", marca: "P", rotulo: "Modo prova", icone: "⏱" },
        { chave: "simulador", href: "simulador.html", marca: "S", rotulo: "Simulador de casos", icone: "⚖" },
      ],
    },
    {
      grupo: "Consulta",
      itens: [
        { chave: "vademecum", href: "vademecum.html", marca: "§", rotulo: "Vade Mecum", icone: "§" },
        { chave: "doutrina", href: "doutrina.html", marca: "❡", rotulo: "Doutrina comparada", icone: "❡" },
        { chave: "galeria", href: "galeria.html", marca: "▣", rotulo: "Galeria das aulas", icone: "▣" },
        { chave: "aula", href: "aula.html", marca: "♪", rotulo: "Áudio da aula", icone: "♪" },
      ],
    },
  ];

  /* No celular só cabem quatro; estes são os quatro. */
  const NO_RODAPE = ["inicio", "quiz", "simulador", "vademecum"];

  const esc = (s) => Modulos.esc(s);

  /* ── Tema ───────────────────────────────────────────────────
     O tema claro ("pergaminho") não é enfeite: em leitura longa sob
     luz forte é o que se usa. Fica no localStorage para não piscar
     entre páginas. */

  function aplicarTema(tema) {
    if (tema === "claro") document.documentElement.setAttribute("data-tema", "claro");
    else document.documentElement.removeAttribute("data-tema");

    const btn = document.getElementById("btnTema");
    if (btn) {
      btn.setAttribute("aria-pressed", String(tema === "claro"));
      btn.setAttribute(
        "aria-label",
        tema === "claro" ? "Mudar para o tema escuro" : "Mudar para o tema claro"
      );
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", tema === "claro" ? "#FAF8F5" : "#09090B");
  }

  function ligarTema() {
    let tema = Storage.ler(CHAVE_TEMA, "escuro");
    aplicarTema(tema);
    const btn = document.getElementById("btnTema");
    if (!btn) return;
    btn.addEventListener("click", () => {
      tema = tema === "claro" ? "escuro" : "claro";
      Storage.gravar(CHAVE_TEMA, tema);
      aplicarTema(tema);
    });
  }

  /* ── Sidebar ────────────────────────────────────────────────── */

  function ligarSidebar() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    const btn = document.getElementById("btnMenu");
    if (!sidebar || !btn) return;

    const fechar = () => {
      sidebar.classList.remove("aberta");
      if (backdrop) backdrop.classList.remove("visivel");
      btn.setAttribute("aria-expanded", "false");
    };
    const abrir = () => {
      sidebar.classList.add("aberta");
      if (backdrop) backdrop.classList.add("visivel");
      btn.setAttribute("aria-expanded", "true");
    };

    btn.addEventListener("click", () =>
      sidebar.classList.contains("aberta") ? fechar() : abrir()
    );
    if (backdrop) backdrop.addEventListener("click", fechar);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fechar();
    });
  }

  /* ── Navegação ──────────────────────────────────────────────── */

  function itemHTML(d, ativo) {
    return `<a class="nav-item${ativo ? " ativo" : ""}" href="${d.href}"
        ${ativo ? 'aria-current="page"' : ""}>
        <span class="nav-item-num" aria-hidden="true">${esc(d.marca)}</span>
        <span class="nav-item-txt">${esc(d.rotulo)}</span>
      </a>`;
  }

  async function montarSidebar(chaveAtiva, moduloAtivo) {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    let indice = null;
    try {
      indice = await Modulos.indice();
    } catch (e) {
      /* segue com a navegação fixa; os módulos aparecem quando der */
    }

    const listaModulos = indice
      ? indice.modulos
          .map((m) => {
            const pct = Progresso.percentual(m.id);
            const ativo = moduloAtivo === m.id;
            const semConteudo = m.status === "planejado";
            return `<a class="nav-item${ativo ? " ativo" : ""}"
                href="modulo.html?m=${encodeURIComponent(m.id)}"
                ${ativo ? 'aria-current="page"' : ""}>
                <span class="nav-item-num" aria-hidden="true">${String(m.ordem).padStart(2, "0")}</span>
                <span class="nav-item-txt">${esc(m.titulo)}</span>
                <span class="nav-item-pct${pct >= 85 ? "" : " apagado"}">${
              semConteudo ? "—" : pct + "%"
            }</span>
              </a>`;
          })
          .join("")
      : `<p class="sim-ajuda">Módulos indisponíveis.</p>`;

    sidebar.innerHTML =
      `<a class="nav-item${chaveAtiva === "inicio" ? " ativo" : ""}" href="index.html"
          ${chaveAtiva === "inicio" ? 'aria-current="page"' : ""}>
         <span class="nav-item-num" aria-hidden="true">◧</span>
         <span class="nav-item-txt">Início</span>
       </a>` +
      `<p class="nav-grupo">Módulos</p><nav aria-label="Módulos">${listaModulos}</nav>` +
      DESTINOS.map(
        (g) =>
          `<p class="nav-grupo">${esc(g.grupo)}</p><nav aria-label="${esc(g.grupo)}">` +
          g.itens.map((d) => itemHTML(d, d.chave === chaveAtiva)).join("") +
          `</nav>`
      ).join("");
  }

  function montarRodape(chaveAtiva) {
    const rodape = document.getElementById("bottomNav");
    if (!rodape) return;

    const todos = [
      { chave: "inicio", href: "index.html", rotulo: "Início", icone: "◧" },
      ...DESTINOS.flatMap((g) => g.itens),
    ];

    rodape.innerHTML = NO_RODAPE.map((chave) => {
      const d = todos.find((x) => x.chave === chave);
      if (!d) return "";
      const ativo = d.chave === chaveAtiva;
      return `<a class="bn-item${ativo ? " ativo" : ""}" href="${d.href}"
          ${ativo ? 'aria-current="page"' : ""}>
          <span class="bn-icone" aria-hidden="true">${esc(d.icone)}</span>${esc(
        d.rotulo
      )}</a>`;
    }).join("");
  }

  /**
   * @param {string} chave  qual destino é a página atual ("inicio", "quiz"…)
   * @param {string} [moduloAtivo]  id do módulo, quando em modulo.html
   */
  function iniciarShell(chave, moduloAtivo) {
    ligarTema();
    montarSidebar(chave, moduloAtivo).then(ligarSidebar);
    montarRodape(chave);
    document.addEventListener("progresso:mudou", () => montarSidebar(chave, moduloAtivo));
  }

  /* ── Utilidades de página ───────────────────────────────────── */

  const parametro = (nome) => new URLSearchParams(location.search).get(nome);

  function erroNaPagina(container, mensagem) {
    container.innerHTML = `<div class="vazio">
      <span class="vazio-icone" aria-hidden="true">⚠</span>
      <p>${esc(mensagem)}</p>
      <p class="sim-nota-fonte">Se você abriu por duplo clique, rode <code>node build.js</code>
      para regenerar o bundle.</p>
    </div>`;
  }

  return { iniciarShell, aplicarTema, parametro, erroNaPagina, DESTINOS };
})();

window.App = App;
