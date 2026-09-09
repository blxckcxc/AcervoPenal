#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
preparar-galeria.py — redimensiona as fotos das aulas e monta data/galeria.json.

    python tools/preparar-galeria.py

POR QUE REDIMENSIONAR
As 44 fotos originais somam 54 MB — fotos de celular a 4000x3000. Somadas
aos 38,8 MB do áudio, o repositório passaria de 90 MB e o GitHub Pages
serviria isso para quem só queria ver uma lousa no celular. A 1600 px no
lado maior a letra da lousa continua legível e o peso cai para uma fração.

SOBRE A ROTAÇÃO
O catálogo (_fontes.json) registrou "rotacao: 90" em algumas fotos. Ao
inspecionar, descobri que não era giro do arquivo: era o campo EXIF de
orientação (valor 6 = girar 90° no sentido horário). Navegadores modernos
honram esse campo, mas nem todo contexto o faz, e depender disso deixaria
a galeria à mercê do visualizador.

A solução é aplicar a orientação AGORA, gravando o pixel já na posição
certa, e descartar o EXIF. Assim `rotacao` sai do galeria.json: não há
mais nada para o CSS corrigir.
"""

import io
import json
import re
import unicodedata
from pathlib import Path

from PIL import Image, ImageOps

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM = Path(
    "C:/Users/adrie/Downloads/Acervo Penal/Penal-20260908T180406Z-1-001/Penal"
)
DESTINO = RAIZ / "img"
MINIATURAS = DESTINO / "thumb"

LADO_MAIOR = 1600
LADO_MINIATURA = 480
QUALIDADE = 82
QUALIDADE_MINIATURA = 78


def slug(nome: str) -> str:
    """Nome de arquivo previsível: sem acento, sem espaço, minúsculo."""
    base = Path(nome).stem
    base = unicodedata.normalize("NFD", base)
    base = "".join(c for c in base if unicodedata.category(c) != "Mn")
    base = base.lower().replace("_samsung notes", "").replace("_whatsapp", "-whatsapp")
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    return base + ".jpg"


def processar(origem: Path, destino: Path, lado: int, qualidade: int):
    with Image.open(origem) as im:
        # Aplica a orientação EXIF e a descarta: o pixel passa a estar certo.
        im = ImageOps.exif_transpose(im)
        if im.mode != "RGB":
            im = im.convert("RGB")
        im.thumbnail((lado, lado), Image.LANCZOS)
        # Descarta o EXIF: a orientação já foi aplicada ao pixel acima, e
        # manter o campo faria o visualizador girar de novo o que já está
        # certo. `save` não copia o EXIF a menos que ele venha em info.
        im.info.pop("exif", None)
        im.save(destino, "JPEG", quality=qualidade, optimize=True, progressive=True)
        return im.size


def main():
    fontes = json.load(io.open(RAIZ / "data" / "_fontes.json", encoding="utf-8"))
    DESTINO.mkdir(exist_ok=True)
    MINIATURAS.mkdir(exist_ok=True)

    aulas = {a["data"]: a["rotulo"] for a in fontes["aulas"]}
    itens = []
    bytes_origem = 0
    bytes_destino = 0

    for it in fontes["itens"]:
        origem = ORIGEM / it["arquivo"]
        if not origem.exists():
            print(f"  ausente, pulando: {it['arquivo']}")
            continue

        nome = slug(it["arquivo"])
        bytes_origem += origem.stat().st_size

        larg, alt = processar(origem, DESTINO / nome, LADO_MAIOR, QUALIDADE)
        lmini, amini = processar(origem, MINIATURAS / nome, LADO_MINIATURA, QUALIDADE_MINIATURA)

        bytes_destino += (DESTINO / nome).stat().st_size
        bytes_destino += (MINIATURAS / nome).stat().st_size

        itens.append({
            "arquivo": nome,
            "original": it["arquivo"],
            "aula": it.get("aula"),
            "rotuloAula": aulas.get(it.get("aula"), "Sem aula vinculada"),
            "tipo": it["tipo"],
            "tema": it["tema"],
            "modulos": it.get("modulos", []),
            "artigos": it.get("artigos", []),
            "densidade": it.get("densidade"),
            "confiancaLeitura": it.get("confiancaLeitura"),
            "duplicataDe": it.get("duplicataDe"),
            "nota": it.get("nota"),
            "largura": larg,
            "altura": alt,
            # A miniatura entra no HTML com dimensão declarada para o
            # navegador reservar o espaço certo. Muitas fotos são retrato:
            # declarar 480x360 em todas causava salto de layout na grade.
            "larguraMini": lmini,
            "alturaMini": amini,
        })

    galeria = {
        "versao": 1,
        "sobre": (
            "As 44 fotos das aulas, redimensionadas para 1600 px no lado maior. "
            "Cada uma carrega o tema e os módulos a que serve, vindos do catálogo "
            "em _fontes.json — a galeria não é um álbum solto, é a fonte visual "
            "do acervo."
        ),
        "sobreARotacao": (
            "Nenhum item tem campo de rotação, e isso é intencional. O catálogo "
            "havia registrado 'rotacao: 90' em algumas fotos; ao inspecionar, era "
            "o campo EXIF de orientação, não giro do arquivo. A orientação foi "
            "aplicada ao pixel neste processamento e o EXIF, descartado. Não há "
            "o que o CSS precise corrigir."
        ),
        "aulas": fontes["aulas"],
        "total": len(itens),
        "itens": itens,
    }

    io.open(RAIZ / "data" / "galeria.json", "w", encoding="utf-8").write(
        json.dumps(galeria, ensure_ascii=False, indent=2) + "\n"
    )

    print(f"  {len(itens)} imagens processadas")
    print(f"  origem:  {bytes_origem / 1048576:6.1f} MB")
    print(f"  destino: {bytes_destino / 1048576:6.1f} MB  (imagem + miniatura)")
    print(f"  reducao: {100 - bytes_destino / bytes_origem * 100:.0f}%")


if __name__ == "__main__":
    main()
