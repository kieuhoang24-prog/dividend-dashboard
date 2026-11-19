import { PALETTE, TILE, drawCrop } from "./sprites.js";
import type { HoldingRow } from "../../shared/types";

export const SCENE_W_TILES = 16;
export const PLOT_TILES = 3;
export const COLS = 2;

const MARGIN_L_PX = 2 * TILE;
const PLOT_PITCH_X_PX = (PLOT_TILES + 1) * TILE; // 3 tiles + 1 gutter
export const PLOT_PX = PLOT_TILES * TILE;
const ROW_PITCH_PX = PLOT_PX + 22; // room for the ticker label between rows
const TOP_PX = 26; // sky/farmhouse band

export interface PlotLayout {
  symbol: string;
  x: number;
  y: number;
}

export interface SceneLayout {
  width: number;
  height: number;
  plots: PlotLayout[];
}

export function sceneLayout(holdings: HoldingRow[]): SceneLayout {
  const plots: PlotLayout[] = holdings.map((h, i) => ({
    symbol: h.symbol,
    x: MARGIN_L_PX + (i % COLS) * PLOT_PITCH_X_PX,
    y: TOP_PX + Math.floor(i / COLS) * ROW_PITCH_PX,
  }));
  const rows = Math.ceil(holdings.length / COLS);
  return {
    width: SCENE_W_TILES * TILE,
    height: TOP_PX + Math.max(rows, 1) * ROW_PITCH_PX + 12,
    plots,
  };
}

/** Seeded pseudo-random so grass speckle is stable between renders. */
function speckle(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function grassTile(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#7cb35a";
  ctx.fillRect(0, 0, w, h);
  const rnd = speckle(42);
  for (let i = 0; i < (w * h) / 90; i++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * h);
    ctx.fillStyle = rnd() > 0.5 ? "#5f9a44" : "#8ec96b";
    ctx.fillRect(x, y, 2, 1);
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * h);
    ctx.fillStyle = rnd() > 0.6 ? "#e8c547" : "#e8e6df";
    ctx.fillRect(x, y, 1, 1);
  }
}

function dirtPlot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  for (let ty = 0; ty < PLOT_TILES; ty++) {
    for (let tx = 0; tx < PLOT_TILES; tx++) {
      const dx = x + tx * TILE;
      const dy = y + ty * TILE;
      ctx.fillStyle = PALETTE.B;
      ctx.fillRect(dx, dy, TILE, TILE);
      ctx.fillStyle = PALETTE.f;
      for (let row = 3; row < TILE; row += 5) ctx.fillRect(dx + 1, dy + row, TILE - 2, 2);
    }
  }
  ctx.strokeStyle = "#2c1d10";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, PLOT_PX - 1, PLOT_PX - 1);
}

function drawHouse(ctx: CanvasRenderingContext2D, level: number): void {
  const cfg =
    level >= 4
      ? { w: 34, wall: "#e8e6df", roof: level >= 5 ? PALETTE.Y : PALETTE.r, door: PALETTE.b }
      : level >= 2
        ? { w: 28, wall: "#b03a2e", roof: "#3a3a44", door: "#6b4a2b" }
        : { w: 22, wall: "#8a5a33", roof: "#5a5a64", door: "#4a331e" };
  const x = SCENE_W_TILES * TILE - cfg.w - 10;
  const wallH = Math.round(cfg.w * 0.55);
  const roofH = Math.round(cfg.w * 0.35);
  const yBase = 22;
  const yWallTop = yBase - wallH - roofH;
  // stepped roof
  for (let r = 0; r < roofH; r += 2) {
    const inset = Math.round((roofH - r) / 2);
    ctx.fillStyle = PALETTE.k;
    ctx.fillRect(x + inset - 1, yWallTop + r - 1, cfg.w - inset * 2 + 2, 2);
    ctx.fillStyle = cfg.roof;
    ctx.fillRect(x + inset, yWallTop + r, cfg.w - inset * 2, 2);
  }
  // wall
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(x - 1, yWallTop + roofH - 1, cfg.w + 2, wallH + 2);
  ctx.fillStyle = cfg.wall;
  ctx.fillRect(x, yWallTop + roofH, cfg.w, wallH);
  // door + windows
  ctx.fillStyle = cfg.door;
  ctx.fillRect(x + Math.floor(cfg.w / 2) - 2, yBase - 7, 5, 7);
  ctx.fillStyle = PALETTE.t;
  ctx.fillRect(x + 3, yWallTop + roofH + 4, 4, 4);
  ctx.fillRect(x + cfg.w - 7, yWallTop + roofH + 4, 4, 4);
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = PALETTE.b;
  ctx.fillRect(x + 5, y + 9, 2, 4);
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(x + 1, y + 1, 10, 9);
  ctx.fillStyle = "#4e8c3c";
  ctx.fillRect(x + 2, y + 2, 8, 7);
  ctx.fillStyle = PALETTE.g;
  ctx.fillRect(x + 3, y + 3, 3, 2);
  ctx.fillRect(x + 7, y + 5, 2, 2);
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(x + 1, y, 7, 5);
  ctx.fillStyle = PALETTE.s;
  ctx.fillRect(x + 2, y + 1, 5, 3);
  ctx.fillStyle = PALETTE.d;
  ctx.fillRect(x + 2, y + 3, 3, 1);
}

function drawPond(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(x - 1, y - 1, 30, 15);
  ctx.fillStyle = PALETTE.t;
  ctx.fillRect(x, y, 28, 13);
  ctx.fillStyle = "#8fd3df";
  ctx.fillRect(x + 4, y + 3, 6, 1);
  ctx.fillRect(x + 15, y + 8, 7, 1);
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  holdings: HoldingRow[],
  level: number,
  scale: number,
): void {
  const layout = sceneLayout(holdings);
  ctx.canvas.width = layout.width * scale;
  ctx.canvas.height = layout.height * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;

  grassTile(ctx, layout.width, layout.height);

  drawHouse(ctx, level);
  if (level >= 2) {
    drawTree(ctx, 8, 4);
    drawTree(ctx, 30, 8);
  }
  if (level >= 3) {
    drawTree(ctx, 120, 6);
    drawRock(ctx, 56, 14);
  }
  if (level >= 4) {
    drawRock(ctx, 8, layout.height - 16);
    drawPond(ctx, 210, layout.height - 26);
  }

  const maxDiv = Math.max(1, ...holdings.map((h) => h.t12mDividend));
  holdings.forEach((h, i) => {
    const plot = layout.plots[i];
    dirtPlot(ctx, plot.x, plot.y);
    const ratio = h.t12mDividend / maxDiv;
    const stage = h.t12mDividend > 0 ? Math.max(1, Math.min(3, Math.round(ratio * 3))) : 0;
    for (let ty = 0; ty < PLOT_TILES; ty++) {
      for (let tx = 0; tx < PLOT_TILES; tx++) {
        drawCrop(ctx, h.cropIndex, stage, plot.x + tx * TILE, plot.y + ty * TILE);
      }
    }
  });
}

export function growthStage(ratio: number, hasIncome: boolean): number {
  if (!hasIncome) return 0;
  return Math.max(1, Math.min(3, Math.round(ratio * 3)));
}
