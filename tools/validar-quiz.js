#!/usr/bin/env node
/*
 * validar-quiz.js — checagem estrutural do banco de questões objetivas.
 *
 *     node tools/validar-quiz.js
 *
 * O banco de casos práticos tinha validador desde o começo e ele pegou
 * quatro justificativas rasas e dois espelhos mal formados. O banco de
 * questões não tinha nenhum — este preenche a lacuna.
 *
 * Além do óbvio, roda a NORMALIZAÇÃO do próprio quiz.js contra cada
 * questão cloze: se a resposta declarada não bate consigo mesma depois
 * de normalizada, nenhum aluno acertaria — nem digitando exatamente o
 * que o gabarito diz.
 */

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const ler = (p) => JSON.parse(fs.readFileSync(path.join(RAIZ, p), "utf-8"));

/* Mesma normalização de quiz.js — se uma mudar, este teste acusa. */
const normalizar = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9/ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

let erros = 0;
let avisos = 0;

const erro = (onde, msg) => {
  erros++;
  console.log(`  ERRO   ${onde}\n         ${msg}`);
};
const aviso = (onde, msg) => {
  avisos++;
  console.log(`  aviso  ${onde} — ${msg}`);
};

const banco = ler("data/quiz-bank.json");
const modulos = ler("data/modules.json");
const idsModulos = new Set(modulos.modulos.map((m) => m.id));
const vistos = new Set();

let total = 0;
const porTipo = { multipla: 0, vf: 0, cloze: 0 };

for (const [moduloId, questoes] of Object.entries(banco.bancos)) {
  if (!idsModulos.has(moduloId)) {
    erro(moduloId, `banco para módulo inexistente em modules.json`);
  }

  for (const q of questoes) {
    total++;
    const onde = `${moduloId}/${q.id || "(sem id)"}`;

    if (!q.id) erro(onde, "questão sem id");
    if (vistos.has(q.id)) erro(onde, `id repetido: ${q.id}`);
    vistos.add(q.id);

    if (!q.enunciado || q.enunciado.length < 20) {
      erro(onde, "enunciado ausente ou curto demais");
    }
    if (!q.referencia) aviso(onde, "sem campo `referencia` — a fonte não aparece ao aluno");

    if (!["multipla", "vf", "cloze"].includes(q.tipo)) {
      erro(onde, `tipo inválido: ${q.tipo}`);
      continue;
    }
    porTipo[q.tipo]++;

    if (q.tipo === "multipla") {
      const alts = q.alternativas || [];
      if (alts.length < 3 || alts.length > 5) {
        erro(onde, `${alts.length} alternativas; o esperado é de 3 a 5`);
      }
      const corretas = alts.filter((a) => a.correta);
      if (corretas.length !== 1) {
        erro(onde, `${corretas.length} alternativas corretas; deve ser exatamente 1`);
      }
      alts.forEach((a, i) => {
        if (!a.texto) erro(onde, `alternativa ${i + 1} sem texto`);
        if (!a.justificativa || a.justificativa.length < 30) {
          erro(onde, `alternativa ${i + 1} sem justificativa substantiva`);
        }
      });
      // Alternativas idênticas passariam despercebidas na leitura.
      const textos = alts.map((a) => normalizar(a.texto));
      if (new Set(textos).size !== textos.length) {
        erro(onde, "há alternativas com texto repetido");
      }
    }

    if (q.tipo === "vf") {
      if (typeof q.resposta !== "boolean") {
        erro(onde, `resposta de V/F deve ser booleana, veio ${typeof q.resposta}`);
      }
      if (!q.justificativa || q.justificativa.length < 30) {
        erro(onde, "V/F sem justificativa substantiva");
      }
    }

    if (q.tipo === "cloze") {
      if (!q.resposta) {
        erro(onde, "cloze sem resposta");
        continue;
      }
      if (!/_{3,}/.test(q.enunciado)) {
        aviso(onde, "enunciado de cloze sem lacuna visível (___)");
      }
      // A prova de fogo: o gabarito bate consigo mesmo?
      const gabarito = normalizar(q.resposta);
      const aceitas = [q.resposta, ...(q.aceitas || [])].map(normalizar);
      if (!aceitas.includes(gabarito)) {
        erro(onde, `a própria resposta "${q.resposta}" não casa após normalização`);
      }
      if (!gabarito) {
        erro(onde, `resposta "${q.resposta}" fica vazia após normalização`);
      }
      // Variantes que só diferem por acento são redundantes — a
      // normalização já as unifica.
      const redundantes = (q.aceitas || []).filter((a) => normalizar(a) === gabarito);
      if (redundantes.length) {
        aviso(onde, `aceitas redundantes (a normalização já cobre): ${redundantes.join(", ")}`);
      }
      if (!q.justificativa) erro(onde, "cloze sem justificativa");
    }
  }
}

/* ── Cobertura ────────────────────────────────────────────────── */

console.log(`\n  cobertura por módulo`);
console.log(`    ${"módulo".padEnd(22)} questões`);
let semQuestoes = 0;
for (const m of modulos.modulos) {
  const n = (banco.bancos[m.id] || []).length;
  if (!n) semQuestoes++;
  console.log(`    ${m.id.padEnd(22)} ${String(n).padStart(5)}`);
}

console.log(`\n  ${total} questões · múltipla ${porTipo.multipla} · V/F ${porTipo.vf} · cloze ${porTipo.cloze}`);
if (semQuestoes) console.log(`  ${semQuestoes} módulo(s) sem questão nenhuma`);

console.log("\n" + "─".repeat(62));
console.log(`  ${erros} erro(s) · ${avisos} aviso(s)\n`);
process.exit(erros ? 1 : 0);
