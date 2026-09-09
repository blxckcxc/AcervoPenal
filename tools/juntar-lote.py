#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
juntar-lote.py — junta um lote de casos ao banco.

    python tools/juntar-lote.py tools/_lote.json

O banco de casos cresce por lotes, um ou dois módulos por vez. Reescrever
data/casos_praticos.json inteiro a cada lote seria caro e arriscado; este
script só anexa, recusando id repetido e mantendo a ordem por módulo e
nível — que é como o arquivo fica legível para conferência.
"""
import io
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
BANCO = RAIZ / "data" / "casos_praticos.json"

lote_arq = Path(sys.argv[1] if len(sys.argv) > 1 else RAIZ / "tools" / "_lote.json")
if not lote_arq.exists():
    sys.exit(f"  Lote não encontrado: {lote_arq}")

banco = json.load(io.open(BANCO, encoding="utf-8"))
lote = json.load(io.open(lote_arq, encoding="utf-8"))

ja = {c["id"] for c in banco["casos"]}
novos = [c for c in lote if c["id"] not in ja]
repetidos = [c["id"] for c in lote if c["id"] in ja]

banco["casos"].extend(novos)

# Ordem estável: por módulo (na ordem de modules.json) e depois por nível.
modulos = json.load(io.open(RAIZ / "data" / "modules.json", encoding="utf-8"))
ordem = {m["id"]: m["ordem"] for m in modulos["modulos"]}
banco["casos"].sort(key=lambda c: (ordem.get(c["moduloId"], 99), c["nivel"], c["id"]))

io.open(BANCO, "w", encoding="utf-8").write(
    json.dumps(banco, ensure_ascii=False, indent=2) + "\n"
)

print(f"  +{len(novos)} casos · total agora: {len(banco['casos'])}")
if repetidos:
    print(f"  ignorados por id repetido: {', '.join(repetidos)}")
