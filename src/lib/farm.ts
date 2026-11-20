// Scene composer: terrain, house tiers, field plots, signs, props, pond,
// path, scatter — all drawn from the code-defined art in art.ts.

import {
  BUSH,
  CROP_NAMES,
  FENCE,
  GOLD_ROOF_MAP,
  HOUSE_CABIN,
  HOUSE_FARM,
  HOUSE_MANOR,
  PAL,
  ROCK_BIG,
  ROCK_SMALL,
  TREE_BIG,
  drawCrop,
  drawSign,
  drawSmoke,
  stamp,
  stampSize,
} from "./art.js";
import type { HoldingRow } from "../../shared/types";

export const TILE = 16;
export const SCENE_W = 26 * TILE; // 416 px
export const PLOT_PX = 3 * TILE; // 48 px soil square
const FIELD_TOP = 98;
const COL_X = [16, 16 + PLOT_PX + 64];
const ROW_PITCH = 74;
const PLOT_COLS = [3, 15, 27, 39];
const PLOT_ROWS = [2, 26];

export function cropName(cropIndex: number): string {
  return CROP_NAMES[cropIndex % CROP_NAMES.length];
}

function houseTier(level: number): 0 | 1 | 2 {
  return level >= 4 ? 2 : level >= 2 ? 1 : 0;
}

/** Seeded LCG so scatter is stable across renders. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function inRect(r: Rect, x: number, y: number, pad = 4): boolean {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

function grass(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#67a64f";
  ctx.fillRect(0, 0, w, h);
  const r = rng(7);
  for (let i = 0; i < (w * h) / 110; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(r() * h);
    ctx.fillStyle = r() > 0.55 ? "#59913f" : "#7cbb61";
    ctx.fillRect(x, y, 2, 1);
  }
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(r() * h);
    ctx.fillStyle = "#8ec96b";
    ctx.fillRect(x, y, 3, 1); // grass tufts
    if (r() > 0.7) {
      ctx.fillStyle = "#e8c547";
      ctx.fillRect(x + 3, y - 1, 1, 1);
    }
  }
}

function dirtPath(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1) || 7;
  const h = Math.abs(y2 - y1) || 7;
  ctx.fillStyle = PAL.B;
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = PAL.f;
  const r = rng(x * 31 + y);
  for (let i = 0; i < (w * h) / 60; i++) {
    ctx.fillRect(x - 2 + Math.floor(r() * (w + 3)), y - 2 + Math.floor(r() * (h + 3)), 2, 1);
  }
}

function soilPlot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = PAL.B;
  ctx.fillRect(x, y, PLOT_PX, PLOT_PX);
  ctx.fillStyle = PAL.f;
  for (const fy of [3, 4, 9, 10, 15, 16, 21, 22, 27, 28, 33, 34, 39, 40]) {
    ctx.fillRect(x + 2, y + fy, PLOT_PX - 4, 1);
  }
  const r = rng(x * 17 + y);
  ctx.fillStyle = "#3f2a16";
  for (let i = 0; i < 14; i++) ctx.fillRect(x + 2 + Math.floor(r() * 44), y + 2 + Math.floor(r() * 44), 1, 1);
  // rim + corner posts
  ctx.strokeStyle = "#2c1d10";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, PLOT_PX - 1, PLOT_PX - 1);
  for (const [cxp, cyp] of [[x, y], [x + PLOT_PX - 3, y], [x, y + PLOT_PX - 3], [x + PLOT_PX - 3, y + PLOT_PX - 3]]) {
    ctx.fillStyle = PAL.b;
    ctx.fillRect(cxp, cyp, 3, 3);
    ctx.fillStyle = PAL.k;
    ctx.fillRect(cxp, cyp, 1, 3);
  }
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 1, 1, 1);
  ctx.fillRect(x + 2, y + 1, 1, 1);
  ctx.fillRect(x + 1, y, 1, 1);
  ctx.fillRect(x + 1, y + 2, 1, 1);
  ctx.fillStyle = "#e8c547";
  ctx.fillRect(x + 1, y + 1, 1, 1);
}

function drawFenceRun(ctx: CanvasRenderingContext2D, x: number, y: number, tiles: number): void {
  for (let i = 0; i < tiles; i++) stamp(ctx, FENCE, x + i * 16, y);
}

function drawPond(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  const w = 74;
  const h = 34;
  ctx.fillStyle = PAL.e; // shore
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = "#c2a95f";
  const r = rng(19);
  for (let i = 0; i < 16; i++) ctx.fillRect(x - 2 + Math.floor(r() * (w + 3)), y - 2 + Math.floor(r() * (h + 3)), 1, 1);
  ctx.fillStyle = PAL.k;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.t;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = PAL.c;
  const off = frame === 0 ? 0 : 6;
  ctx.fillRect(x + 8 + off, y + 7, 10, 1);
  ctx.fillRect(x + 26 - off, y + 16, 12, 1);
  ctx.fillRect(x + 48, y + 25, 9, 1);
  // reeds
  ctx.fillStyle = PAL.G;
  ctx.fillRect(x - 4, y + 4, 2, 8);
  ctx.fillRect(x + w + 2, y + 14, 2, 9);
}

export interface ScenePayload {
  holdings: HoldingRow[];
  level: number;
}

export function sceneSize(holdings: HoldingRow[]): { width: number; height: number } {
  const rows = Math.max(1, Math.ceil(holdings.length / 2));
  return { width: SCENE_W, height: FIELD_TOP + rows * ROW_PITCH + 10 };
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  { holdings, level }: ScenePayload,
  scale: number,
  frame = 0,
): void {
  const { width, height } = sceneSize(holdings);
  ctx.canvas.width = width * scale;
  ctx.canvas.height = height * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;

  grass(ctx, width, height);

  // ── house zone ──
  const tier = houseTier(level);
  const houseGrid = tier === 0 ? HOUSE_CABIN : tier === 1 ? HOUSE_FARM : HOUSE_MANOR;
  const { w: hw0, h: hh0 } = stampSize(houseGrid);
  const HPX = 2; // houses are stamped 2× so they read at the right scale
  const hw = hw0 * HPX;
  const hh = hh0 * HPX;
  const hx = width - hw - 16;
  const hy = 8;
  const gateX = hx + Math.floor(hw / 2);
  stamp(ctx, houseGrid, hx, hy, tier === 2 && level >= 5 ? GOLD_ROOF_MAP : undefined, HPX);

  // yard fence (level ≥ 2), split around the gate
  if (level >= 2) {
    const fy = hy + hh + 2;
    drawFenceRun(ctx, hx - 8, fy, Math.max(1, Math.floor((gateX - hx) / 16 - 1)));
    drawFenceRun(ctx, gateX + 12, fy, Math.max(1, Math.floor((hx + hw + 8 - gateX - 12) / 16)));
  }

  // path: gate → down → left along field top
  dirtPath(ctx, gateX, hy + hh, gateX, FIELD_TOP - 14);
  dirtPath(ctx, COL_X[1] + PLOT_PX + 8, FIELD_TOP - 14, gateX, FIELD_TOP - 14);

  // ── tree cluster top-left ──
  if (level >= 2) {
    stamp(ctx, TREE_BIG, 12, 4);
    stamp(ctx, BUSH, 96, 16);
  }
  if (level >= 3) {
    stamp(ctx, TREE_BIG, 148, 2);
    stamp(ctx, ROCK_SMALL, 132, 40);
  }
  if (level >= 1 && level < 2) stamp(ctx, ROCK_SMALL, 40, 30);
  if (level >= 4) {
    stamp(ctx, ROCK_BIG, 150, 40);
    drawPond(ctx, 14, height - 46, frame);
  } else {
    stamp(ctx, ROCK_SMALL, 30, height - 30);
  }

  // ── scatter: flowers + pebbles avoiding house/field/pond/path ──
  const blocked: Rect[] = [
    { x: hx - 12, y: hy - 4, w: hw + 24, h: hh + 22 },
    ...holdings.map((_, i) => ({
      x: COL_X[i % 2] - 6,
      y: FIELD_TOP + Math.floor(i / 2) * ROW_PITCH - 4,
      w: PLOT_PX + 12,
      h: PLOT_PX + 26,
    })),
  ];
  const pondRect: Rect | null = level >= 4 ? { x: 6, y: height - 54, w: 90, h: 52 } : null;
  const pathRect: Rect = { x: Math.min(gateX, 176) - 10, y: hy + hh - 4, w: Math.abs(gateX - 176) + 20, h: FIELD_TOP - hh - 8 };
  const petal = ["#eef0e6", "#e8c547", "#c8589e", "#d9483b", "#e07b2e"];
  const r = rng(holdings.length * 101 + level);
  const flowerCount = 16 + level * 5;
  const placed: { x: number; y: number }[] = [];
  for (let n = 0; placed.length < flowerCount && n < flowerCount * 8; n++) {
    const x = 8 + Math.floor(r() * (width - 24));
    const y = 30 + Math.floor(r() * (height - 44));
    if (blocked.some((b) => inRect(b, x, y, 6))) continue;
    if (pondRect && inRect(pondRect, x, y)) continue;
    if (inRect(pathRect, x, y, 2)) continue;
    if (placed.some((p) => Math.abs(p.x - x) < 8 && Math.abs(p.y - y) < 8)) continue;
    placed.push({ x, y });
    drawFlower(ctx, x, y, petal[(x + y) % petal.length]);
    if (r() > 0.85) stamp(ctx, ROCK_SMALL, x + 6, y + 2);
  }

  // ── field: plot + crops + sign per holding ──
  const maxDiv = Math.max(1, ...holdings.map((h) => h.t12mDividend));
  holdings.forEach((h, i) => {
    const px = COL_X[i % 2];
    const py = FIELD_TOP + Math.floor(i / 2) * ROW_PITCH;
    soilPlot(ctx, px, py);
    const ratio = h.t12mDividend / maxDiv;
    const stage = h.t12mDividend > 0 ? Math.max(1, Math.min(3, Math.round(ratio * 3))) : 0;
    const name = cropName(h.cropIndex);
    for (const [ri, ry] of PLOT_ROWS.entries()) {
      for (const [ci, rx] of PLOT_COLS.entries()) {
        const sway = frame === 1 ? ((ri + ci + i) % 2 === 0 ? 1 : -1) : 0;
        drawCrop(ctx, name, stage, px + rx - 1, py + ry, sway);
      }
    }
    const amt = h.t12mDividend >= 1000 ? `${Math.round(h.t12mDividend)}` : `${Math.round(h.t12mDividend)}`;
    drawSign(ctx, h.symbol, `£${amt}/yr`, px + PLOT_PX / 2, py + PLOT_PX + 4);
  });
}

/** Chimney smoke sits above the farmhouse chimney; called after drawScene. */
export function chimneyPos(level: number, holdings: HoldingRow[]): { x: number; y: number } | null {
  if (houseTier(level) !== 1) return null;
  const { w: hw0 } = stampSize(HOUSE_FARM);
  const width = sceneSize(holdings).width;
  const hx = width - hw0 * 2 - 16;
  return { x: hx + 14, y: 8 };
}

export { drawSmoke };
