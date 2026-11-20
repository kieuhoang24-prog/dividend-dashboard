// Sprite asset pipeline: generated on Evans (Z-Image Turbo), chroma-keyed to
// transparency by tools/key_sprites.py. Sheets are sliced by per-cell alpha
// bounding boxes computed once at load, so draw calls are always tight.

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
};

export type PropName =
  | "scarecrow"
  | "haystack"
  | "logs"
  | "trough"
  | "chicken"
  | "chicken-peck"
  | "bush"
  | "rock";

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
  if (key.startsWith("crop-")) return { cols: 4, rows: 1 };
  if (key === "props-sheet") return { cols: 4, rows: 2 };
  return null;
}

/** Alpha bounding box per grid cell, measured on a ≤256px offscreen copy. */
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
  const alphaAt = (x: number, y: number) => data[(y * w + x) * 4 + 3];
  const cols = grid?.cols ?? 1;
  const rows = grid?.rows ?? 1;
  const cells: Record<string, Cell> = {};
  const cw = w / cols;
  const chh = h / rows;
  const inv = 1 / scale;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x0 = Math.round(col * cw);
      const y0 = Math.round(r * chh);
      const x1 = Math.round((col + 1) * cw);
      const y1 = Math.round((r + 1) * chh);
      let minX = x1, minY = y1, maxX = x0 - 1, maxY = y0 - 1;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (alphaAt(x, y) > 24) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < minX || maxY < minY) {
        minX = x0; minY = y0; maxX = x1 - 1; maxY = y1 - 1;
      }
      cells[`${col},${r}`] = {
        x: minX * inv,
        y: minY * inv,
        w: (maxX - minX + 1) * inv,
        h: (maxY - minY + 1) * inv,
      };
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

/** Draw one growth-stage cell of a crop sprite sheet, bottom-left anchored.
 *  maxW clamps the sprite width so wide young-stage cells can't overhang tiles. */
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
  const cell = cellOf(key, Math.max(0, Math.min(3, stage)), 0);
  if (!a || !cell || cell.w <= 0) return;
  let w = (cell.w / cell.h) * h;
  if (w > maxW) {
    w = maxW;
    h = (cell.h / cell.w) * w;
  }
  ctx.drawImage(a.img, cell.x, cell.y, cell.w, cell.h, x, baseY - h, w, h);
}

const PROP_ORDER: PropName[] = [
  "scarecrow", "haystack", "logs", "trough",
  "chicken", "chicken-peck", "bush", "rock",
];

/** Draw one cell of the 4×2 props sheet, bottom-center anchored. */
export function drawPropSprite(
  ctx: CanvasRenderingContext2D,
  prop: PropName,
  x: number,
  baseY: number,
  h: number,
): void {
  const a = assetOf("props-sheet");
  if (!a) return;
  const idx = PROP_ORDER.indexOf(prop);
  const cell = cellOf("props-sheet", idx % 4, Math.floor(idx / 4));
  if (!cell || cell.w <= 0) return;
  const w = (cell.w / cell.h) * h;
  ctx.drawImage(a.img, cell.x, cell.y, cell.w, cell.h, x - w / 2, baseY - h, w, h);
}
