/* ═══════════════════════════════════════════════════════════════
   app.js — shell comum a todas as páginas
   Sidebar, menu do celular, tema e a lista de módulos.
   ═══════════════════════════════════════════════════════════════ */

const App = (() => {
  const CHAVE_TEMA = "tema";

  /* ── Tema ───────────────────────────────────────────────────
     O tema claro ("pergaminho") não é um enfeite: em prova impressa
     e em leitura longa sob luz forte ele é o que se usa. Fica no
     localStorage para não piscar entre páginas. */

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

  /* ── Lista de módulos ───────────────────────────────────────
     Cada item mostra o selo de origem, porque quatro dos oito
     módulos não têm material de aula. */

  async function montarModulos(ativo) {
    const alvo = document.getElementById("navModulos");
    if (!alvo) return;

    let indice;
    try {
      indice = await Modulos.indice();
    } catch (e) {
      alvo.innerHTML = `<p class="sim-ajuda">${Modulos.esc(e.message)}</p>`;
      return;
    }

    const desenhar = () => {
      alvo.innerHTML = indice.modulos
        .map((m) => {
          const pct = Progresso.percentual(m.id);
          const eAtivo = ativo === m.id;
          const planejado = m.status === "planejado";
          return `<a class="nav-item${eAtivo ? " ativo" : ""}"
              href="modulo.html?m=${encodeURIComponent(m.id)}"
              ${eAtivo ? 'aria-current="page"' : ""}>
            <span class="nav-item-num" aria-hidden="true">${String(m.ordem).padStart(2, "0")}</span>
            <span class="nav-item-txt">${Modulos.esc(m.titulo)}</span>
            <span class="nav-item-pct${pct >= 85 ? "" : " apagado"}">${planejado ? "—" : pct + "%"}</span>
          </a>`;
        })
        .join("");
    };

    desenhar();
    document.addEventListener("progresso:mudou", desenhar);
  }

  function iniciarShell(moduloAtivo) {
    ligarTema();
    ligarSidebar();
    montarModulos(moduloAtivo || null);
  }

  return { iniciarShell, aplicarTema };
})();

window.App = App;
