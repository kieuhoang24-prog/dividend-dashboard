#!/usr/bin/env python3
"""True pixel-art conversion for Dividend Dashboard assets.

Takes the keyed, normalized sprites (2x their draw size) and converts them to
genuine pixel art: true low-res pixel grid (half the normalized size = exactly
the on-screen pixel grid), quantized to a shared master palette, with an
auto outline pass in each fill's darker shade. Saved at 2x nearest so the
renderer's 2:1 halving stays pixel-perfect.

Ground tiles are quantized to their own palettes and kept 1:1 (no outline);
the grass tile is also cut into 3 variants (ground-grass-v0/1/2) so the
renderer can scatter them without visible repetition.

Smooth (pre-pixel) copies are kept in tools/smooth/ for instant rollback.
"""
from pathlib import Path
import sys

from PIL import Image

RAW = Path(__file__).resolve().parent / "raw"
KEYED = Path(__file__).resolve().parent / "keyed"
OUT = Path(__file__).resolve().parent.parent / "public" / "sprites"
SMOOTH = Path(__file__).resolve().parent / "smooth"
MASTER_PALETTE_COLORS = 40
GROUND_PALETTE_COLORS = 30


def downscale_to_grid(img: Image.Image, factor: int) -> Image.Image:
    """True low-res: box-filter downscale by `factor` (area majority)."""
    w, h = img.size
    return img.resize((max(1, w // factor), max(1, h // factor)), Image.BOX)


def collect_palette(images: list[Image.Image], n: int, merge_threshold: int = 16) -> list[tuple[int, int, int]]:
    """Sample opaque pixels across assets, median-cut to n merged colors."""
    flat: list[tuple[int, int, int]] = []
    for img in images:
        px = img.load()
        total = img.width * img.height
        step = max(1, total // 30000)
        idx = 0
        for y in range(img.height):
            for x in range(img.width):
                if idx % step == 0:
                    p = px[x, y]
                    if p[3] > 24:
                        flat.append((p[0], p[1], p[2]))
                idx += 1

    def cut(bucket: list[tuple[int, int, int]], depth: int) -> list[tuple[int, int, int]]:
        if not bucket:
            return []
        if depth >= 6 or len(bucket) <= 2:
            r = sum(p[0] for p in bucket) // len(bucket)
            g = sum(p[1] for p in bucket) // len(bucket)
            b = sum(p[2] for p in bucket) // len(bucket)
            return [(r, g, b)]
        ranges = []
        for ch in range(3):
            vals = [p[ch] for p in bucket]
            ranges.append(max(vals) - min(vals))
        ch = ranges.index(max(ranges))
        bucket = sorted(bucket, key=lambda p: p[ch])
        mid = len(bucket) // 2
        return cut(bucket[:mid], depth + 1) + cut(bucket[mid:], depth + 1)

    buckets = cut(flat, 0)
    out: list[tuple[int, int, int]] = []
    for col in sorted(buckets):
        if all(abs(col[0] - o[0]) + abs(col[1] - o[1]) + abs(col[2] - o[2]) > merge_threshold for o in out):
            out.append(col)
    return out[:n]


def nearest(palette: list[tuple[int, int, int]], col: tuple[int, int, int]) -> tuple[int, int, int]:
    best, bd = palette[0], 10**9
    for p in palette:
        d = abs(p[0] - col[0]) + abs(p[1] - col[1]) + abs(p[2] - col[2])
        if d < bd:
            best, bd = p, d
    return best


def quantize(img: Image.Image, palette: list[tuple[int, int, int]]) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            p = px[x, y]
            if p[3] == 0:
                continue
            q = nearest(palette, (p[0], p[1], p[2]))
            px[x, y] = (q[0], q[1], q[2], p[3])
    return img


def outline(img: Image.Image, strength: float = 0.45) -> Image.Image:
    """1px colored outline on edge pixels (opaque next to transparent)."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    edges = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                    edges.append((x, y))
                    break
    for x, y in edges:
        r, g, b, a = px[x, y]
        px[x, y] = (int(r * (1 - strength)), int(g * (1 - strength)), int(b * (1 - strength)), a)
    return img


def upscale_nearest(img: Image.Image, factor: int) -> Image.Image:
    return img.resize((img.width * factor, img.height * factor), Image.NEAREST)


def ground_variants(tile: Image.Image, n: int = 3) -> list[Image.Image]:
    """Cut n quarter-tile variants from the big ground texture."""
    size = tile.width // 2
    out = []
    for i in range(n):
        ox = (i % 2) * size
        oy = (i // 2) * size
        out.append(tile.crop((ox, oy, ox + size, oy + size)))
    return out


def main() -> None:
    SMOOTH.mkdir(parents=True, exist_ok=True)
    only = sys.argv[1:] or None
    # always work from the pristine keyed copies so re-runs never compound
    keyed_files = []
    for f in sorted(KEYED.glob("*.png")):
        if only and not any(f.name == o or f.name.startswith(o) for o in only):
            continue
        keyed_files.append(f)
    if not keyed_files:
        keyed_files = [k for k in sorted((OUT).glob("*.png")) if not k.name.startswith("ground-")]

    sprites = [Image.open(k).convert("RGBA") for k in keyed_files if not k.name.startswith("ground-")]
    master = collect_palette(sprites, MASTER_PALETTE_COLORS)
    print(f"master palette: {len(master)} colors")

    for k in keyed_files:
        name = k.name
        img = Image.open(k).convert("RGBA")
        (SMOOTH / name).write_bytes(k.read_bytes())  # rollback copy
        low = downscale_to_grid(img, 2)
        low = quantize(low, master)
        low = outline(low, 0.45)
        final = upscale_nearest(low, 2)
        final.save(OUT / name)
        print(f"{name}: {img.size} -> grid {low.size} -> out {final.size}")

    # ground tiles: quantize from the pristine keyed copy, keep 1:1
    for gname, pal_n in (("ground-grass.png", GROUND_PALETTE_COLORS), ("ground-path.png", 28)):
        src = KEYED / gname
        if not src.exists():
            src = OUT / gname
        if not src.exists():
            continue
        img = Image.open(src).convert("RGBA")
        (SMOOTH / gname).write_bytes(src.read_bytes())
        gpal = collect_palette([img], pal_n, 6)
        q = quantize(img, gpal)
        q.save(OUT / gname)
        print(f"{gname}: quantized {q.size} ({len(gpal)} colors)")
        if gname == "ground-grass.png":
            for i, v in enumerate(ground_variants(q, 3)):
                v.save(OUT / f"ground-grass-v{i}.png")
            print("ground-grass variants: v0 v1 v2 saved")


if __name__ == "__main__":
    main()
