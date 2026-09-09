#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gerar-icones.py — ícones do PWA e o favicon com a Espada-Balança oficial.

    python tools/gerar-icones.py

═══════════════════════════════════════════════════════════════════════
A GEOMETRIA VIVE EM TRÊS LUGARES, E A FONTE DE VERDADE É UMA SÓ

O emblema é desenhado em `App.emblemaSVG()` (js/app.js) num viewBox de
100×100. Este script e `icons/emblema-penal.svg` repetem essa mesma
geometria — o primeiro porque PNG precisa de rasterizador e o projeto
não carrega cairosvg; o segundo como peça vetorial de referência.

Se mexer nas coordenadas, mexa nos três. As cores, ao menos, saem daqui
com os mesmos valores que os tokens do tema escuro entregam ao Hero:

    --emblema-metal  = --platina-fosca  #D4D4D8   anel, cordas, pratos,
                                                  finiais, pomo, fio
    --emblema-lamina = --vinho-traco    #D11E5C   guarda e lâmina
    --emblema-cabo   = --vinho          #881337   cabo

POR QUE A LÂMINA NÃO É O VINHO PLENO #881337
Medido sobre o ônix #09090B do ícone: #881337 dá 2,08:1, #9F1239 dá
2,48 e #700C2B dá 1,68 — todos abaixo de 3:1, o mínimo para uma forma
ser percebida. A espada viraria um borrão escuro sobre preto, e num
favicon de 16 px sumiria de vez. O #D11E5C dá 3,84:1 e é exatamente o
que o Hero usa. O vinho pleno fica onde ele funciona: no cabo, peça
pequena que se lê pelo contorno contra o metal ao redor, não pelo
contraste com o fundo.
═══════════════════════════════════════════════════════════════════════
"""

from pathlib import Path
from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
ICONES = RAIZ / "icons"

ONIX = (9, 9, 11)          # --onix-fundo #09090B
METAL = (212, 212, 216)    # --platina-fosca #D4D4D8
LAMINA = (209, 30, 92)     # --vinho-traco #D11E5C
CABO = (136, 19, 55)       # --vinho #881337

# O fio da lâmina é o metal a 70% sobre a lâmina, como no CSS do Hero
# (.emb-fio { stroke: var(--emblema-metal); opacity: 0.7 }). Resolvo a
# mistura aqui porque PIL não compõe opacidade em linha fina sem custo.
FIO = tuple(round(m * 0.7 + l * 0.3) for m, l in zip(METAL, LAMINA))


def desenhar(lado: int, margem: float) -> Image.Image:
    """Espada-Balança oficial em platina e vinho sobre ônix.

    `margem` é a fração de cada lado reservada como respiro — 0.18 no
    ícone maskable, onde o Android recorta um círculo por cima.
    """
    escala = 4  # supersampling para antisserrilhado
    t = lado * escala
    im = Image.new("RGB", (t, t), ONIX)
    d = ImageDraw.Draw(im)

    pad = t * margem
    util = t - 2 * pad

    # Todo o desenho é escrito no sistema de 100 unidades do viewBox,
    # igual ao de js/app.js, e só aqui vira pixel.
    def u(v):
        return pad + v * util / 100.0

    def esp(v):
        """Espessura de traço, na mesma escala."""
        return max(1, round(v * util / 100.0))

    # ── 1. Anel Circular da Legalidade Estrita ──────────────────────
    # No SVG o traço é centrado em r=43.5 com largura 4.8; no PIL a
    # borda é desenhada para DENTRO da caixa, então a caixa vai até
    # 43.5 + 4.8/2 = 45.9 para que o traço caia sobre o mesmo raio.
    r_ext = 43.5 + 4.8 / 2
    d.ellipse(
        [u(50 - r_ext), u(50 - r_ext), u(50 + r_ext), u(50 + r_ext)],
        outline=METAL,
        width=esp(4.8),
    )

    # ── 2. Correntes e pratos da balança ────────────────────────────
    esp_corda = esp(1.2)
    for x1, y1, x2, y2 in [
        (24.5, 38, 14, 61.5),
        (24.5, 38, 36, 61.5),
        (75.5, 38, 64, 61.5),
        (75.5, 38, 86, 61.5),
    ]:
        d.line([(u(x1), u(y1)), (u(x2), u(y2))], fill=METAL, width=esp_corda)

    # Os pratos são metal nos dois lados — no Hero não há prato claro e
    # prato escuro; a assimetria fica por conta da espada.
    for esquerdo in (True, False):
        base = 13.5 if esquerdo else 63.5
        d.polygon(
            [
                (u(base), u(61.5)),
                (u(base + 23), u(61.5)),
                (u(base + 18.5), u(66)),
                (u(base + 11.5), u(66.5)),
                (u(base + 4.5), u(66)),
            ],
            fill=METAL,
        )

    # ── 3. A espada ─────────────────────────────────────────────────
    # Guarda: as duas asas em vinho-traço, como as classes
    # .emb-guarda-esq / .emb-guarda-dir do Hero.
    d.polygon(
        [(u(50), u(33)), (u(42), u(33)), (u(32), u(35.2)), (u(24.5), u(38)),
         (u(31), u(37.8)), (u(41), u(36)), (u(47), u(35))],
        fill=LAMINA,
    )
    d.polygon(
        [(u(50), u(33)), (u(58), u(33)), (u(68), u(35.2)), (u(75.5), u(38)),
         (u(69), u(37.8)), (u(59), u(36)), (u(53), u(35))],
        fill=LAMINA,
    )

    # Losangos das pontas da guarda, pomo e centro da guarda: metal.
    for cx in (24.5, 75.5):
        d.polygon(
            [(u(cx), u(36.5)), (u(cx + 1.7), u(38)), (u(cx), u(39.5)), (u(cx - 1.7), u(38))],
            fill=METAL,
        )
    d.polygon(
        [(u(50), u(14.2)), (u(52.4), u(17.2)), (u(50.8), u(18.8)),
         (u(49.2), u(18.8)), (u(47.6), u(17.2))],
        fill=METAL,
    )

    # Cabo: o único lugar do vinho pleno. Ele se lê pelo contorno contra
    # o pomo e a guarda metálicos, não contra o fundo.
    d.rounded_rectangle(
        [u(48.5), u(18.8), u(51.5), u(33)],
        radius=max(1, esp(1)),
        fill=CABO,
    )
    d.polygon(
        [(u(50), u(31.5)), (u(53), u(34)), (u(50), u(36.5)), (u(47), u(34))],
        fill=METAL,
    )

    # Lâmina: as duas facetas na mesma cor, como no Hero. O que dá
    # volume é a nervura central, não um contraste entre metades.
    d.polygon(
        [(u(47.5), u(35)), (u(49.7), u(35)), (u(49.7), u(71.5)),
         (u(50), u(84.5)), (u(47.5), u(69.5))],
        fill=LAMINA,
    )
    d.polygon(
        [(u(52.5), u(35)), (u(50.3), u(35)), (u(50.3), u(71.5)),
         (u(50), u(84.5)), (u(52.5), u(69.5))],
        fill=LAMINA,
    )
    d.line([(u(50), u(35)), (u(50), u(84.5))], fill=FIO, width=esp(0.7))

    return im.resize((lado, lado), Image.LANCZOS)


def main():
    ICONES.mkdir(exist_ok=True)

    saidas = [
        ("icon-192.png", 192, 0.08),
        ("icon-512.png", 512, 0.08),
        ("icon-maskable-512.png", 512, 0.18),
        ("apple-touch-icon.png", 180, 0.08),
    ]
    for nome, lado, margem in saidas:
        im = desenhar(lado, margem)
        im.save(ICONES / nome, "PNG", optimize=True)
        print(f"  {nome:<26} {im.width}x{im.height}")

    # O .ico carrega cada tamanho DESENHADO no seu tamanho, não um 256
    # reduzido: a 16 px o anel tem menos de 1 px, e reduzir por Lanczos
    # o apagaria. Desenhar em cada escala deixa o supersampling resolver.
    tamanhos_ico = [16, 32, 48, 64, 256]
    quadros = [desenhar(n, 0.06) for n in tamanhos_ico]
    quadros[-1].save(
        RAIZ / "favicon.ico",
        format="ICO",
        sizes=[(n, n) for n in tamanhos_ico],
        append_images=quadros[:-1],
    )
    print(f"  favicon.ico                {'/'.join(str(n) for n in tamanhos_ico)}")

    print("\n  Conferindo bitmaps:")
    for nome, lado, _ in saidas:
        real = Image.open(ICONES / nome).size
        marca = "ok " if real == (lado, lado) else "ERRO"
        print(f"    {marca} {nome}: declarado {lado}x{lado}, real {real[0]}x{real[1]}")

    ico = Image.open(RAIZ / "favicon.ico")
    achados = sorted(s[0] for s in ico.ico.sizes())
    esperado = sorted(tamanhos_ico)
    marca = "ok " if achados == esperado else "ERRO"
    print(f"    {marca} favicon.ico: contém {achados}")


if __name__ == "__main__":
    main()
