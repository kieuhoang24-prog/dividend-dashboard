// Tiny pixel-sprite system: 8×8 plant grids drawn on a 16px tile.
// One global palette so crop accents are just extra colored pixels
// layered onto a shared "bush" sprite.

export const TILE = 16;

export const PALETTE: Record<string, string> = {
  k: "#17181d", // outline
  g: "#7bb661", // leaf green
  G: "#4e8c3c", // dark green
  b: "#6b4a2b", // stem brown
  B: "#54381f", // soil dark
  f: "#7a5230", // soil furrow
  y: "#e8c547", // wheat yellow
  o: "#e07b2e", // orange
  r: "#d9483b", // red
  p: "#c8589e", // pink
  u: "#8a63d2", // purple
  w: "#e8e6df", // white
  s: "#8b8b95", // stone light
  d: "#3a3a44", // stone dark
  t: "#5fb3c4", // water
  Y: "#f2a63b", // gold
};

type Grid = string[];

const SEED: Grid = [
  "........",
  "........",
  "........",
  "........",
  "...k....",
  "..kb..k.",
  "..kb....",
  "........",
];

const SPROUT: Grid = [
  "........",
  "...k....",
  "...g....",
  "..gg....",
  "..gg....",
  "...b....",
  "...b....",
  "........",
];

const LEAFY: Grid = [
  "........",
  "...kk...",
  "..kggk..",
  ".kggggk.",
  ".kggggk.",
  "..kggk..",
  "...bb...",
  "........",
];

const BUSH: Grid = [
  "...kk...",
  "..kggk..",
  ".kggggk.",
  ".kggggk.",
  ".kggggk.",
  "..kggk..",
  "..kbbk..",
  "...kk...",
];

/**
 * Crops indexed to match cropIndexFor() hashing (0..7). Each crop is the
 * shared bush plus accent pixels that make it recognisable at 8px tall.
 */
export interface CropDef {
  name: string;
  accents: [number, number, string][];
}

export const CROPS: CropDef[] = [
  { name: "wheat", accents: [[0, 2, "y"], [0, 5, "y"], [1, 1, "y"], [1, 2, "y"], [1, 5, "y"], [1, 6, "y"]] },
  { name: "carrot", accents: [[3, 3, "o"], [4, 3, "o"], [4, 4, "o"], [5, 4, "o"]] },
  { name: "pumpkin", accents: [[2, 3, "o"], [2, 4, "o"], [3, 2, "o"], [3, 3, "o"], [3, 4, "o"], [3, 5, "o"], [4, 3, "o"], [4, 4, "o"], [1, 4, "k"]] },
  { name: "tomato", accents: [[2, 2, "r"], [2, 5, "r"], [3, 3, "r"], [4, 4, "r"]] },
  { name: "corn", accents: [[0, 3, "y"], [0, 4, "y"], [1, 2, "y"], [1, 5, "y"], [2, 1, "y"], [2, 6, "y"]] },
  { name: "potato", accents: [[2, 3, "G"], [3, 4, "G"], [3, 2, "G"], [4, 5, "G"]] },
  { name: "berry", accents: [[2, 2, "u"], [2, 5, "u"], [3, 3, "u"], [3, 4, "u"], [4, 3, "u"]] },
  { name: "tulip", accents: [[0, 3, "p"], [0, 4, "p"], [1, 3, "p"], [1, 4, "p"]] },
];

/** Signature color per crop, index-aligned with CROPS, for tiny UI swatches. */
export const CROP_COLORS = ["#e8c547", "#e07b2e", "#e07b2e", "#d9483b", "#e8c547", "#4e8c3c", "#8a63d2", "#c8589e"];

export const PLANT_STAGES: Grid[] = [SEED, SPROUT, LEAFY, BUSH];

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  x: number,
  y: number,
): void {
  for (let row = 0; row < grid.length; row++) {
    const line = grid[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === ".") continue;
      const color = PALETTE[ch] ?? PALETTE.k;
      ctx.fillStyle = color;
      ctx.fillRect(x + col, y + row, 1, 1);
    }
  }
}

/** Draw a crop at the given growth stage (0..3), centered inside a TILE tile. */
export function drawCrop(
  ctx: CanvasRenderingContext2D,
  cropIndex: number,
  stage: number,
  x: number,
  y: number,
): void {
  const crop = CROPS[cropIndex % CROPS.length];
  const grid = PLANT_STAGES[Math.max(0, Math.min(PLANT_STAGES.length - 1, stage))];
  const off = (TILE - 8) / 2;
  const gx = x + off;
  const gy = y + off;
  if (stage >= 3) {
    // accent pixels sit on top of the bush grid
    const patched = grid.map((row) => row.split(""));
    for (const [r, c, ch] of crop.accents) {
      if (patched[r] && patched[r][c] !== undefined) patched[r][c] = ch;
    }
    drawGrid(ctx, patched.map((r) => r.join("")), gx, gy);
  } else {
    drawGrid(ctx, grid, gx, gy);
  }
}
