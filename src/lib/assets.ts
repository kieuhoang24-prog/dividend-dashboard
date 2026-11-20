// Sprite asset pipeline: generated on Evans (Z-Image Turbo), chroma-keyed to
// transparency by tools/key_sprites.py. Sheets are sliced by per-cell alpha
// bounding boxes computed once at load, so draw calls are always tight.
// Ground textures are opaque and drawn as mirrored 2×2 tiles (seam-free).

export const ASSET_MANIFEST: Record<string, string> = {
  "house-cabin": "/sprites/house-cabin.png",
  "house-barn": "/sprites/house-barn.png",
  "house-manor": "/sprites/house-manor.png",
  "tree-oak": "/sprites/tree-oak.png",
  "crop-wheat": "/sprites/crop-wheat.png",
  "crop-carrot": "/sprites/crop-carrot.png",
  "crop-pumpkin": "/sprites/crop-pumpkin.png",
  "crop-tomato": "/sprites/crop-tomato.png",
  "crop-corn": "/sprites/crop-corn.png",
  "crop-potato": "/sprites/crop-potato.png",
  "crop-berry": "/sprites/crop-berry.png",
  "crop-tulip": "/sprites/crop-tulip.png",
  "props-sheet": "/sprites/props-sheet.png",
  "animals-sheet": "/sprites/animals-sheet.png",
  "actions-sheet": "/sprites/actions-sheet.png",
  "props2-sheet": "/sprites/props2-sheet.png",
  "trees2-sheet": "/sprites/trees2-sheet.png",
  "animals2-sheet": "/sprites/animals2-sheet.png",
  "ground-grass": "/sprites/ground-grass.png",
  "ground-grass-v0": "/sprites/ground-grass-v0.png",
  "ground-grass-v1": "/sprites/ground-grass-v1.png",
  "ground-grass-v2": "/sprites/ground-grass-v2.png",
  "ground-path": "/sprites/ground-path.png",
};

export type PropName =
  | "scarecrow"
  | "haystack"
  | "logs"
  | "trough"
  | "chicken"
  | "chicken-peck"
  | "bush"
  | "rock"
  | "pig"
  | "pig-root"
  | "cow"
  | "cow-graze"
  | "farmer-idle"
  | "farmer-walk1"
  | "farmer-walk2"
  | "farmer-hoe"
  | "farmer-water1"
  | "farmer-water2"
  | "farmer-harvest1"
  | "farmer-harvest2"
  | "farmer-seed1"
  | "farmer-seed2"
  | "butterfly-open"
  | "butterfly-closed"
  | "well"
  | "coop"
  | "mailbox"
  | "crates"
  | "wind0"
  | "wind1"
  | "wind2"
  | "wind3"
  | "tree-blossom"
  | "tree-pine"
  | "tree-apple"
  | "tree-elm"
  | "bed-tulip"
  | "bed-mixed"
  | "hay-cart"
  | "crates2"
  | "duck"
  | "duck-flap"
  | "cat-sit"
  | "cat-walk"
  | "horse"
  | "horse-graze"
  | "goat"
  | "rabbit";

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Asset {
  img: HTMLImageElement;
  cells: Record<string, Cell>;
}

const cache = new Map<string, Asset>();

function gridFor(key: string): { cols: number; rows: number } | null {
  if (key.startsWith("crop-")) return { cols: 5, rows: 1 };
  if (/^(props|animals|actions|props2|trees2|animals2)-sheet$/.test(key)) return { cols: 4, rows: 2 };
  return null;
}

/** Alpha bounding boxes per grid cell. Sprites are detected as connected
 *  components and assigned to the cell containing their centroid, so a wide
 *  animal that straddles a cell boundary is never clipped by the slice. */
function computeCells(img: HTMLImageElement, grid: { cols: number; rows: number } | null): Record<string, Cell> {
  const scale = Math.min(1, 256 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return {};
  ctx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return {};
  }
  const opaque = (x: number, y: number) => data[(y * w + x) * 4 + 3] > 24;
  const cols = grid?.cols ?? 1;
  const rows = grid?.rows ?? 1;

  // connected-component labeling (4-connectivity) over opaque pixels
  const labels = new Int32Array(w * h);
  const comps: { minX: number; minY: number; maxX: number; maxY: number; size: number; cx: number; cy: number }[] = [];
  const stack: number[] = [];
  let next = 1;
  for (let y0 = 0; y0 < h; y0++) {
    for (let x0 = 0; x0 < w; x0++) {
      const start = y0 * w + x0;
      if (labels[start] !== 0 || !opaque(x0, y0)) continue;
      labels[start] = next;
      stack.push(start);
      let minX = x0, maxX = x0, minY = y0, maxY = y0, size = 0, sx = 0, sy = 0;
      while (stack.length) {
        const p = stack.pop()!;
        const px = p % w;
        const py = (p / w) | 0;
        size++;
        sx += px;
        sy += py;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        if (px + 1 < w && labels[p + 1] === 0 && opaque(px + 1, py)) { labels[p + 1] = next; stack.push(p + 1); }
        if (px > 0 && labels[p - 1] === 0 && opaque(px - 1, py)) { labels[p - 1] = next; stack.push(p - 1); }
        if (py + 1 < h && labels[p + w] === 0 && opaque(px, py + 1)) { labels[p + w] = next; stack.push(p + w); }
        if (py > 0 && labels[p - w] === 0 && opaque(px, py - 1)) { labels[p - w] = next; stack.push(p - w); }
      }
      comps.push({ minX, minY, maxX, maxY, size, cx: sx / size, cy: sy / size });
      next++;
    }
  }

  // assign components to grid cells by centroid; a cell's bbox is the union
  // of its components (may legally spill across cell borders)
  const acc = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();
  for (const comp of comps) {
    if (comp.size < 12) continue; // ignore specks
    const col = Math.min(cols - 1, Math.max(0, Math.floor((comp.cx / w) * cols)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor((comp.cy / h) * rows)));
    const key = `${col},${row}`;
    const a = acc.get(key);
    if (!a) acc.set(key, { minX: comp.minX, minY: comp.minY, maxX: comp.maxX, maxY: comp.maxY });
    else {
      a.minX = Math.min(a.minX, comp.minX);
      a.minY = Math.min(a.minY, comp.minY);
      a.maxX = Math.max(a.maxX, comp.maxX);
      a.maxY = Math.max(a.maxY, comp.maxY);
    }
  }

  const inv = 1 / scale;
  const cells: Record<string, Cell> = {};
  const cw = w / cols;
  const chh = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const key = `${col},${r}`;
      const a = acc.get(key);
      if (a) {
        cells[key] = { x: a.minX * inv, y: a.minY * inv, w: (a.maxX - a.minX + 1) * inv, h: (a.maxY - a.minY + 1) * inv };
      } else {
        // empty cell fallback: the grid slot itself
        cells[key] = { x: col * cw * inv, y: r * chh * inv, w: cw * inv, h: chh * inv };
      }
    }
  }
  return cells;
}

export function loadAssets(): Promise<void> {
  return Promise.all(
    Object.entries(ASSET_MANIFEST).map(
      ([key, src]) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => {
            cache.set(key, { img: image, cells: computeCells(image, gridFor(key)) });
            resolve();
          };
          image.onerror = () => resolve(); // missing sprite = blank spot, app keeps working
          image.src = src;
        }),
    ),
  ).then(() => undefined);
}

function assetOf(key: string): Asset | undefined {
  return cache.get(key);
}

function cellOf(key: string, col: number, row: number): Cell | undefined {
  return assetOf(key)?.cells[`${col},${row}`];
}

export function hasAssets(): boolean {
  return cache.size > 0;
}

export function hasGround(key: string): boolean {
  const a = cache.get(key);
  return Boolean(a && a.img.complete && a.img.naturalWidth > 0);
}

/** Draw an asset (tight bbox) scaled to `w` wide, top-left anchored. */
export function drawAsset(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  w: number,
): { w: number; h: number } {
  const a = assetOf(key);
  const cell = cellOf(key, 0, 0);
  if (!a || !cell || cell.w <= 0) return { w: 0, h: 0 };
  const h = (cell.h / cell.w) * w;
  ctx.drawImage(a.img, cell.x, cell.y, cell.w, cell.h, x, y, w, h);
  return { w, h };
}

export function assetAspect(key: string): number {
  const cell = cellOf(key, 0, 0);
  if (!cell || cell.w <= 0) return 1;
  return cell.h / cell.w;
}

const GROUND_VARIANTS: Record<string, string[]> = {
  "ground-grass": ["ground-grass", "ground-grass-v0", "ground-grass-v1", "ground-grass-v2"],
};

/**
 * Mirror-tiled fill with per-cell variant picking: when variants exist
 * (grass), each quadrant pulls a different tile at 1:1 pixel density —
 * no seams, no visible repetition. Others draw their single texture 1:1.
 */
export function drawGroundTiled(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  tile = 240,
): void {
  const variants = GROUND_VARIANTS[key];
  if (variants) {
    const quad = tile / 2;
    for (let cy = y; cy < y + h; cy += quad) {
      for (let cx = x; cx < x + w; cx += quad) {
        const gi = Math.abs(Math.floor(cx / quad) * 7 + Math.floor(cy / quad) * 13) % variants.length;
        const a = assetOf(variants[gi]);
        const cell = cellOf(variants[gi], 0, 0);
        if (!a || !cell || cell.w <= 0) continue;
        ctx.drawImage(a.img, cell.x, cell.y, cell.w, cell.h, cx, cy, quad, quad);
      }
    }
    return;
  }
  const a = assetOf(key);
  if (!a) return;
  const iw = a.img.width;
  const ih = a.img.height;
  for (let j = 0; j * tile < h; j++) {
    for (let i = 0; i * tile < w; i++) {
      const dx = x + i * tile;
      const dy = y + j * tile;
      const tw = Math.min(tile, w - i * tile);
      const th = Math.min(tile, h - j * tile);
      const fx = i % 2 === 1;
      const fy = j % 2 === 1;
      const full = tw === tile && th === tile;
      ctx.save();
      if (full) {
        ctx.translate(fx ? dx + tw : dx, fy ? dy + th : dy);
        ctx.scale(fx ? -1 : 1, fy ? -1 : 1);
        ctx.drawImage(a.img, 0, 0, iw, ih, 0, 0, tile, tile);
      } else {
        ctx.drawImage(
          a.img,
          0, 0, (iw * tw) / tile, (ih * th) / tile,
          dx, dy, tw, th,
        );
      }
      ctx.restore();
    }
  }
}

/** Draw one growth-stage cell of a 5-stage crop sheet, bottom-left anchored.
 *  maxW clamps the sprite width so wide young stages can't overhang tiles. */
export function drawCropSprite(
  ctx: CanvasRenderingContext2D,
  crop: string,
  stage: number,
  x: number,
  baseY: number,
  h: number,
  maxW = 30,
): void {
  const key = `crop-${crop}`;
  const a = assetOf(key);
  const cell = cellOf(key, Math.max(0, Math.min(4, stage)), 0);
  if (!a || !cell || cell.w <= 0) return;
  let w = (cell.w / cell.h) * h;
  if (w > maxW) {
    w = maxW;
    h = (cell.h / cell.w) * w;
  }
  ctx.drawImage(a.img, cell.x, cell.y, cell.w, cell.h, x, baseY - h, w, h);
}

const PROP_CELLS: Record<string, [string, number, number]> = {
  scarecrow: ["props-sheet", 0, 0],
  haystack: ["props-sheet", 1, 0],
  logs: ["props-sheet", 2, 0],
  trough: ["props-sheet", 3, 0],
  chicken: ["props-sheet", 0, 1],
  "chicken-peck": ["props-sheet", 1, 1],
  bush: ["props-sheet", 2, 1],
  rock: ["props-sheet", 3, 1],
  pig: ["animals-sheet", 0, 0],
  "pig-root": ["animals-sheet", 1, 0],
  cow: ["animals-sheet", 2, 0],
  "cow-graze": ["animals-sheet", 3, 0],
  "farmer-idle": ["animals-sheet", 0, 1],
  "farmer-walk1": ["animals-sheet", 1, 1],
  "farmer-walk2": ["animals-sheet", 2, 1],
  "farmer-hoe": ["animals-sheet", 3, 1],
  "farmer-water1": ["actions-sheet", 0, 0],
  "farmer-water2": ["actions-sheet", 1, 0],
  "farmer-harvest1": ["actions-sheet", 2, 0],
  "farmer-harvest2": ["actions-sheet", 3, 0],
  "farmer-seed1": ["actions-sheet", 0, 1],
  "farmer-seed2": ["actions-sheet", 1, 1],
  "butterfly-open": ["actions-sheet", 2, 1],
  "butterfly-closed": ["actions-sheet", 3, 1],
  well: ["props2-sheet", 0, 0],
  coop: ["props2-sheet", 1, 0],
  mailbox: ["props2-sheet", 2, 0],
  crates: ["props2-sheet", 3, 0],
  wind0: ["props2-sheet", 0, 1],
  wind1: ["props2-sheet", 1, 1],
  wind2: ["props2-sheet", 2, 1],
  wind3: ["props2-sheet", 3, 1],
  "tree-blossom": ["trees2-sheet", 0, 0],
  "tree-pine": ["trees2-sheet", 1, 0],
  "tree-apple": ["trees2-sheet", 2, 0],
  "tree-elm": ["trees2-sheet", 3, 0],
  "bed-tulip": ["trees2-sheet", 0, 1],
  "bed-mixed": ["trees2-sheet", 1, 1],
  "hay-cart": ["trees2-sheet", 2, 1],
  crates2: ["trees2-sheet", 3, 1],
  duck: ["animals2-sheet", 0, 0],
  "duck-flap": ["animals2-sheet", 1, 0],
  "cat-sit": ["animals2-sheet", 2, 0],
  "cat-walk": ["animals2-sheet", 3, 0],
  horse: ["animals2-sheet", 0, 1],
  "horse-graze": ["animals2-sheet", 1, 1],
  goat: ["animals2-sheet", 2, 1],
  rabbit: ["animals2-sheet", 3, 1],
};

/** Draw one cell of the props/animals sheets, bottom-center anchored,
 *  optionally mirrored horizontally. */
export function drawPropSprite(
  ctx: CanvasRenderingContext2D,
  prop: PropName,
  x: number,
  baseY: number,
  h: number,
  flip = false,
): { w: number; h: number } {
  const loc = PROP_CELLS[prop];
  if (!loc) return { w: 0, h: 0 };
  const [key, col, row] = loc;
  const a = assetOf(key);
  const cell = cellOf(key, col, row);
  if (!a || !cell || cell.w <= 0) return { w: 0, h: 0 };
  const w = (cell.w / cell.h) * h;
  ctx.save();
  ctx.translate(x, baseY);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(a.img, cell.x, cell.y, cell.w, cell.h, -w / 2, -h, w, h);
  ctx.restore();
  return { w, h };
}
