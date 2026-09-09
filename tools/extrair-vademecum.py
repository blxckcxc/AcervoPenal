#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extrair-vademecum.py — arts. 1º a 120 do Código Penal, da fonte oficial.

    curl -A "Mozilla/5.0 ..." -o tools/_cp_bruto.html \
      https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm
    python tools/extrair-vademecum.py

DUAS ARMADILHAS DESTA PÁGINA
1. O HTML vem em cp1252 e NÃO declara charset. Decodificar como UTF-8
   estoura logo no quarto byte. Está fixado abaixo, não adivinhado.
2. O user-agent padrão do curl é recusado pelo servidor (a conexão fica
   pendurada até expirar). Só responde com user-agent de navegador.

O texto sai como está na origem, incluindo as remissões do tipo
"(Redação dada pela Lei nº 7.209, de 11.7.1984)" — que vão para um campo
próprio, `alteracoes`, em vez de serem apagadas: elas dizem de quando é
a redação que se está lendo.
"""

import html
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ENTRADA = RAIZ / "tools" / "_cp_bruto.html"
SAIDA = RAIZ / "data" / "vademecum.json"
FONTE = "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm"

LIMITE = 120  # a Parte Geral vai até o art. 120

RE_TAG = re.compile(r"<[^>]+>")
RE_P = re.compile(r"<p\b[^>]*>(.*?)</p>", re.I | re.S)
RE_NEGRITO = re.compile(r"<b\b[^>]*>", re.I)
RE_ARTIGO = re.compile(r"^Art\.?\s*(\d{1,3})\s*(?:[ºo°]\s*)?[\-–—.]?\s*(.*)$", re.S)
RE_ALTERACAO = re.compile(r"\((?:Reda[çc][aã]o|Inclu[íi]d[oa]|Revogad[oa]|Vig[êe]ncia|Vide)[^)]*\)")
RE_PARAGRAFO = re.compile(r"^(§\s*\d+|Par[áa]grafo\s+[úu]nico)", re.I)
RE_INCISO = re.compile(r"^([IVXLC]+)\s*[\-–—]")
RE_ALINEA = re.compile(r"^([a-z])\)")


def limpar(bruto: str) -> str:
    """Tira tags, resolve entidades e normaliza o espaço em branco."""
    txt = RE_TAG.sub("", bruto)
    txt = html.unescape(txt)
    txt = txt.replace("\xa0", " ").replace("\r", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", txt).strip()


def paragrafos(doc: str):
    """Cada <p> vira (texto_limpo, era_negrito)."""
    for m in RE_P.finditer(doc):
        interno = m.group(1)
        texto = limpar(interno)
        if texto:
            yield texto, bool(RE_NEGRITO.search(interno))


def separar_alteracoes(texto: str):
    achadas = [m.group(0).strip() for m in RE_ALTERACAO.finditer(texto)]
    limpo = RE_ALTERACAO.sub("", texto)
    return re.sub(r"\s{2,}", " ", limpo).strip(" .;–—-").strip(), achadas


def classificar(texto: str) -> str:
    if RE_PARAGRAFO.match(texto):
        return "paragrafo"
    if RE_INCISO.match(texto):
        return "inciso"
    if RE_ALINEA.match(texto):
        return "alinea"
    return "continuacao"


def main():
    if not ENTRADA.exists():
        sys.exit(f"  Não achei {ENTRADA}. Baixe a página primeiro (ver cabeçalho).")

    doc = ENTRADA.read_bytes().decode("cp1252")

    artigos = []
    atual = None
    pendente = None  # rubrica marginal aguardando o que vem depois

    def despejar_no_caput():
        """A pendente não era rubrica: era sobra de linha do caput."""
        nonlocal pendente
        if pendente and atual is not None and not atual["itens"]:
            corpo, alt = separar_alteracoes(pendente)
            if corpo:
                atual["caput"] = (atual["caput"] + " " + corpo).strip()
                atual["alteracoes"].extend(alt)
        pendente = None

    for texto, negrito in paragrafos(doc):
        m = RE_ARTIGO.match(texto)

        if m:
            numero = int(m.group(1))
            rubrica, pendente = pendente, None
            if rubrica:
                rubrica = separar_alteracoes(rubrica)[0] or None

            if numero > LIMITE:
                atual = None
                continue

            # A página repete artigos (texto original e redação vigente).
            # Fica a PRIMEIRA ocorrência, que é a da redação compilada.
            if any(a["numero"] == numero for a in artigos):
                atual = None
                continue

            caput, alteracoes = separar_alteracoes(m.group(2))
            atual = {
                "numero": numero,
                "rubrica": rubrica,
                "caput": caput,
                "itens": [],
                "alteracoes": alteracoes,
            }
            artigos.append(atual)
            continue

        if atual is None:
            pendente = None
            continue

        tipo = classificar(texto)

        if tipo == "continuacao":
            # Parágrafo curto que não é item: pode ser a rubrica do que vem
            # a seguir (de um artigo OU de um inciso). Só se sabe olhando o
            # próximo, então fica pendurado. Se já havia uma pendente, a
            # anterior não era rubrica — vai para o caput.
            if len(texto) < 90 and not texto.endswith((".", ";", ":")):
                despejar_no_caput()
                pendente = texto
            else:
                despejar_no_caput()
                corpo, alt = separar_alteracoes(texto)
                if corpo and not atual["itens"]:
                    atual["caput"] = (atual["caput"] + " " + corpo).strip()
                    atual["alteracoes"].extend(alt)
            continue

        # É item (§, inciso ou alínea). Uma pendente aqui era a rubrica DELE.
        rubrica_do_item, pendente = pendente, None
        if rubrica_do_item:
            rubrica_do_item = separar_alteracoes(rubrica_do_item)[0] or None
        corpo, alt = separar_alteracoes(texto)
        if corpo:
            item = {"tipo": tipo, "texto": corpo}
            if rubrica_do_item:
                item["rubrica"] = rubrica_do_item
            atual["itens"].append(item)
            atual["alteracoes"].extend(alt)

    artigos.sort(key=lambda a: a["numero"])
    for a in artigos:
        a["alteracoes"] = sorted(set(a["alteracoes"]))

    faltando = sorted(set(range(1, LIMITE + 1)) - {a["numero"] for a in artigos})

    saida = {
        "versao": 1,
        "sobre": (
            "Arts. 1º a 120 do Decreto-Lei 2.848/1940 (Código Penal), extraídos do "
            "texto compilado do Planalto. Texto de lei — conferível na origem, linha "
            "a linha. O campo `alteracoes` guarda as remissões de redação que a "
            "página traz, em vez de descartá-las: é o que diz de quando é a redação."
        ),
        "fonte": FONTE,
        "codificacaoDaOrigem": "cp1252 (a página não declara charset)",
        "extraidoEm": __import__("datetime").date.today().isoformat(),
        "totalArtigos": len(artigos),
        "artigosAusentes": faltando,
        "artigos": artigos,
    }

    SAIDA.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"  {len(artigos)} artigos extraídos → {SAIDA.relative_to(RAIZ)}")
    if faltando:
        print(f"  ausentes: {faltando}")
    com_rubrica = sum(1 for a in artigos if a["rubrica"])
    print(f"  {com_rubrica} com rubrica marginal · "
          f"{sum(len(a['itens']) for a in artigos)} itens (§, incisos, alíneas)")


if __name__ == "__main__":
    main()
