#!/usr/bin/env python3
"""Gera os icones do app (PWA) sem dependencias externas.

Uso:
    python tools/make-icons.py

Desenha um "livro aberto" branco sobre um fundo indigo com gradiente,
com supersampling (4x) para bordas suaves. Gera:
  icons/icon-192.png
  icons/icon-512.png
  icons/icon-maskable-512.png
  icons/apple-touch-icon-180.png
  icons/favicon-32.png

Os PNGs sao opacos (RGBA com alfa=255), o que e o ideal para o iOS.
"""
import os
import zlib
import struct

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")

TOP = (99, 102, 241)      # #6366f1
BOTTOM = (67, 56, 202)    # #4338ca
WHITE = (255, 255, 255)

SS = 4                    # fator de supersampling


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t)


def fill_polys(buf, w, h, polys, color):
    """Preenche poligonos (listas de (x, y) em pixels) por scanline."""
    r, g, b = color
    for poly in polys:
        n = len(poly)
        ys = [p[1] for p in poly]
        ymin = max(0, int(min(ys)) - 1)
        ymax = min(h - 1, int(max(ys)) + 1)
        for y in range(ymin, ymax + 1):
            yc = y + 0.5
            xs = []
            for i in range(n):
                ax, ay = poly[i]
                bx, by = poly[(i + 1) % n]
                if ay == by:
                    continue
                if (ay <= yc < by) or (by <= yc < ay):
                    t = (yc - ay) / (by - ay)
                    xs.append(ax + (bx - ax) * t)
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                xa = max(0, int(xs[i] + 0.5))
                xb = min(w - 1, int(xs[i + 1] - 0.5))
                for x in range(xa, xb + 1):
                    idx = (y * w + x) * 3
                    buf[idx] = r
                    buf[idx + 1] = g
                    buf[idx + 2] = b


def render(size, emblem_scale):
    w = size * SS
    h = size * SS

    # fundo: gradiente vertical
    buf = bytearray(w * h * 3)
    for y in range(h):
        t = y / (h - 1) if h > 1 else 0.0
        r, g, b = lerp(TOP, BOTTOM, t)
        row = bytes((int(round(r)), int(round(g)), int(round(b)))) * w
        buf[y * w * 3:(y + 1) * w * 3] = row

    # caixa do emblema (centralizada)
    box = size * emblem_scale * SS
    x0 = (w - box) / 2.0
    y0 = (h - box) / 2.0

    def p(nx, ny):
        return (x0 + nx * box, y0 + ny * box)

    # livro aberto: duas paginas com um vao fino na lombada
    gap = 0.02
    left = [p(0.5 - gap, 0.30), p(0.08, 0.17), p(0.08, 0.83), p(0.5 - gap, 0.87)]
    right = [p(0.5 + gap, 0.30), p(0.92, 0.17), p(0.92, 0.83), p(0.5 + gap, 0.87)]
    fill_polys(buf, w, h, [left, right], WHITE)

    # reduz (box filter) -> anti-aliasing
    out = bytearray(size * size * 4)
    area = SS * SS
    for y in range(size):
        for x in range(size):
            r = g = b = 0
            base_y = y * SS
            for dy in range(SS):
                row_base = (base_y + dy) * w
                for dx in range(SS):
                    i = (row_base + x * SS + dx) * 3
                    r += buf[i]
                    g += buf[i + 1]
                    b += buf[i + 2]
            o = (y * size + x) * 4
            out[o] = r // area
            out[o + 1] = g // area
            out[o + 2] = b // area
            out[o + 3] = 255
    return out


def chunk(typ, data):
    return (struct.pack(">I", len(data)) + typ + data +
            struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))


def write_png(path, size, rgba):
    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)  # filtro None
        raw.extend(rgba[y * stride:(y + 1) * stride])
    compressed = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)))
        f.write(chunk(b"IDAT", compressed))
        f.write(chunk(b"IEND", b""))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    jobs = [
        ("icon-192.png", 192, 0.60),
        ("icon-512.png", 512, 0.60),
        ("icon-maskable-512.png", 512, 0.46),   # emblema menor: zona segura do maskable
        ("apple-touch-icon-180.png", 180, 0.62),
        ("favicon-32.png", 32, 0.66),
    ]
    for name, size, scale in jobs:
        rgba = render(size, scale)
        path = os.path.join(OUT_DIR, name)
        write_png(path, size, rgba)
        print("gerado:", os.path.relpath(path))
    print("pronto.")


if __name__ == "__main__":
    main()
