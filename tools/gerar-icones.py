#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gerar-icones.py — ícones do PWA e o favicon.

    python tools/gerar-icones.py

POR QUE ISTO EXISTE COMO SCRIPT
No projeto irmão, os oito ícones declarados no manifest tinham TODOS
320x320 de bitmap real, qualquer que fosse o tamanho anunciado. O
navegador compara o bitmap com o `sizes` declarado e, não batendo,
simplesmente não oferece a instalação — sem erro visível. Gerar por
script garante que o pixel corresponda ao que o manifest promete.

O ícone maskable tem margem interna maior de propósito: o Android
recorta em círculo, e um símbolo que encosta na borda sai decepado.
"""

from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
ICONES = RAIZ / "icons"

ONIX = (9, 9, 11)
VINHO = (136, 19, 55)
AMBAR = (245, 158, 11)
PERGAMINHO = (250, 248, 245)


def desenhar(lado: int, margem: float) -> Image.Image:
    """Balança estilizada em âmbar sobre disco vinho, fundo ônix."""
    escala = 4  # desenha grande e reduz: antisserrilhado de pobre, e funciona
    t = lado * escala
    im = Image.new("RGB", (t, t), ONIX)
    d = ImageDraw.Draw(im)

    pad = int(t * margem)
    d.ellipse([pad, pad, t - pad, t - pad], fill=VINHO)

    # Geometria da balança, toda relativa ao lado.
    cx = t / 2
    topo = t * (margem + 0.16)
    base = t * (1 - margem - 0.16)
    haste = max(2, int(t * 0.030))
    braco_y = topo + (base - topo) * 0.22
    meia_larg = (t - 2 * pad) * 0.30

    # Haste vertical
    d.rectangle([cx - haste / 2, topo, cx + haste / 2, base], fill=AMBAR)
    # Braço horizontal
    d.rectangle([cx - meia_larg, braco_y - haste / 2, cx + meia_larg, braco_y + haste / 2], fill=AMBAR)
    # Base
    d.rectangle([cx - meia_larg * 0.55, base - haste / 2, cx + meia_larg * 0.55, base + haste / 2], fill=AMBAR)

    # Pratos: dois arcos abertos para baixo
    raio = meia_larg * 0.42
    for lado_x in (cx - meia_larg, cx + meia_larg):
        caixa = [lado_x - raio, braco_y + raio * 0.35, lado_x + raio, braco_y + raio * 1.35]
        d.arc(caixa, start=0, end=180, fill=AMBAR, width=max(2, int(t * 0.022)))
        d.line([lado_x, braco_y, lado_x, braco_y + raio * 0.35], fill=AMBAR, width=max(2, int(t * 0.016)))

    # Pino no topo
    p = t * 0.020
    d.ellipse([cx - p, topo - p, cx + p, topo + p], fill=PERGAMINHO)

    return im.resize((lado, lado), Image.LANCZOS)


def main():
    ICONES.mkdir(exist_ok=True)

    # margem menor nos comuns; maior no maskable, que o Android recorta.
    saidas = [
        ("icon-192.png", 192, 0.10),
        ("icon-512.png", 512, 0.10),
        ("icon-maskable-512.png", 512, 0.22),
        ("apple-touch-icon.png", 180, 0.10),
    ]
    for nome, lado, margem in saidas:
        im = desenhar(lado, margem)
        im.save(ICONES / nome, "PNG", optimize=True)
        print(f"  {nome:<26} {im.width}x{im.height}")

    # favicon.ico com os tamanhos que o Windows e as abas pedem
    base = desenhar(256, 0.08)
    base.save(RAIZ / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
    print("  favicon.ico                16/32/48/64/256")

    print("\n  Conferindo se o bitmap bate com o tamanho declarado:")
    for nome, lado, _ in saidas:
        real = Image.open(ICONES / nome).size
        marca = "ok " if real == (lado, lado) else "ERRO"
        print(f"    {marca} {nome}: declarado {lado}x{lado}, real {real[0]}x{real[1]}")


if __name__ == "__main__":
    main()
