#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
indexar-doutrina.py — índice pesquisável dos três manuais.

    python tools/indexar-doutrina.py            # constrói o índice
    python tools/indexar-doutrina.py "aberratio ictus"   # busca

O QUE OS ARQUIVOS REALMENTE SÃO (não é o que a extensão diz)
  Sanches ....... PDF de verdade, 557 páginas, texto de OCR
  Masson ........ EPUB renomeado para .pdf — 13ª ed., 2019, Método
  Greco ......... EPUB renomeado para .pdf — 2017, Impetus

POR QUE CADA UM TEM UM LOCALIZADOR DIFERENTE
Uma citação só serve se o leitor conseguir ir conferir. O que cada
fonte permite localizar é diferente, então o índice guarda o melhor
localizador de cada uma — e o rotula pelo que ele é, sem fingir que
todos são "página":

  Masson    página IMPRESSA. O EPUB traz 827 âncoras #page_N mapeadas
            no toc.ncx para a paginação da 13ª edição. É citável como
            página de livro.
  Sanches   página do PDF + cabeçalho corrente. O número impresso não
            sobreviveu ao OCR (testei: não há deslocamento constante
            entre a página do PDF e a impressa). Citar "p. 312" seria
            inventar; citamos a página do PDF, dizendo que é isso.
  Greco     capítulo e título de seção. EPUB sem paginação nenhuma —
            texto refluível não tem página. O título da seção localiza.

Os livros NÃO entram no repositório: são obras de terceiros com direito
autoral, e o repositório é público. Este script lê da pasta de origem e
grava só o índice, que fica em tools/ (ignorado pelo git).
"""

import html
import json
import re
import sys
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM = Path(
    "C:/Users/adrie/Downloads/Acervo Penal/Penal-20260908T180406Z-1-001/Penal"
)
INDICE = RAIZ / "tools" / "_indice_doutrina.jsonl"

FONTES = {
    "sanches": {
        "arquivo": "Rogério Sanches Cunha - Manual De Direito Penal - Parte Geral - Arts. 1º Ao 120 (2016, Editora JusPodivm) - libgen.li.pdf",
        "autor": "Rogério Sanches Cunha",
        "obra": "Manual de Direito Penal — Parte Geral",
        "ano": 2016,
        "editora": "JusPodivm",
        "formato": "pdf",
        "localizador": "paginaPdf",
    },
    "masson": {
        "arquivo": "Cleber Masson - Direito Penal Parte Geral - Arts 1 a 120.pdf",
        "autor": "Cleber Masson",
        "obra": "Direito Penal — Parte Geral (arts. 1º a 120), vol. 1",
        "edicao": "13ª",
        "ano": 2019,
        "editora": "Método",
        "formato": "epub",
        "localizador": "paginaImpressa",
    },
    "greco": {
        "arquivo": "Rogerio Greco - Curso de Direito Penal Parte Geral.pdf",
        "autor": "Rogério Greco",
        "obra": "Curso de Direito Penal — Parte Geral, vol. I",
        "ano": 2017,
        "editora": "Impetus",
        "formato": "epub",
        "localizador": "secao",
    },
}

RE_TAG = re.compile(r"<[^>]+>")
RE_ESPACO = re.compile(r"\s+")


def limpar(t: str) -> str:
    t = RE_TAG.sub(" ", t)
    t = html.unescape(t)
    return RE_ESPACO.sub(" ", t).replace("\xad", "").strip()


# ── Sanches: PDF ────────────────────────────────────────────────────

def ler_sanches(meta):
    from pypdf import PdfReader

    r = PdfReader(str(ORIGEM / meta["arquivo"]))
    for i, pag in enumerate(r.pages):
        texto = (pag.extract_text() or "").replace("\xad", "")
        linhas = [l.strip() for l in texto.split("\n") if l.strip()]
        if not linhas:
            continue
        cabecalho = linhas[0][:80]
        corpo = RE_ESPACO.sub(" ", " ".join(linhas)).strip()
        if len(corpo) < 120:
            continue
        yield {
            "fonte": "sanches",
            "paginaPdf": i + 1,
            "cabecalho": cabecalho,
            "texto": corpo,
        }


# ── Masson: EPUB com âncoras de página impressa ─────────────────────

def ler_masson(meta):
    z = zipfile.ZipFile(str(ORIGEM / meta["arquivo"]))
    ncx = z.read("OEBPS/toc.ncx").decode("utf-8", "ignore")

    # Título de capítulo por arquivo, para dar contexto à citação.
    titulos = {}
    for m in re.finditer(
        r"<navPoint.*?<text>(.*?)</text>.*?<content src=\"([^\"#]+)", ncx, re.S
    ):
        titulos.setdefault(m.group(2), limpar(m.group(1)))

    nomes = [n for n in z.namelist() if n.endswith((".html", ".xhtml"))]
    for nome in sorted(nomes):
        try:
            doc = z.read(nome).decode("utf-8", "ignore")
        except Exception:
            continue

        arq = nome.split("/")[-1]
        capitulo = titulos.get("Text/" + arq, arq)

        # Fatia o documento nas âncoras id="page_N": tudo entre a âncora
        # N e a N+1 está impresso na página N.
        marcas = list(re.finditer(r'id="page_(\d+)"', doc))
        if not marcas:
            corpo = limpar(doc)
            if len(corpo) > 200:
                yield {
                    "fonte": "masson",
                    "paginaImpressa": None,
                    "capitulo": capitulo,
                    "texto": corpo,
                }
            continue

        for k, m in enumerate(marcas):
            ini = m.end()
            fim = marcas[k + 1].start() if k + 1 < len(marcas) else len(doc)
            corpo = limpar(doc[ini:fim])
            if len(corpo) < 120:
                continue
            yield {
                "fonte": "masson",
                "paginaImpressa": int(m.group(1)),
                "capitulo": capitulo,
                "texto": corpo,
            }


# ── Greco: EPUB sem paginação, fatiado por seção ────────────────────

def ler_greco(meta):
    z = zipfile.ZipFile(str(ORIGEM / meta["arquivo"]))
    nomes = sorted(n for n in z.namelist() if n.endswith((".html", ".xhtml")))

    for nome in nomes:
        try:
            doc = z.read(nome).decode("utf-8", "ignore")
        except Exception:
            continue

        m = re.search(r"<title>(.*?)</title>", doc, re.S | re.I)
        capitulo = limpar(m.group(1)) if m else nome.split("/")[-1]

        # Corta nos títulos: cada trecho fica sob o cabeçalho que o abre.
        cabecalhos = list(re.finditer(r"<h[1-6][^>]*>(.*?)</h[1-6]>", doc, re.S | re.I))
        if not cabecalhos:
            corpo = limpar(doc)
            if len(corpo) > 200:
                yield {"fonte": "greco", "capitulo": capitulo, "secao": None, "texto": corpo}
            continue

        for k, h in enumerate(cabecalhos):
            ini = h.end()
            fim = cabecalhos[k + 1].start() if k + 1 < len(cabecalhos) else len(doc)
            corpo = limpar(doc[ini:fim])
            if len(corpo) < 120:
                continue
            yield {
                "fonte": "greco",
                "capitulo": capitulo,
                "secao": limpar(h.group(1))[:120],
                "texto": corpo,
            }


LEITORES = {"sanches": ler_sanches, "masson": ler_masson, "greco": ler_greco}


def construir():
    total = 0
    with INDICE.open("w", encoding="utf-8") as saida:
        for chave, meta in FONTES.items():
            caminho = ORIGEM / meta["arquivo"]
            if not caminho.exists():
                print(f"  {chave}: arquivo não encontrado, pulando")
                continue
            n = 0
            for bloco in LEITORES[chave](meta):
                saida.write(json.dumps(bloco, ensure_ascii=False) + "\n")
                n += 1
            total += n
            print(f"  {chave:<8} {n:>5} blocos  ({meta['localizador']})")
    print(f"\n  {total} blocos → {INDICE.relative_to(RAIZ)}")


def normalizar(s):
    import unicodedata

    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return RE_ESPACO.sub(" ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def buscar(termo, limite=12):
    if not INDICE.exists():
        sys.exit("  Índice ausente. Rode sem argumentos primeiro.")
    alvo = normalizar(termo)
    achados = []
    with INDICE.open(encoding="utf-8") as f:
        for linha in f:
            b = json.loads(linha)
            texto = normalizar(b["texto"])
            if alvo in texto:
                pos = texto.index(alvo)
                achados.append((b, pos))

    print(f"\n  “{termo}” — {len(achados)} blocos\n")
    for b, pos in achados[:limite]:
        meta = FONTES[b["fonte"]]
        if b["fonte"] == "masson":
            loc = f"p. {b.get('paginaImpressa')} (impressa) · {b.get('capitulo','')[:40]}"
        elif b["fonte"] == "sanches":
            loc = f"PDF p. {b['paginaPdf']} · {b.get('cabecalho','')[:40]}"
        else:
            loc = f"{b.get('capitulo','')[:30]} · {b.get('secao') or '—'}"
        bruto = b["texto"]
        # janela em torno da ocorrência, no texto original
        aprox = max(0, int(pos * len(bruto) / max(1, len(normalizar(bruto)))) - 200)
        print(f"  ── {meta['autor']} · {loc}")
        print(f"     …{bruto[aprox:aprox + 480]}…\n")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        buscar(" ".join(sys.argv[1:]))
    else:
        construir()
