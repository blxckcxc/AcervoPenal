#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
colher.py — puxa do índice os trechos de um tema, nos três autores.

    python tools/colher.py "erro na execucao" "aberratio ictus"
    python tools/colher.py --curto "tempo do crime" "teoria da atividade"

Vários termos = OR. Mostra os melhores blocos por autor, já com o
localizador pronto para citar. `--curto` reduz a janela de texto, para
varrer muitos temas de uma vez.

A pontuação favorece o bloco que concentra o tema (mais ocorrências em
menos texto) e penaliza sumário e índice remissivo, que casam com tudo
e não sustentam citação nenhuma.
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
INDICE = RAIZ / "tools" / "_indice_doutrina.jsonl"

AUTOR = {
    "sanches": "Sanches",
    "masson": "Masson",
    "greco": "Greco",
}

RUIDO = re.compile(r"sum[áa]rio|contents|índice|indice remissivo", re.I)


def norm(s):
    s = unicodedata.normalize("NFD", str(s).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def localizador(b):
    if b["fonte"] == "masson":
        p = b.get("paginaImpressa")
        return f"p. {p}" if p else "(sem página)", b.get("capitulo", "")[:55]
    if b["fonte"] == "sanches":
        return f"PDF p. {b.get('paginaPdf')}", b.get("cabecalho", "")[:55]
    return "—", (b.get("secao") or b.get("capitulo", ""))[:55]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    curto = "--curto" in sys.argv
    if not args:
        sys.exit("  Informe ao menos um termo.")
    if not INDICE.exists():
        sys.exit("  Índice ausente. Rode tools/indexar-doutrina.py primeiro.")

    alvos = [norm(a) for a in args]
    janela = 260 if curto else 620
    por_autor = 2 if curto else 3

    blocos = [json.loads(l) for l in INDICE.open(encoding="utf-8")]

    pontuados = []
    for b in blocos:
        t = norm(b["texto"])
        if not t:
            continue
        ocorr = sum(t.count(a) for a in alvos)
        if not ocorr:
            continue
        contexto = (b.get("capitulo") or "") + " " + (b.get("secao") or "")
        if RUIDO.search(contexto):
            ocorr *= 0.15  # sumário casa com tudo e não serve de fonte
        densidade = ocorr / (len(t) / 1000.0)
        pontuados.append((densidade, ocorr, b))

    pontuados.sort(key=lambda x: -x[0])

    print(f"\n  tema: {' / '.join(args)}   —   {len(pontuados)} blocos\n")

    for fonte in ("sanches", "masson", "greco"):
        do_autor = [p for p in pontuados if p[2]["fonte"] == fonte][:por_autor]
        if not do_autor:
            print(f"  ══ {AUTOR[fonte]}: NADA ENCONTRADO para este tema\n")
            continue
        for dens, ocorr, b in do_autor:
            loc, ctx = localizador(b)
            bruto = b["texto"]
            tn = norm(bruto)
            pos = min((tn.index(a) for a in alvos if a in tn), default=0)
            aprox = max(0, int(pos * len(bruto) / max(1, len(tn))) - janela // 3)
            print(f"  ══ {AUTOR[fonte]} · {loc} · {ctx}")
            print(f"     …{bruto[aprox:aprox + janela]}…\n")


if __name__ == "__main__":
    main()
