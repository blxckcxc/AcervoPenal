#!/usr/bin/env node
/*
 * build.js — prepara o Acervo Penal para rodar offline.
 *
 * Faz duas coisas:
 *
 *   1. data/*.json  →  data/bundle.js
 *      Ao abrir index.html com duplo clique (file://), o Chrome bloqueia
 *      por CORS qualquer fetch de arquivo local. Os mesmos JSON são então
 *      embutidos num .js, que entra por <script> sem restrição. O JSON
 *      continua sendo a fonte de verdade; o bundle é derivado.
 *
 *   2. a lista de precache e a versão do cache dentro de sw.js
 *      No projeto irmão essa lista tinha 56 caminhos mantidos à mão, e era
 *      o ponto mais frágil de lá: bastava criar um arquivo e esquecer de
 *      registrá-lo para ele sumir no offline. Aqui a lista é varrida do
 *      disco a cada build, e a versão do cache vira um hash do conteúdo —
 *      publicar deixa de depender de lembrar de incrementar um número.
 *
 * QUANDO RODAR
 *     node build.js
 * Sempre que criar ou editar qualquer arquivo de data/, css/, js/ ou HTML.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const RAIZ = __dirname;
const DIR_DADOS = path.join(RAIZ, "data");
const SAIDA_BUNDLE = path.join(DIR_DADOS, "bundle.js");
const SW = path.join(RAIZ, "sw.js");

/* Tudo o que o acervo serve cabe no precache. A pasta img/ fica de fora
   porque são 7,8 MB de fotos das aulas: elas entram no cache sob demanda,
   pela estratégia normal do service worker, conforme forem vistas. */
const PASTAS_PRECACHE = ["css", "js", "data", "fonts", "icons"];
const EXT_PRECACHE = [".css", ".js", ".json", ".woff2", ".png", ".svg", ".ico", ".txt"];
const IGNORAR = new Set([".git", "node_modules", "doutrina", "img", "tools"]);

/* ── 1. bundle ────────────────────────────────────────────────── */

function gerarBundle() {
  if (!fs.existsSync(DIR_DADOS)) {
    console.error("  Pasta data/ não encontrada.");
    process.exit(1);
  }

  const arquivos = fs
    .readdirSync(DIR_DADOS)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (!arquivos.length) {
    console.error("  Nenhum .json em data/.");
    process.exit(1);
  }

  const pacote = {};
  let erros = 0;

  for (const nome of arquivos) {
    try {
      const bruto = fs.readFileSync(path.join(DIR_DADOS, nome), "utf-8");
      pacote[nome] = JSON.parse(bruto); // valida de quebra
      console.log(`  ok    ${String(bruto.length).padStart(8)} B  ${nome}`);
    } catch (e) {
      erros++;
      console.error(`  ERRO              ${nome}  — ${e.message}`);
    }
  }

  if (erros) {
    console.error(`\n  ${erros} arquivo(s) com JSON inválido. Bundle NÃO gerado.\n`);
    process.exit(1);
  }

  const conteudo =
    "/* GERADO AUTOMATICAMENTE por build.js — não edite à mão.\n" +
    " * Fonte de verdade: os arquivos .json desta pasta.\n" +
    " * Regenere com: node build.js\n" +
    " */\n" +
    "window.__ACERVO_BUNDLE__ = " +
    JSON.stringify(pacote) +
    ";\n";

  fs.writeFileSync(SAIDA_BUNDLE, conteudo, "utf-8");
  return { arquivos, tamanho: conteudo.length };
}

/* ── 2. precache do service worker ────────────────────────────── */

function varrer(dir, base = "") {
  const achados = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name) || entrada.name.startsWith(".")) continue;
    const rel = base ? `${base}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) {
      achados.push(...varrer(path.join(dir, entrada.name), rel));
    } else if (EXT_PRECACHE.includes(path.extname(entrada.name).toLowerCase())) {
      achados.push(rel);
    }
  }
  return achados;
}

function listaPrecache() {
  const lista = ["./"];

  for (const nome of fs.readdirSync(RAIZ)) {
    if (nome.endsWith(".html")) lista.push(nome);
  }
  if (fs.existsSync(path.join(RAIZ, "manifest.json"))) lista.push("manifest.json");
  if (fs.existsSync(path.join(RAIZ, "favicon.ico"))) lista.push("favicon.ico");

  for (const pasta of PASTAS_PRECACHE) {
    const caminho = path.join(RAIZ, pasta);
    if (fs.existsSync(caminho)) lista.push(...varrer(caminho, pasta));
  }

  return [...new Set(lista)].sort();
}

function hashDe(lista) {
  const h = crypto.createHash("sha256");
  for (const rel of lista) {
    if (rel === "./") continue;
    const caminho = path.join(RAIZ, rel);
    if (fs.existsSync(caminho)) {
      h.update(rel);
      h.update(fs.readFileSync(caminho));
    }
  }
  return h.digest("hex").slice(0, 10);
}

function atualizarSW(lista) {
  if (!fs.existsSync(SW)) {
    console.warn("  aviso: sw.js ainda não existe — precache não gerado.");
    return null;
  }

  const hash = hashDe(lista);
  let texto = fs.readFileSync(SW, "utf-8");

  const bloco =
    "/* INICIO-PRECACHE — gerado por build.js, não edite à mão */\n" +
    "const ARQUIVOS = [\n" +
    lista.map((f) => `  ${JSON.stringify(f)},`).join("\n") +
    "\n];\n" +
    "/* FIM-PRECACHE */";

  const marcadores =
    /\/\* INICIO-PRECACHE[\s\S]*?\/\* FIM-PRECACHE \*\//;

  if (!marcadores.test(texto)) {
    console.warn("  aviso: marcadores de precache não encontrados em sw.js.");
    return null;
  }

  texto = texto.replace(marcadores, bloco);
  texto = texto.replace(
    /const CACHE = "[^"]*";/,
    `const CACHE = "acervo-penal-${hash}";`
  );

  fs.writeFileSync(SW, texto, "utf-8");
  return { hash, total: lista.length };
}

/* ── main ─────────────────────────────────────────────────────── */

function main() {
  console.log("\n  Acervo Penal — build\n");

  const bundle = gerarBundle();
  console.log(
    `\n  bundle.js: ${(bundle.tamanho / 1024).toFixed(1)} KB, ` +
      `${bundle.arquivos.length} arquivos de dados.`
  );

  const lista = listaPrecache();
  const sw = atualizarSW(lista);
  if (sw) {
    console.log(`  precache: ${sw.total} arquivos · cache "acervo-penal-${sw.hash}"`);
  }

  console.log("\n  Pronto. index.html abre com duplo clique, sem servidor.\n");
}

main();
