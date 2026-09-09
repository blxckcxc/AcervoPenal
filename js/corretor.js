/* ═══════════════════════════════════════════════════════════════
   corretor.js — correção da resposta discursiva

   O QUE ISTO É, E O QUE NÃO É
   Isto compara texto livre em português contra um espelho de quesitos
   por casamento de termos. É uma aproximação, e o desenho inteiro parte
   dessa premissa em vez de escondê-la. Ele NÃO entende o que o
   estudante escreveu; ele detecta se as teses esperadas aparecem, e se
   aparecem afirmadas ou negadas.

   Por isso a nota que sai daqui é rotulada "estimativa" na interface, o
   espelho fica visível ao lado da resposta, e cada quesito pode ser
   corrigido à mão pelo estudante. Um motor que fingisse certeza sobre
   texto livre seria pior que motor nenhum: mandaria o aluno estudar o
   que ele já sabe e o deixaria confiante no que errou.

   AS TRÊS DEFESAS
   1. Negação — "NÃO se trata de erro escusável" não pode pontuar num
      quesito que pede "erro escusável". A busca é feita dentro da frase
      onde o termo aparece, olhando para trás.
   2. Sinonímia — "inevitável" e "escusável" são a mesma tese. Cada
      quesito traz a lista de formas aceitas.
   3. Artigos — reconhece as grafias reais ("Art. 20", "artigo 20, §3º",
      "art. 20, caput") sem capturar número solto de outra frase.

   Sem DOM aqui de propósito: assim `tools/testar-corretor.js` roda o
   motor no Node contra entradas adversariais.
   ═══════════════════════════════════════════════════════════════ */

(function (raiz) {
  "use strict";

  /* ── Normalização ─────────────────────────────────────────────
     Minúsculas, sem acento. O § sobrevive porque é sinal de parágrafo
     e importa para a citação de artigo; os indicadores de ordinal
     (º e °) são descartados para que "art 20 §3º", "art 20 §3" e
     "art 20 §3°" virem a mesma coisa.

     OS TERMINADORES DE FRASE TAMBÉM SOBREVIVEM, e isso é essencial.
     A primeira versão deste arquivo os descartava junto com o resto da
     pontuação — e, sem eles, `frases()` devolvia o texto inteiro como
     uma frase só. O efeito era exatamente a falha que a defesa contra
     negação existe para impedir: em "Não houve dolo. Trata-se de erro
     escusável.", o "não" da primeira oração contaminava a tese
     afirmada na segunda. Os testes pegaram isso.                    */

  function normalizar(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[º°]/g, "")
      .replace(/[^a-z0-9§.;!?\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* ── Negação ──────────────────────────────────────────────────
     Marcadores sem "nao" precisam estar listados; os que contêm
     "nao" ("nao se trata", "nao configura") já são pegos pelo "nao"
     isolado, mas ficam aqui para documentar a intenção.

     A janela é limitada a 12 palavras porque a negação que importa
     está sempre perto: "nao se trata, no caso em exame, de erro
     escusavel" tem 7 palavras entre o marcador e o termo. Sem teto,
     uma frase longa faria um "nao" do início contaminar uma tese
     afirmada no fim.                                                */

  var NEGACOES = [
    "nao", "nem", "inexiste", "inexistindo", "afasta", "afastada",
    "afastado", "descabe", "descabida", "incabivel", "jamais", "nunca",
    "impossivel", "improcede", "ausencia de", "ausente", "exclui se",
    "ao contrario de", "diferentemente de", "distinto de", "sem que",
    "nao se trata", "nao configura", "nao incide", "nao se aplica",
    "nao ha", "nao havendo", "longe de",
  ];

  var JANELA_NEGACAO = 12;

  /* Abreviações jurídicas cujo ponto NÃO encerra frase. Sem esta
     proteção, "art. 73" viraria duas frases e abriria uma fronteira
     falsa bem no meio de uma oração — por onde uma negação escaparia. */
  var ABREVIACOES = /\b(arts?|incs?|pars?|caput|p|n|cf|ex|fls?|proc|min|rel|des|obs|cp|cpp|cf88|stf|stj)\./gi;
  var MARCA_PONTO = String.fromCharCode(1); // sentinela ausente de texto real

  /**
   * Recorta o texto em frases e devolve cada uma já normalizada.
   * Recebe o texto BRUTO: é nele que a pontuação ainda existe intacta
   * e que as abreviações podem ser protegidas antes do corte.
   */
  function frases(texto) {
    var bruto = String(texto == null ? "" : texto);

    var protegido = bruto.replace(ABREVIACOES, function (m) {
      return m.slice(0, -1) + MARCA_PONTO;
    });

    var partes = protegido
      .split(/[.;!?]+/)
      .map(function (t) {
        return normalizar(t.split(MARCA_PONTO).join("."));
      })
      .filter(function (t) {
        return t.length > 0;
      });

    return partes.length ? partes : [normalizar(bruto)];
  }

  /**
   * O termo, na posição dada dentro da frase, está sob negação?
   * Olha para trás no máximo JANELA_NEGACAO palavras, sem atravessar
   * o limite da frase — que é justamente o que o recorte já garante.
   */
  function estaNegado(fraseTexto, posicaoDoTermo) {
    var antes = fraseTexto.slice(0, posicaoDoTermo).trim();
    if (!antes) return false;

    var palavras = antes.split(" ");
    var janela = palavras.slice(-JANELA_NEGACAO).join(" ");

    for (var i = 0; i < NEGACOES.length; i++) {
      var marcador = NEGACOES[i];
      // Fronteira de palavra para "nao" não casar dentro de outra palavra.
      var re = new RegExp("(^|\\s)" + marcador.replace(/\s+/g, "\\s+") + "(\\s|$)");
      if (re.test(janela)) return true;
    }
    return false;
  }

  /* ── Casamento flexível de termo ──────────────────────────────
     O casamento literal reprovava resposta certa escrita de forma
     natural. Testando o simulador de verdade: o espelho pedia "erro
     acidental", o estudante escreveu "erro de tipo acidental sobre o
     objeto" — e levou zero. Ninguém escreve encaixando as palavras do
     espelho exatamente coladas.

     Agora as palavras do termo precisam aparecer NA ORDEM, tolerando
     até GAP_TERMO palavras intercaladas entre elas, e cada uma casa
     com suas flexões (o sufixo é livre: "culpa" alcança "culpado").
     A ordem e o teto de intervalo são o que evita casar palavras
     soltas de orações diferentes.                                   */

  var GAP_TERMO = 3;

  function regexDoTermo(alvo) {
    var palavras = alvo.split(" ").filter(Boolean);
    if (!palavras.length) return null;
    var corpo = palavras
      .map(function (p) {
        return p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w*";
      })
      .join("(?:\\s+\\w+){0," + GAP_TERMO + "}\\s+");
    return new RegExp("\\b" + corpo, "g");
  }

  /**
   * Procura um termo no texto e diz em que estado ele aparece.
   * Retorna "afirmado", "negado" ou "ausente".
   */
  function estadoDoTermo(texto, termo) {
    var alvo = normalizar(termo);
    if (!alvo) return "ausente";

    var re = regexDoTermo(alvo);
    if (!re) return "ausente";

    var achouNegado = false;
    var listaFrases = frases(texto);

    for (var i = 0; i < listaFrases.length; i++) {
      var f = listaFrases[i];
      re.lastIndex = 0;
      var m;
      while ((m = re.exec(f)) !== null) {
        // Uma ocorrência afirmada em qualquer lugar já vale o termo:
        // o estudante pode ter negado a hipótese antes de afirmá-la.
        if (!estaNegado(f, m.index)) return "afirmado";
        achouNegado = true;
        if (re.lastIndex === m.index) re.lastIndex++;
      }
    }

    return achouNegado ? "negado" : "ausente";
  }

  /* ── Citação de artigo ────────────────────────────────────────
     O prefixo "art"/"artigo" é obrigatório: sem ele, qualquer número
     solto na narrativa ("os 20 dias seguintes") viraria citação.     */

  var RE_ARTIGO =
    /art(?:igos?)?\.?\s*(\d{1,3})(?:\s*[.,]?\s*(?:§|paragrafo)\s*(\d{1,2})|\s*[.,]?\s*(caput)|\s*[.,]?\s*inc(?:iso)?\.?\s*([ivxlcdm]+))?/g;

  function extrairArtigos(textoNorm) {
    var achados = [];
    var m;
    RE_ARTIGO.lastIndex = 0;
    while ((m = RE_ARTIGO.exec(textoNorm)) !== null) {
      achados.push({
        numero: parseInt(m[1], 10),
        paragrafo: m[2] ? parseInt(m[2], 10) : null,
        caput: !!m[3],
        inciso: m[4] || null,
      });
    }
    return achados;
  }

  /**
   * O artigo exigido foi citado? Se o espelho pede parágrafo, o
   * parágrafo é exigido. Se não pede, o número basta — citar
   * "art. 20, §3º" satisfaz um quesito que só pedia "art. 20".
   */
  function artigoCitado(citados, exigido) {
    for (var i = 0; i < citados.length; i++) {
      var c = citados[i];
      if (c.numero !== exigido.numero) continue;
      if (exigido.paragrafo != null && c.paragrafo !== exigido.paragrafo) continue;
      return true;
    }
    return false;
  }

  /* ── Avaliação de um quesito ──────────────────────────────────── */

  function avaliarQuesito(texto, artigosCitados, quesito) {
    var termos = quesito.termos || [];
    var artigosExigidos = quesito.artigos || [];
    var exigeTodos = !!quesito.exigeTodos;

    // Termos
    var afirmados = [];
    var negados = [];
    var ausentes = [];
    termos.forEach(function (t) {
      var e = estadoDoTermo(texto, t);
      if (e === "afirmado") afirmados.push(t);
      else if (e === "negado") negados.push(t);
      else ausentes.push(t);
    });

    var termoOK =
      termos.length === 0
        ? null // quesito sem exigência de termo
        : exigeTodos
        ? afirmados.length === termos.length
        : afirmados.length > 0;

    // Artigos
    var faltando = artigosExigidos.filter(function (a) {
      return !artigoCitado(artigosCitados, a);
    });
    var artigoOK = artigosExigidos.length === 0 ? null : faltando.length === 0;

    // Combinação. `null` significa "não exigido" e não conta contra.
    var exigencias = [termoOK, artigoOK].filter(function (v) {
      return v !== null;
    });

    var estado;
    if (!exigencias.length) {
      estado = "ok"; // quesito sem critério automático nenhum
    } else if (exigencias.every(Boolean)) {
      estado = "ok";
    } else if (exigencias.some(Boolean)) {
      estado = "parcial";
    } else {
      estado = "falta";
    }

    var fator = estado === "ok" ? 1 : estado === "parcial" ? 0.5 : 0;

    return {
      id: quesito.id,
      quesito: quesito.quesito,
      valor: quesito.valor,
      pontos: Math.round(quesito.valor * fator * 100) / 100,
      estado: estado,
      automatico: estado,
      ajustadoAMao: false,
      termosAfirmados: afirmados,
      termosNegados: negados,
      termosAusentes: ausentes,
      artigosFaltando: faltando,
      // Motivo em linguagem de gente, para a interface não ter de deduzir.
      motivo: montarMotivo(estado, afirmados, negados, ausentes, faltando, exigeTodos),
    };
  }

  function listaArtigos(as) {
    return as
      .map(function (a) {
        return "art. " + a.numero + (a.paragrafo != null ? ", §" + a.paragrafo + "º" : "");
      })
      .join(", ");
  }

  function montarMotivo(estado, afirmados, negados, ausentes, faltando, exigeTodos) {
    var partes = [];

    if (afirmados.length) {
      partes.push("identifiquei “" + afirmados.join("”, “") + "”");
    }
    if (negados.length) {
      partes.push(
        "o termo “" +
          negados.join("”, “") +
          "” aparece, mas negado — pelo espelho, a tese deveria ser afirmada"
      );
    }
    if (estado !== "ok" && ausentes.length && !afirmados.length) {
      partes.push("não encontrei " + (exigeTodos ? "os termos" : "nenhum dos termos") + " esperados");
    } else if (estado !== "ok" && ausentes.length && exigeTodos) {
      partes.push("faltou “" + ausentes.join("”, “") + "”");
    }
    if (faltando.length) {
      partes.push("faltou citar " + listaArtigos(faltando));
    }

    if (!partes.length) return "quesito atendido";
    return partes.join("; ") + ".";
  }

  /* ── Correção de um caso inteiro ──────────────────────────────── */

  function corrigir(resposta, espelho) {
    var textoNorm = normalizar(resposta);
    var artigosCitados = extrairArtigos(textoNorm);
    var vazia = textoNorm.length < 10;

    var quesitos = (espelho || []).map(function (q) {
      if (vazia) {
        return {
          id: q.id,
          quesito: q.quesito,
          valor: q.valor,
          pontos: 0,
          estado: "falta",
          automatico: "falta",
          ajustadoAMao: false,
          termosAfirmados: [],
          termosNegados: [],
          termosAusentes: q.termos || [],
          artigosFaltando: q.artigos || [],
          motivo: "resposta em branco ou curta demais para avaliar.",
        };
      }
      return avaliarQuesito(resposta, artigosCitados, q);
    });

    return finalizar({
      quesitos: quesitos,
      artigosCitados: artigosCitados,
      palavras: textoNorm ? textoNorm.split(" ").length : 0,
      vazia: vazia,
    });
  }

  /** Recalcula a nota a partir do estado atual dos quesitos. */
  function finalizar(resultado) {
    var somaValor = 0;
    var somaPontos = 0;
    resultado.quesitos.forEach(function (q) {
      somaValor += q.valor;
      somaPontos += q.pontos;
    });

    // O espelho soma 1.00 por convenção, mas se algum caso somar
    // diferente a conversão continua correta.
    var proporcao = somaValor > 0 ? somaPontos / somaValor : 0;

    resultado.somaValor = Math.round(somaValor * 100) / 100;
    resultado.somaPontos = Math.round(somaPontos * 100) / 100;
    resultado.nota = Math.round(proporcao * 10 * 10) / 10;
    resultado.ajustes = resultado.quesitos.filter(function (q) {
      return q.ajustadoAMao;
    }).length;
    return resultado;
  }

  /**
   * O estudante discorda da correção de um quesito.
   * `acertou` verdadeiro dá o valor cheio; falso zera. Voltar a null
   * devolve o quesito ao veredito automático.
   */
  function ajustar(resultado, quesitoId, acertou) {
    resultado.quesitos.forEach(function (q) {
      if (q.id !== quesitoId) return;
      if (acertou === null || acertou === undefined) {
        q.estado = q.automatico;
        q.pontos =
          Math.round(
            q.valor * (q.automatico === "ok" ? 1 : q.automatico === "parcial" ? 0.5 : 0) * 100
          ) / 100;
        q.ajustadoAMao = false;
      } else {
        q.estado = acertou ? "ok" : "falta";
        q.pontos = acertou ? q.valor : 0;
        q.ajustadoAMao = true;
      }
    });
    return finalizar(resultado);
  }

  var Corretor = {
    normalizar: normalizar,
    frases: frases,
    estaNegado: estaNegado,
    estadoDoTermo: estadoDoTermo,
    extrairArtigos: extrairArtigos,
    artigoCitado: artigoCitado,
    avaliarQuesito: avaliarQuesito,
    corrigir: corrigir,
    ajustar: ajustar,
    JANELA_NEGACAO: JANELA_NEGACAO,
    NEGACOES: NEGACOES,
  };

  if (typeof module === "object" && module.exports) {
    module.exports = Corretor;
  } else {
    raiz.Corretor = Corretor;
  }
})(typeof window !== "undefined" ? window : globalThis);
