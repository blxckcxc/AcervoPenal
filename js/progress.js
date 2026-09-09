/* ═══════════════════════════════════════════════════════════════
   progress.js — progresso, streak e repetição espaçada

   DUAS DIMENSÕES SEPARADAS, DE PROPÓSITO

   O percentual do módulo continua sendo a média de leitura, questões
   e flashcards — o domínio TEÓRICO. Os casos práticos do simulador
   ficam numa métrica própria e NÃO entram nessa média.

   O motivo é concreto: `registrarQuiz` guarda o melhor aproveitamento
   já obtido (Math.max). Se uma rodada de casos práticos escrevesse
   ali, uma sequência de acertos em três casos inflaria a conclusão do
   módulo inteiro. E mexer na fórmula da média reescreveria em silêncio
   todo número de progresso que o estudante já viu.

   Então: teoria e prática são exibidas lado a lado, sem uma fingir
   ser a outra.
   ═══════════════════════════════════════════════════════════════ */

const Progresso = (() => {
  const CHAVE = "progresso";
  const CHAVE_ESTUDO = "estudo";

  // Repetição espaçada simplificada: 1 → 3 → 7 → 30 dias.
  const INTERVALOS = [1, 3, 7, 30];

  function tudo() {
    return Storage.ler(CHAVE, {});
  }

  function doModulo(id) {
    const base = {
      leitura: 0,
      questoes: 0,
      flashcards: 0,
      secoesLidas: [],
      questoesRespondidas: 0,
      questoesCertas: 0,
      estudado: false,
      ultimaRevisao: null,
      cards: {},
      // Dimensão prática — não entra no percentual teórico.
      casosPraticos: { rodadas: 0, casos: 0, ultimaNota: null, melhorNota: null },
    };
    const salvo = tudo()[id] || {};
    const p = Object.assign(base, salvo);
    // Progresso gravado por uma versão anterior não tem o campo novo.
    p.casosPraticos = Object.assign(
      { rodadas: 0, casos: 0, ultimaNota: null, melhorNota: null },
      salvo.casosPraticos || {}
    );
    return p;
  }

  function salvarModulo(id, dados) {
    const t = tudo();
    t[id] = Object.assign(doModulo(id), dados);
    Storage.gravar(CHAVE, t);
    registrarDiaDeEstudo();
    return t[id];
  }

  /** Domínio teórico: média das três frentes de estudo. */
  function percentual(id) {
    const p = doModulo(id);
    return Math.round((p.leitura + p.questoes + p.flashcards) / 3);
  }

  /** Dimensão prática, de 0 a 100. Lida à parte do percentual. */
  function pratica(id) {
    const c = doModulo(id).casosPraticos;
    if (!c.rodadas || c.melhorNota == null) return 0;
    return Math.round((c.melhorNota / 10) * 100);
  }

  function statusDoModulo(id, moduloMeta) {
    if (moduloMeta && moduloMeta.status === "em-breve") return "em-breve";
    const pct = percentual(id);
    if (pct >= 85) return "dominado";
    if (pct > 0) return "progresso";
    return "novo";
  }

  function marcarSecaoLida(id, secaoId, totalSecoes) {
    const p = doModulo(id);
    if (!p.secoesLidas.includes(secaoId)) p.secoesLidas.push(secaoId);
    p.leitura = totalSecoes
      ? Math.min(100, Math.round((p.secoesLidas.length / totalSecoes) * 100))
      : 0;
    return salvarModulo(id, p);
  }

  function registrarQuiz(id, certas, total) {
    const p = doModulo(id);
    p.questoesRespondidas += total;
    p.questoesCertas += certas;
    // O progresso de questões reflete o MELHOR desempenho já obtido,
    // não o último — refazer e errar não deve punir o histórico.
    const aproveitamento = total ? Math.round((certas / total) * 100) : 0;
    p.questoes = Math.max(p.questoes, aproveitamento);
    p.ultimaRevisao = new Date().toISOString();
    return salvarModulo(id, p);
  }

  /**
   * Registra uma rodada do simulador de casos práticos.
   * `nota` vem na escala 0–10, já com os ajustes manuais do estudante
   * aplicados (ver corretor.js).
   */
  function registrarCasosPraticos(id, nota, quantosCasos) {
    const p = doModulo(id);
    const c = p.casosPraticos;
    c.rodadas += 1;
    c.casos += quantosCasos || 1;
    c.ultimaNota = Math.round(nota * 10) / 10;
    c.melhorNota = c.melhorNota == null ? c.ultimaNota : Math.max(c.melhorNota, c.ultimaNota);
    p.ultimaRevisao = new Date().toISOString();
    return salvarModulo(id, p);
  }

  /* ── Repetição espaçada ─────────────────────────────────────── */

  function estadoCard(id, indice) {
    const p = doModulo(id);
    return p.cards[indice] || { nivel: 0, proximaEm: null };
  }

  function registrarCard(id, indice, acertou, totalCards) {
    const p = doModulo(id);
    const atual = p.cards[indice] || { nivel: 0, proximaEm: null };

    // Acertou sobe um degrau; errou volta ao começo. Simples e eficaz.
    const nivel = acertou ? Math.min(atual.nivel + 1, INTERVALOS.length) : 0;
    const dias = INTERVALOS[Math.max(0, nivel - 1)] || 1;
    const proxima = new Date();
    proxima.setDate(proxima.getDate() + (acertou ? dias : 0));

    p.cards[indice] = { nivel, proximaEm: proxima.toISOString() };

    const dominados = Object.values(p.cards).filter((c) => c.nivel >= 2).length;
    p.flashcards = totalCards
      ? Math.min(100, Math.round((dominados / totalCards) * 100))
      : 0;

    return salvarModulo(id, p);
  }

  /** Índices dos cards cuja revisão já venceu. */
  function cardsParaHoje(id, totalCards) {
    const p = doModulo(id);
    const agora = Date.now();
    const devidos = [];
    for (let i = 0; i < totalCards; i++) {
      const c = p.cards[i];
      if (!c || !c.proximaEm || new Date(c.proximaEm).getTime() <= agora) {
        devidos.push(i);
      }
    }
    return devidos;
  }

  /* ── Streak ─────────────────────────────────────────────────── */

  function hojeISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function registrarDiaDeEstudo() {
    const e = Storage.ler(CHAVE_ESTUDO, { dias: [], streak: 0, minutos: 0 });
    const hoje = hojeISO();
    if (e.dias.includes(hoje)) return e;

    e.dias.push(hoje);
    e.dias = e.dias.slice(-400);

    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    e.streak = e.dias.includes(ontem.toISOString().slice(0, 10))
      ? (e.streak || 0) + 1
      : 1;

    Storage.gravar(CHAVE_ESTUDO, e);
    return e;
  }

  function somarMinutos(min) {
    const e = Storage.ler(CHAVE_ESTUDO, { dias: [], streak: 0, minutos: 0 });
    e.minutos = (e.minutos || 0) + min;
    Storage.gravar(CHAVE_ESTUDO, e);
    return e;
  }

  function estatisticasGerais(modulos) {
    const t = tudo();
    const e = Storage.ler(CHAVE_ESTUDO, { dias: [], streak: 0, minutos: 0 });

    let respondidas = 0;
    let certas = 0;
    let somaPct = 0;
    let somaPratica = 0;
    let casos = 0;

    modulos.forEach((m) => {
      const p = t[m.id] || {};
      respondidas += p.questoesRespondidas || 0;
      certas += p.questoesCertas || 0;
      somaPct += percentual(m.id);
      somaPratica += pratica(m.id);
      casos += (p.casosPraticos && p.casosPraticos.casos) || 0;
    });

    const n = modulos.length || 1;
    return {
      progressoGeral: Math.round(somaPct / n),
      praticaGeral: Math.round(somaPratica / n),
      questoesRespondidas: respondidas,
      taxaAcerto: respondidas ? Math.round((certas / respondidas) * 100) : 0,
      casosResolvidos: casos,
      streak: e.streak || 0,
      minutos: e.minutos || 0,
    };
  }

  return {
    tudo,
    doModulo,
    salvarModulo,
    percentual,
    pratica,
    statusDoModulo,
    marcarSecaoLida,
    registrarQuiz,
    registrarCasosPraticos,
    estadoCard,
    registrarCard,
    cardsParaHoje,
    registrarDiaDeEstudo,
    somarMinutos,
    estatisticasGerais,
  };
})();

window.Progresso = Progresso;
