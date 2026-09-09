#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gerar-icones.py — ícones do PWA e o favicon com a Espada-Balança oficial.

    python tools/gerar-icones.py
"""

from pathlib import Path
from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
ICONES = RAIZ / "icons"

ONIX = (9, 9, 11)
VINHO = (136, 19, 55)
VINHO_LUZ = (159, 18, 57)
VINHO_SOMBRA = (112, 12, 43)
AMBAR = (217, 119, 6)
AMBAR_BRILHO = (245, 158, 11)
PERGAMINHO = (250, 248, 245)


def desenhar(lado: int, margem: float) -> Image.Image:
    """Espada-Balança oficial (Jus Puniendi e Devido Processo) em âmbar e vinho sobre ônix."""
    escala = 4  # supersampling para antisserrilhado
    t = lado * escala
    im = Image.new("RGBA", (t, t), (9, 9, 11, 255))
    d = ImageDraw.Draw(im)

    pad = int(t * margem)
    cx = t / 2
    cy = t / 2
    r = (t - 2 * pad) / 2

    # 1. Anel Circular da Legalidade Estrita (Ouro / Âmbar)
    espessura_anel = max(2, int(t * 0.045))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=AMBAR, width=espessura_anel)

    # Coordenadas proporcionais ao círculo interno
    escala_elem = r / 44.0  # mapa de 100x100 viewBox com r=44

    def tx(x_100):
        return cx + (x_100 - 50) * escala_elem

    def ty(y_100):
        return cy + (y_100 - 50) * escala_elem

    # 2. Correntes e Pratos da Balança
    esp_fio = max(1, int(t * 0.012))
    # Prato Esquerdo
    d.line([(tx(24.5), ty(38)), (tx(14), ty(61.5))], fill=AMBAR, width=esp_fio)
    d.line([(tx(24.5), ty(38)), (tx(36), ty(61.5))], fill=AMBAR, width=esp_fio)
    prato_esq = [
        (tx(13.5), ty(61.5)),
        (tx(36.5), ty(61.5)),
        (tx(32), ty(66)),
        (tx(25), ty(66.5)),
        (tx(18), ty(66)),
    ]
    d.polygon(prato_esq, fill=VINHO)

    # Prato Direito
    d.line([(tx(75.5), ty(38)), (tx(64), ty(61.5))], fill=AMBAR, width=esp_fio)
    d.line([(tx(75.5), ty(38)), (tx(86), ty(61.5))], fill=AMBAR, width=esp_fio)
    prato_dir = [
        (tx(63.5), ty(61.5)),
        (tx(86.5), ty(61.5)),
        (tx(82), ty(66)),
        (tx(75), ty(66.5)),
        (tx(68), ty(66)),
    ]
    d.polygon(prato_dir, fill=VINHO_LUZ)

    # 3. A Espada Central
    # Cruzeta (Guarda)
    cruzeta_esq = [
        (tx(50), ty(33)),
        (tx(42), ty(33)),
        (tx(32), ty(35.2)),
        (tx(24.5), ty(38)),
        (tx(31), ty(37.8)),
        (tx(41), ty(36)),
        (tx(47), ty(35)),
    ]
    d.polygon(cruzeta_esq, fill=VINHO_SOMBRA)

    cruzeta_dir = [
        (tx(50), ty(33)),
        (tx(58), ty(33)),
        (tx(68), ty(35.2)),
        (tx(75.5), ty(38)),
        (tx(69), ty(37.8)),
        (tx(59), ty(36)),
        (tx(53), ty(35)),
    ]
    d.polygon(cruzeta_dir, fill=VINHO_LUZ)

    # Losangos nas pontas da guarda
    finial_esq = [
        (tx(24.5), ty(36.5)),
        (tx(26.2), ty(38)),
        (tx(24.5), ty(39.5)),
        (tx(22.8), ty(38)),
    ]
    d.polygon(finial_esq, fill=AMBAR)

    finial_dir = [
        (tx(75.5), ty(36.5)),
        (tx(77.2), ty(38)),
        (tx(75.5), ty(39.5)),
        (tx(73.8), ty(38)),
    ]
    d.polygon(finial_dir, fill=AMBAR_BRILHO)

    # Cabo e pomo
    pomo = [
        (tx(50), ty(14.2)),
        (tx(52.4), ty(17.2)),
        (tx(50.8), ty(18.8)),
        (tx(49.2), ty(18.8)),
        (tx(47.6), ty(17.2)),
    ]
    d.polygon(pomo, fill=AMBAR_BRILHO)
    d.rectangle([tx(48.5), ty(18.8), tx(51.5), ty(33)], fill=VINHO_SOMBRA)
    d.polygon([(tx(50), ty(31.5)), (tx(53), ty(34)), (tx(50), ty(36.5)), (tx(47), ty(34))], fill=AMBAR)

    # Lâmina facetada (sombra à esquerda, luz à direita)
    lamina_esq = [
        (tx(47.5), ty(35)),
        (tx(49.8), ty(35)),
        (tx(49.8), ty(71.5)),
        (tx(50), ty(84.5)),
        (tx(47.5), ty(69.5)),
    ]
    d.polygon(lamina_esq, fill=VINHO_SOMBRA)

    lamina_dir = [
        (tx(52.5), ty(35)),
        (tx(50.2), ty(35)),
        (tx(50.2), ty(71.5)),
        (tx(50), ty(84.5)),
        (tx(52.5), ty(69.5)),
    ]
    d.polygon(lamina_dir, fill=VINHO_LUZ)

    # Nervura central
    d.line([(tx(50), ty(35)), (tx(50), ty(84.5))], fill=AMBAR_BRILHO, width=max(1, int(t * 0.007)))

    im_rgb = Image.new("RGB", im.size, ONIX)
    im_rgb.paste(im, mask=im.split()[3])
    return im_rgb.resize((lado, lado), Image.LANCZOS)


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

    base = desenhar(256, 0.06)
    base.save(RAIZ / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
    print("  favicon.ico                16/32/48/64/256")

    print("\n  Conferindo bitmaps:")
    for nome, lado, _ in saidas:
        real = Image.open(ICONES / nome).size
        marca = "ok " if real == (lado, lado) else "ERRO"
        print(f"    {marca} {nome}: declarado {lado}x{lado}, real {real[0]}x{real[1]}")


if __name__ == "__main__":
    main()
