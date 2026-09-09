#!/usr/bin/env node
/*
 * validar-casos.js — checagem estrutural do banco de casos práticos.
 *
 *     node tools/validar-casos.js
 *
 * Além do óbvio (espelho somando 1.00, uma única alternativa correta,
 * referências existentes), roda o CORRETOR contra cada espelho com duas
 * respostas sintéticas:
 *
 *   · uma vazia, que precisa tirar 0;
 *   · uma montada a partir dos próprios termos e artigos do espelho,
 *     que precisa tirar 10.
 *
 * A segunda é a que mais pega defeito. Um espelho pode parecer certo no
 * JSON e ser impossível de satisfazer — termo com acento que a
 * normalização derruba, artigo exigido com parágrafo que ninguém
 * escreveria, `exigeTodos` num conjunto contraditório. Se nem a resposta
 * perfeita tira 10, nenhum aluno tiraria.
 */

const fs = require("fs");
const path = require("path");
const Corretor = require("../js/corretor.js");

const RAIZ = path.join(__dirname, "..");
const ler = (p) => JSON.parse(fs.readFileSync(path.join(RAIZ, p), "utf-8"));

let erros = 0;
let avisos = 0;

function erro(onde, msg) {
  erros++;
  console.log(`  ERRO   ${onde}\n         ${msg}`);
}
function aviso(onde, msg) {
  avisos++;
  console.log(`  aviso  ${onde} — ${msg}`);
}

const casos = ler("data/casos_praticos.json");
const modulos = ler("data/modules.json");
const doutrina = ler("data/doutrina.json");

const idsModulos = new Set(modulos.modulos.map((m) => m.id));
const idsTemas = new Set(doutrina.temas.map((t) => t.id));
const vistos = new Set();

console.log(`\n  ${casos.casos.length} casos no banco\n`);

for (const c of casos.casos) {
  const onde = c.id || "(caso sem id)";

  if (!c.id) erro(onde, "caso sem id");
  if (vistos.has(c.id)) erro(onde, "id repetido");
  vistos.add(c.id);

  if (!idsModulos.has(c.moduloId)) {
    erro(onde, `moduloId "${c.moduloId}" não existe em modules.json`);
  }
  if (![1, 2, 3, 4].includes(c.nivel)) erro(onde, `nível inválido: ${c.nivel}`);
  if (!c.enunciado || c.enunciado.length < 80) {
    erro(onde, "enunciado ausente ou curto demais para um caso prático");
  }

  /* ── múltipla escolha ─────────────────────────────────────── */
  const alts = (c.multiplaEscolha && c.multiplaEscolha.alternativas) || [];
  if (alts.length < 3 || alts.length > 5) {
    erro(onde, `são ${alts.length} alternativas; o esperado é de 3 a 5`);
  }
  const corretas = alts.filter((a) => a.correta);
  if (corretas.length !== 1) {
    erro(onde, `${corretas.length} alternativas marcadas como corretas; deve ser exatamente 1`);
  }
  const letrasEsperadas = "ABCDE".slice(0, alts.length).split("");
  alts.forEach((a, i) => {
    if (a.letra !== letrasEsperadas[i]) {
      erro(onde, `alternativa ${i + 1} tem letra "${a.letra}", esperada "${letrasEsperadas[i]}"`);
    }
    if (!a.justificativa || a.justificativa.length < 40) {
      erro(onde, `alternativa ${a.letra} sem justificativa substantiva`);
    }
    if (!a.correta && !a.armadilha && a.justificativa && a.justificativa.length < 90) {
      aviso(onde, `alternativa ${a.letra}: justificativa curta e sem campo "armadilha"`);
    }
  });

  /* ── discursiva ───────────────────────────────────────────── */
  const d = c.discursiva;
  if (!d) {
    erro(onde, "sem bloco discursiva");
    continue;
  }
  if (!d.comando) erro(onde, "discursiva sem comando");

  const espelho = d.espelho || [];
  if (!espelho.length) erro(onde, "espelho vazio");

  const soma = espelho.reduce((s, q) => s + (q.valor || 0), 0);
  if (Math.abs(soma - 1) > 0.001) {
    erro(onde, `espelho soma ${soma.toFixed(2)}; deve somar 1.00`);
  }

  const idsQuesitos = new Set();
  espelho.forEach((q) => {
    if (!q.id) erro(onde, "quesito sem id");
    if (idsQuesitos.has(q.id)) erro(onde, `quesito com id repetido: ${q.id}`);
    idsQuesitos.add(q.id);
    if (!q.quesito) erro(onde, `quesito ${q.id} sem descrição`);
    if (!(q.termos && q.termos.length) && !(q.artigos && q.artigos.length)) {
      erro(onde, `quesito ${q.id} não tem termos nem artigos — nada para o motor conferir`);
    }
    (q.termos || []).forEach((t) => {
      if (Corretor.normalizar(t) !== t) {
        aviso(onde, `termo "${t}" não está normalizado (o motor normaliza, mas o JSON fica ambíguo)`);
      }
    });
  });

  (d.fundamentacaoDoutrinaria || []).forEach((ref) => {
    if (!idsTemas.has(ref)) {
      erro(onde, `fundamentacaoDoutrinaria aponta para "${ref}", que não existe em doutrina.json`);
    }
  });

  /* ── o espelho é satisfazível? ────────────────────────────── */
  const vazio = Corretor.corrigir("", espelho);
  if (vazio.nota !== 0) erro(onde, `resposta vazia tirou ${vazio.nota}, deveria tirar 0`);

  // Resposta perfeita sintética: uma frase por quesito, para que a
  // detecção de negação não veja termos de quesitos diferentes na
  // mesma oração.
  const perfeita = espelho
    .map((q) => {
      const termos = q.exigeTodos ? q.termos || [] : (q.termos || []).slice(0, 1);
      const arts = (q.artigos || []).map(
        (a) => "art. " + a.numero + (a.paragrafo != null ? ", §" + a.paragrafo + "º" : "")
      );
      return ["Sustento que ocorre", termos.join(" e "), arts.length ? "conforme " + arts.join(" e ") : ""]
        .filter(Boolean)
        .join(" ") + ".";
    })
    .join(" ");

  const cheio = Corretor.corrigir(perfeita, espelho);
  if (cheio.nota !== 10) {
    const falhos = cheio.quesitos
      .filter((q) => q.estado !== "ok")
      .map((q) => `${q.id} (${q.estado}: ${q.motivo})`)
      .join("; ");
    erro(onde, `resposta perfeita sintética tirou ${cheio.nota}/10 — espelho não é satisfazível.\n         ${falhos}`);
  }
}

/* ── cobertura assunto × nível ────────────────────────────────── */
console.log("\n  cobertura assunto × nível");
const matriz = {};
for (const c of casos.casos) {
  matriz[c.moduloId] = matriz[c.moduloId] || { 1: 0, 2: 0, 3: 0, 4: 0 };
  matriz[c.moduloId][c.nivel]++;
}
const ordem = modulos.modulos.map((m) => m.id);
console.log(`    ${"módulo".padEnd(22)} N1  N2  N3  N4   total`);
let vazias = 0;
for (const id of ordem) {
  const m = matriz[id] || { 1: 0, 2: 0, 3: 0, 4: 0 };
  const t = m[1] + m[2] + m[3] + m[4];
  const marca = [1, 2, 3, 4].map((n) => String(m[n]).padStart(2)).join("  ");
  vazias += [1, 2, 3, 4].filter((n) => !m[n]).length;
  console.log(`    ${id.padEnd(22)}${marca}   ${String(t).padStart(3)}`);
}
console.log(`\n    ${32 - vazias}/32 combinações preenchidas · ${vazias} ainda vazias`);

/* ── resumo ───────────────────────────────────────────────────── */
console.log("\n" + "─".repeat(62));
console.log(`  ${erros} erro(s) · ${avisos} aviso(s)\n`);
process.exit(erros ? 1 : 0);
