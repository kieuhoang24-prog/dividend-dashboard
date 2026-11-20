#!/usr/bin/env python3
"""Chroma-key the pink/magenta gradient background out of generated sprites.

The image model renders the backdrop as a magenta->mauve gradient, so a single
flat-color threshold isn't enough: we flood-fill from every border seed with a
generous threshold (the sprite interior is protected by connectivity), then eat
any leftover magenta-ish fringe pixels that touch transparency, and resize.
"""
from pathlib import Path

from PIL import Image, ImageDraw

RAW = Path(__file__).resolve().parent / "raw"
OUT = Path(__file__).resolve().parent.parent / "public" / "sprites"
MARKER = (0, 255, 0, 255)
THRESH = 115
MAX_SIDE = 640


def magenta_like(px) -> bool:
    """Pink/rose/magenta backdrop hue band (~295°..358°), which covers the
    gradient the image model draws; pure reds (hue < ~10°) are excluded so
    tomato/barn colors never match."""
    r, g, b = px[0], px[1], px[2]
    mx, mn = max(r, g, b), min(r, g, b)
    if mx < 110 or mx - mn < 28 or mx != r:
        return False
    hue = (60 * ((g - b) / (mx - mn))) % 360
    return 295 <= hue <= 358


def key_image(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    work = img.copy()
    pix = work.load()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    seeds += [(x, 0) for x in range(0, w, 9)] + [(x, h - 1) for x in range(0, w, 9)]
    seeds += [(0, y) for y in range(0, h, 9)] + [(w - 1, y) for y in range(0, h, 9)]
    for s in seeds:
        if magenta_like(pix[s]):
            ImageDraw.floodfill(work, s, MARKER, thresh=THRESH)
    out = img.copy()
    opix = out.load()
    wpix = work.load()
    for y in range(h):
        for x in range(w):
            if wpix[x, y][:3] == MARKER[:3]:
                opix[x, y] = (0, 0, 0, 0)
    # eat the magenta fringe: opaque pixels that touch transparency and still
    # read magenta-ish are background remnants — two passes of edge erosion
    for _ in range(2):
        kill = []
        for y in range(h):
            for x in range(w):
                p = opix[x, y]
                if p[3] == 0 or not magenta_like(p):
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and opix[nx, ny][3] == 0:
                        kill.append((x, y))
                        break
        for x, y in kill:
            r, g, b, _ = opix[x, y]
            opix[x, y] = (r, g, b, 0)

    # flare pass: some renders add a washed-out pink light bloom in a corner
    # that the main flood can't cross. Only fires when washed-pink pixels are
    # still stuck to the border, and aborts if it would eat most of the sprite.
    before = sum(1 for y in range(h) for x in range(w) if opix[x, y][3] > 0)
    flare_seeds = [
        (x, y)
        for y in range(h)
        for x in range(w)
        if (x < 3 or y < 3 or x > w - 4 or y > h - 4)
        and opix[x, y][3] > 0
        and opix[x, y][0] > 195
        and opix[x, y][1] > 140
        and opix[x, y][2] > 140
    ]
    if flare_seeds:
        for s in flare_seeds[:400]:
            if opix[s][3] > 0:
                ImageDraw.floodfill(work, s, (0, 255, 255, 255), thresh=140)
        for y in range(h):
            for x in range(w):
                if wpix[x, y][:3] == (0, 255, 255):
                    opix[x, y] = (0, 0, 0, 0)
        after = sum(1 for y in range(h) for x in range(w) if opix[x, y][3] > 0)
        if before > 0 and after < before * 0.35:
            # flare pass ate too much — revert by re-copying from backup
            for y in range(h):
                for x in range(w):
                    if wpix[x, y][:3] == (0, 255, 255):
                        opix[x, y] = img.getpixel((x, y))
    if max(out.size) > MAX_SIDE:
        scale = MAX_SIDE / max(out.size)
        out = out.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    return out


# ── pixel-density normalization ────────────────────────────
# Every asset is resized so that drawing it at its on-screen size is a clean
# 2:1 halving (pixel-art-correct) instead of a 5-10x nearest-neighbor
# decimation. Ground tiles normalize to exactly 240 (1:1 with the tiler).
TARGETS: dict[str, tuple[str, int]] = {
    "house-cabin.png": ("bbox_w", 400),
    "house-barn.png": ("bbox_w", 400),
    "house-manor.png": ("bbox_w", 400),
    "tree-oak.png": ("bbox_w", 240),
    "ground-grass.png": ("fixed", 240),
    "ground-path.png": ("fixed", 240),
    "crop-": ("cell_median_h", 72),      # cells drawn at 36px tall
    "props-sheet.png": ("cell_median_h", 56),   # cells drawn 18-50px
    "actions-sheet.png": ("cell_median_h", 92), # farmer cells drawn ~46px
    "props2-sheet.png": ("cell_median_h", 92),  # well/coop ~44 + windmill 140
    "trees2-sheet.png": ("cell_median_h", 176), # trees ~88-122px
    "animals-sheet.png": ("cell_median_h", 92), # cow/farmer ~46-52px
    "animals2-sheet.png": ("cell_median_h", 58), # duck 20 … horse 54
}


def target_for(name: str):
    for k, v in TARGETS.items():
        if name.startswith(k) or name == k:
            return v
    return ("max_side", 640)


def grid_cells(img: Image.Image, cols: int, rows: int):
    """Alpha bbox per grid cell (for measuring content heights)."""
    w, h = img.size
    cw, chh = w / cols, h / rows
    out = []
    for r in range(rows):
        for c in range(cols):
            region = img.crop((round(c * cw), round(r * chh), round((c + 1) * cw), round((r + 1) * chh)))
            bbox = region.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
            if bbox:
                out.append((bbox[2] - bbox[0], bbox[3] - bbox[1]))
    return out


def normalize(keyed: Image.Image, name: str) -> Image.Image:
    mode, value = target_for(name)
    if mode == "fixed":
        return keyed.resize((value, value), Image.LANCZOS)
    if mode == "bbox_w":
        bbox = keyed.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
        if not bbox:
            return keyed
        content_w = bbox[2] - bbox[0]
        scale = value / content_w
    else:  # cell_median_h
        grid = (5, 1) if name.startswith("crop-") else (4, 2)
        cells = grid_cells(keyed, grid[0], grid[1])
        if not cells:
            return keyed
        heights = sorted(ch for _, ch in cells)
        median_h = heights[len(heights) // 2]
        scale = value / median_h
    if abs(scale - 1.0) < 0.05:
        return keyed
    return keyed.resize((round(keyed.width * scale), round(keyed.height * scale)), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for f in sorted(RAW.glob("*.png")):
        keyed = key_image(Image.open(f))
        keyed = normalize(keyed, f.name)
        dest = OUT / f.name
        keyed.save(dest)
        opaque = sum(1 for a in keyed.getchannel("A").getdata() if a > 0)
        print(f"{f.name}: {keyed.size} opaque={opaque * 100 // (keyed.size[0] * keyed.size[1])}%")


if __name__ == "__main__":
    main()
