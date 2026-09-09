#!/usr/bin/env node
/*
 * testar-corretor.js — entradas adversariais contra o motor de correção.
 *
 *     node tools/testar-corretor.js
 *
 * O motor casa termos em texto livre, e isso erra por natureza. Estes
 * testes existem para fixar QUAIS erros já foram enfrentados, de modo
 * que uma mudança futura no corretor não reintroduza um deles em
 * silêncio. Os casos marcados LIMITE são falhas conhecidas e aceitas:
 * eles documentam a fronteira do que este desenho alcança.
 */

const C = require("../js/corretor.js");

let passou = 0;
let falhou = 0;
const falhas = [];

function ok(nome, condicao, detalhe) {
  if (condicao) {
    passou++;
  } else {
    falhou++;
    falhas.push({ nome, detalhe });
  }
  const marca = condicao ? "  ok  " : " FALHA";
  console.log(`${marca}  ${nome}${condicao ? "" : "\n         " + detalhe}`);
}

/* ── Normalização ─────────────────────────────────────────────── */
console.log("\n── normalização ──");

ok(
  "remove acentos",
  C.normalizar("Erro Inevitável e Escusável") === "erro inevitavel e escusavel",
  `recebi: "${C.normalizar("Erro Inevitável e Escusável")}"`
);
ok(
  "descarta o indicador de ordinal, preserva o §",
  C.normalizar("art. 20, §3º") === "art. 20 §3",
  `recebi: "${C.normalizar("art. 20, §3º")}"`
);
// O ponto final SOBREVIVE de propósito: é a fronteira de frase de que a
// defesa contra negação depende. Ver o cabeçalho de corretor.js.
ok(
  "colapsa espaços mas preserva o fim de frase",
  C.normalizar("  a,,,  b.  ") === "a b.",
  `recebi: "${C.normalizar("  a,,,  b.  ")}"`
);

/* ── Extração de artigos ──────────────────────────────────────── */
console.log("\n── citação de artigo ──");

const grafias = [
  ["Art. 20", 20, null],
  ["art. 20 do CP", 20, null],
  ["artigo 20, §3º", 20, 3],
  ["art 20 parágrafo 3", 20, 3],
  ["Art. 20, caput", 20, null],
  ["artigos 73", 73, null],
];
grafias.forEach(([txt, num, par]) => {
  const achados = C.extrairArtigos(C.normalizar(txt));
  const bate = achados.length > 0 && achados[0].numero === num && achados[0].paragrafo === par;
  ok(`reconhece "${txt}"`, bate, `recebi: ${JSON.stringify(achados)}`);
});

ok(
  "NÃO captura número solto",
  C.extrairArtigos(C.normalizar("passou 20 dias e depois 73 horas")).length === 0,
  `recebi: ${JSON.stringify(C.extrairArtigos(C.normalizar("passou 20 dias e depois 73 horas")))}`
);

ok(
  "quesito que pede só o número aceita citação com parágrafo",
  C.artigoCitado([{ numero: 20, paragrafo: 3 }], { numero: 20, paragrafo: null }) === true,
  "deveria aceitar"
);
ok(
  "quesito que pede o parágrafo NÃO aceita só o número",
  C.artigoCitado([{ numero: 20, paragrafo: null }], { numero: 20, paragrafo: 3 }) === false,
  "não deveria aceitar"
);

/* ── Negação ──────────────────────────────────────────────────── */
console.log("\n── negação ──");

ok(
  "afirmação simples pontua",
  C.estadoDoTermo(C.normalizar("Trata-se de erro escusável."), "erro escusavel") === "afirmado",
  "esperava afirmado"
);
ok(
  "negação direta bloqueia",
  C.estadoDoTermo(C.normalizar("Não se trata de erro escusável."), "erro escusavel") === "negado",
  `recebi: ${C.estadoDoTermo(C.normalizar("Não se trata de erro escusável."), "erro escusavel")}`
);
ok(
  "negação com aposto intercalado ainda bloqueia",
  C.estadoDoTermo(
    C.normalizar("Não se trata, no caso em exame, de erro escusável."),
    "erro escusavel"
  ) === "negado",
  "esperava negado"
);
ok(
  "'descabe' bloqueia",
  C.estadoDoTermo(C.normalizar("Descabe falar em erro escusável aqui."), "erro escusavel") ===
    "negado",
  "esperava negado"
);
ok(
  "'inexiste' bloqueia",
  C.estadoDoTermo(C.normalizar("Inexiste erro escusável."), "erro escusavel") === "negado",
  "esperava negado"
);
ok(
  "negação NÃO atravessa o ponto final",
  C.estadoDoTermo(
    C.normalizar("Não houve dolo. Trata-se de erro escusável."),
    "erro escusavel"
  ) === "afirmado",
  "a negação da primeira frase não pode contaminar a segunda"
);
ok(
  "negação NÃO atravessa o ponto e vírgula",
  C.estadoDoTermo(
    C.normalizar("Não há dolo direto; configura-se erro escusável."),
    "erro escusavel"
  ) === "afirmado",
  "esperava afirmado"
);
ok(
  "negada antes e afirmada depois vale como afirmada",
  C.estadoDoTermo(
    C.normalizar("Não é erro inevitável. Na verdade é erro inevitável mesmo."),
    "erro inevitavel"
  ) === "afirmado",
  "uma ocorrência afirmada em qualquer frase basta"
);
ok(
  "'nao' distante além da janela não contamina",
  C.estadoDoTermo(
    C.normalizar(
      "Não cabe aqui discutir a teoria da imputação objetiva do resultado " +
        "tal como formulada pela doutrina alemã contemporânea, e sim reconhecer o erro escusável"
    ),
    "erro escusavel"
  ) === "afirmado",
  "com mais de 12 palavras de distância a negação não deveria alcançar"
);

/* ── Sinonímia ────────────────────────────────────────────────── */
console.log("\n── sinonímia ──");

const quesitoSin = {
  id: "q1",
  quesito: "Erro de tipo escusável",
  valor: 1.0,
  termos: ["erro escusavel", "erro inevitavel"],
  exigeTodos: false,
};
["Houve erro escusável.", "Houve erro inevitável."].forEach((txt) => {
  const n = C.normalizar(txt);
  const r = C.avaliarQuesito(n, C.extrairArtigos(n), quesitoSin);
  ok(`sinônimo aceito: "${txt}"`, r.estado === "ok", `recebi estado ${r.estado}`);
});

const quesitoTodos = Object.assign({}, quesitoSin, { exigeTodos: true });
{
  const n = C.normalizar("Houve erro escusável.");
  const r = C.avaliarQuesito(n, C.extrairArtigos(n), quesitoTodos);
  ok("exigeTodos cobra os dois termos", r.estado !== "ok", `recebi estado ${r.estado}`);
}

/* ── Nota e parcialidade ──────────────────────────────────────── */
console.log("\n── nota ──");

const espelho = [
  {
    id: "q1",
    quesito: "Tipificação: homicídio doloso consumado",
    valor: 0.3,
    termos: ["homicidio doloso"],
    artigos: [{ numero: 121 }],
  },
  {
    id: "q2",
    quesito: "Erro na execução — aberratio ictus",
    valor: 0.4,
    termos: ["aberratio ictus", "erro na execucao"],
    artigos: [{ numero: 73 }],
  },
  {
    id: "q3",
    quesito: "Responde pela vítima pretendida",
    valor: 0.3,
    termos: ["vitima pretendida"],
  },
];

{
  const r = C.corrigir(
    "Trata-se de homicídio doloso consumado, na forma do art. 121 do CP. " +
      "Houve erro na execução (aberratio ictus), art. 73. " +
      "O agente responde considerando as condições da vítima pretendida.",
    espelho
  );
  ok("resposta completa tira 10", r.nota === 10, `recebi ${r.nota}`);
}

{
  // Cita o artigo mas não usa o termo → parcial (metade).
  const r = C.corrigir(
    "Aplica-se o art. 73 do CP ao caso. Nada mais a alegar sobre o tema.",
    espelho
  );
  const q2 = r.quesitos.find((q) => q.id === "q2");
  ok("artigo sem termo dá parcial", q2.estado === "parcial", `recebi ${q2.estado}`);
  ok("parcial vale metade", q2.pontos === 0.2, `recebi ${q2.pontos}`);
}

{
  // Usa o termo mas não cita o artigo → parcial.
  const r = C.corrigir("Houve aberratio ictus, sem dúvida nenhuma no caso.", espelho);
  const q2 = r.quesitos.find((q) => q.id === "q2");
  ok("termo sem artigo dá parcial", q2.estado === "parcial", `recebi ${q2.estado}`);
}

{
  const r = C.corrigir("", espelho);
  ok("resposta em branco tira 0", r.nota === 0, `recebi ${r.nota}`);
  ok("resposta em branco é sinalizada", r.vazia === true, "esperava vazia=true");
}

{
  const r = C.corrigir(
    "Não se trata de aberratio ictus, art. 73, e sim de outra figura.",
    espelho
  );
  const q2 = r.quesitos.find((q) => q.id === "q2");
  ok(
    "termo negado não vale ponto de termo",
    q2.termosNegados.length > 0 && q2.estado === "parcial",
    `estado ${q2.estado}, negados ${JSON.stringify(q2.termosNegados)}`
  );
  ok(
    "o motivo explica que a tese foi negada",
    /negado/.test(q2.motivo),
    `motivo: ${q2.motivo}`
  );
}

/* ── Ajuste manual ────────────────────────────────────────────── */
console.log("\n── ajuste manual do estudante ──");

{
  let r = C.corrigir("Não escrevi nada de útil aqui, apenas encheu linguiça.", espelho);
  const antes = r.nota;
  r = C.ajustar(r, "q1", true);
  ok("ajuste para 'acertei' sobe a nota", r.nota > antes, `${antes} → ${r.nota}`);
  ok("ajuste é contabilizado", r.ajustes === 1, `recebi ${r.ajustes}`);

  r = C.ajustar(r, "q1", null);
  ok("voltar ao automático restaura a nota", r.nota === antes, `recebi ${r.nota}`);
  ok("e zera a contagem de ajustes", r.ajustes === 0, `recebi ${r.ajustes}`);
}

/* ── Casamento flexível de termo ──────────────────────────────
   Regressão de um falso negativo encontrado usando o simulador: o
   espelho pedia "erro acidental", o aluno escreveu "erro de tipo
   acidental sobre o objeto" e levou zero. As palavras do termo agora
   valem na ordem, com até 3 palavras intercaladas. */
console.log("\n── casamento flexível ──");

ok(
  "termo casa com palavras intercaladas",
  C.estadoDoTermo("Trata-se de erro de tipo acidental sobre o objeto.", "erro acidental") ===
    "afirmado",
  "esperava afirmado"
);
ok(
  "casa com flexão da palavra",
  C.estadoDoTermo("A conduta foi culposa.", "culpos") === "afirmado",
  "esperava afirmado"
);
ok(
  "NÃO casa atravessando o fim de frase",
  C.estadoDoTermo("houve erro. acidental foi o encontro", "erro acidental") === "ausente",
  "palavras em frases diferentes não formam o termo"
);
ok(
  "NÃO casa com intervalo maior que o teto",
  C.estadoDoTermo(
    "erro que aqui se examina com vagar e cuidado seria acidental",
    "erro acidental"
  ) === "ausente",
  "mais de 3 palavras intercaladas não deveria casar"
);
ok(
  "flexível continua respeitando a negação",
  C.estadoDoTermo("Não se trata de erro de tipo acidental.", "erro acidental") === "negado",
  "esperava negado"
);

/* ── Limites conhecidos ───────────────────────────────────────── */
console.log("\n── LIMITES conhecidos (falhas aceitas, documentadas) ──");

{
  const e = C.estadoDoTermo(
    C.normalizar("Não se pode negar que houve erro escusável."),
    "erro escusavel"
  );
  console.log(
    `  LIMITE  dupla negação lida como negação — estado: ${e} (o correto seria "afirmado")`
  );
}
{
  const e = C.estadoDoTermo(
    C.normalizar("Se fosse erro escusável, o agente seria absolvido."),
    "erro escusavel"
  );
  console.log(
    `  LIMITE  condicional lida como afirmação — estado: ${e} (o aluno não afirmou a tese)`
  );
}
{
  const e = C.estadoDoTermo(
    C.normalizar("O equívoco era plenamente justificável diante das circunstâncias."),
    "erro escusavel"
  );
  console.log(
    `  LIMITE  paráfrase fora da lista de sinônimos — estado: ${e} (tese certa, palavras outras)`
  );
}

/* ── Resumo ───────────────────────────────────────────────────── */
console.log("\n" + "─".repeat(62));
console.log(`  ${passou} passaram · ${falhou} falharam`);
if (falhou) {
  console.log("\n  Falhas:");
  falhas.forEach((f) => console.log(`   · ${f.nome}\n     ${f.detalhe}`));
}
console.log("");
process.exit(falhou ? 1 : 0);
