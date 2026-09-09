#!/usr/bin/env node
/*
 * validar-mapas.js — confere data/mapas_mentais.json contra o resto do acervo.
 *
 * As três falhas que este arquivo pode ter são todas SILENCIOSAS na tela:
 * um `pai` inexistente vira nó órfão flutuando como se fosse raiz; uma
 * conexão apontando para id que não existe simplesmente não desenha; e uma
 * âncora errada leva o estudante ao topo do Vade Mecum em vez do artigo.
 * Nenhuma delas quebra o JavaScript, então nenhuma delas apareceria.
 *
 *     node tools/validar-mapas.js
 */

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const ler = (n) => JSON.parse(fs.readFileSync(path.join(RAIZ, "data", n), "utf-8"));

const mapas = ler("mapas_mentais.json");
const modulos = ler("modules.json");
const vade = ler("vademecum.json");

const erros = [];
const avisos = [];

const idsModulos = new Set(modulos.modulos.map((m) => m.id));
const artigosVade = new Set(
  (vade.artigos || vade).map ? (vade.artigos || []).map((a) => String(a.numero)) : []
);

/* ── 1. Ids únicos e módulos existentes ─────────────────────────── */

const nos = new Map();
for (const mod of mapas.modulos) {
  if (!idsModulos.has(mod.id)) {
    erros.push(`módulo "${mod.id}" não existe em modules.json`);
  }
  for (const no of mod.nos) {
    if (nos.has(no.id)) erros.push(`id de nó repetido: ${no.id}`);
    nos.set(no.id, { no, mod });
    if (no.modulo !== mod.id) {
      erros.push(`${no.id}: campo modulo diz "${no.modulo}", mas está em "${mod.id}"`);
    }
  }
}

/* ── 2. Hierarquia: pai tem de existir NO MESMO módulo ──────────── */

for (const [id, { no, mod }] of nos) {
  if (no.pai === null || no.pai === undefined) continue;
  const pai = nos.get(no.pai);
  if (!pai) {
    erros.push(`${id}: pai "${no.pai}" não existe`);
  } else if (pai.mod.id !== mod.id) {
    erros.push(`${id}: pai "${no.pai}" está em outro módulo — isso é conexão, não hierarquia`);
  }
}

for (const mod of mapas.modulos) {
  const raizes = mod.nos.filter((n) => !n.pai);
  if (raizes.length !== 1) {
    avisos.push(`${mod.id}: ${raizes.length} raízes (o desenho aceita, mas a árvore fica dividida)`);
  }
}

/* ── 3. Conexões cruzadas ───────────────────────────────────────── */

let totalConexoes = 0;
for (const [id, { no, mod }] of nos) {
  for (const c of no.conexoes_cruzadas || []) {
    totalConexoes++;
    const alvo = nos.get(c.para);
    if (!alvo) {
      erros.push(`${id}: conexão aponta para "${c.para}", que não existe`);
      continue;
    }
    /* Conexão interna não é defeito: o par dolo eventual / culpa consciente
       é exatamente o que a prova troca. Ela desenha igual — só que aparece
       sempre, mesmo com um tema só, porque os dois nós estão sempre juntos. */
    if (alvo.mod.id === mod.id) {
      avisos.push(`${id} → ${c.para}: conexão interna a ${mod.id} — desenha sempre, mesmo com um tema só`);
    }
    if (!c.motivo || c.motivo.length < 20) {
      erros.push(`${id} → ${c.para}: motivo ausente ou curto demais para explicar a conexão`);
    }
  }
}

/* ── 4. Âncoras do Vade Mecum ───────────────────────────────────── */

const numerosVade = new Set((vade.artigos || []).map((a) => String(a.numero)));
for (const [id, { no }] of nos) {
  if (!no.artigo) continue;
  const { numero, ancora } = no.artigo;
  if (ancora !== "art" + numero) {
    erros.push(`${id}: âncora "${ancora}" não bate com o número ${numero}`);
  }
  if (numerosVade.size && !numerosVade.has(String(numero))) {
    erros.push(`${id}: art. ${numero} não existe em vademecum.json — o link cairia no vazio`);
  }
}

/* ── 5. Atalhos ─────────────────────────────────────────────────── */

for (const a of mapas.atalhos || []) {
  if (a.modulos.length > 5) erros.push(`atalho "${a.id}" traz ${a.modulos.length} temas; o teto é 5`);
  for (const m of a.modulos) {
    if (!mapas.modulos.some((x) => x.id === m)) {
      erros.push(`atalho "${a.id}" cita módulo inexistente: ${m}`);
    }
  }
}

/* ── Relatório ──────────────────────────────────────────────────── */

console.log("\n  Mapas mentais — validação\n");
console.log(`  ${mapas.modulos.length} módulos · ${nos.size} nós · ${totalConexoes} conexões declaradas`);
const comArtigo = [...nos.values()].filter((v) => v.no.artigo).length;
const comDoutrina = [...nos.values()].filter((v) => (v.no.doutrina_chave || []).length).length;
console.log(`  ${comArtigo} nós com dispositivo · ${comDoutrina} com posição doutrinária localizada\n`);

for (const a of avisos) console.log("  aviso  " + a);
for (const e of erros) console.error("  ERRO   " + e);

if (erros.length) {
  console.error(`\n  ${erros.length} erro(s).\n`);
  process.exit(1);
}
console.log(`\n  Sem erros.${avisos.length ? ` ${avisos.length} aviso(s) acima.` : ""}\n`);
