/* ═══════════════════════════════════════════════════════════════
   storage.js — persistência local

   Tudo em localStorage, sob um prefixo único. Nenhuma chamada de
   rede: nada do que o estudante escreve sai desta máquina — o que
   importa aqui, porque o simulador guarda respostas discursivas.
   ═══════════════════════════════════════════════════════════════ */

const Storage = (() => {
  const PREFIXO = "acervo.penal.";

  /**
   * localStorage pode lançar exceção: janela anônima, cota estourada,
   * navegador configurado para bloquear dados de site. O acervo nunca
   * pode quebrar por causa disso — na pior hipótese, ele só esquece.
   */
  function ler(chave, padrao = null) {
    try {
      const bruto = localStorage.getItem(PREFIXO + chave);
      return bruto === null ? padrao : JSON.parse(bruto);
    } catch (e) {
      console.warn("[storage] leitura falhou:", chave, e);
      return padrao;
    }
  }

  function gravar(chave, valor) {
    try {
      localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
      return true;
    } catch (e) {
      console.warn("[storage] gravação falhou:", chave, e);
      return false;
    }
  }

  function remover(chave) {
    try {
      localStorage.removeItem(PREFIXO + chave);
    } catch (e) {
      /* silencioso de propósito */
    }
  }

  function limparTudo() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIXO))
        .forEach((k) => localStorage.removeItem(k));
      return true;
    } catch (e) {
      return false;
    }
  }

  function disponivel() {
    try {
      const t = PREFIXO + "__teste__";
      localStorage.setItem(t, "1");
      localStorage.removeItem(t);
      return true;
    } catch (e) {
      return false;
    }
  }

  return { ler, gravar, remover, limparTudo, disponivel };
})();

window.Storage = Storage;
