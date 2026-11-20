// Scene composer for the 32px world: painted grass, dirt path, house zone
// with yard, field plots with hanging signs, pond, props, chickens, scatter.

import {
  C,
  TILE,
  drawBush,
  drawChicken,
  drawCrop,
  drawFenceRun,
  drawFlowerbed,
  drawHaystack,
  drawHouse,
  drawLogPile,
  drawRock,
  drawScarecrow,
  drawSign,
  drawSmoke,
  drawTree,
  drawTrough,
  CROP_NAMES,
} from "./art.js";
import type { HoldingRow } from "../../shared/types";

export const SCENE_W = 720;
const FIELD_TOP = 152;
const PLOT_W = 3 * TILE; // 96
const ROW_PITCH = PLOT_W + 44;
const COL_X = [26, 26 + PLOT_W + 76];

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function cropName(cropIndex: number): string {
  return CROP_NAMES[cropIndex % CROP_NAMES.length];
}

export function sceneSize(holdings: HoldingRow[]): { width: number; height: number } {
  const rows = Math.max(1, Math.ceil(holdings.length / 2));
  return { width: SCENE_W, height: FIELD_TOP + rows * ROW_PITCH + 90 };
}

interface Rect { x: number; y: number; w: number; h: number }
function near(r: Rect, x: number, y: number, pad = 4): boolean {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

/* ── grass painting ───────────────────────────────────────── */
function paintGrass(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = C.gBase;
  ctx.fillRect(0, 0, w, h);
  const r = rng(11);
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = r() > 0.5 ? C.gLight : C.gDark;
    ellipseFill(ctx, Math.floor(r() * w), Math.floor(r() * h), 16 + r() * 30, 9 + r() * 15);
  }
  ctx.restore();
  // tufts
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(r() * h);
    ctx.fillStyle = r() > 0.6 ? C.gLight : C.gDark;
    ctx.fillRect(x, y, 3, 1);
    if (r() > 0.8) {
      ctx.fillStyle = C.gHi;
      ctx.fillRect(x + 1, y - 2, 1, 2);
    }
  }
}

function ellipseFill(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  for (let dy = -ry; dy <= ry; dy++) {
    const t = 1 - (dy / (ry + 0.5)) ** 2;
    if (t <= 0) continue;
    const w = Math.max(1, Math.round(rx * Math.sqrt(t)));
    ctx.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}

/* ── dirt path ────────────────────────────────────────────── */
function pathSeg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, r: () => number): void {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1) || 14;
  const h = Math.abs(y2 - y1) || 14;
  ctx.fillStyle = C.soil;
  ctx.fillRect(x - 7, y - 7, w + 14, h + 14);
  ctx.fillStyle = C.soilLight;
  for (let i = 0; i < (w * h) / 260; i++) {
    ctx.fillRect(x - 5 + Math.floor(r() * (w + 10)), y - 5 + Math.floor(r() * (h + 10)), 3, 2);
  }
  ctx.fillStyle = C.soilDark;
  for (let i = 0; i < (w * h) / 500; i++) {
    ctx.fillRect(x - 5 + Math.floor(r() * (w + 10)), y - 5 + Math.floor(r() * (h + 10)), 2, 2);
  }
  ctx.fillStyle = C.stone;
  for (let i = 0; i < (w + h) / 60; i++) {
    const edge = r() > 0.5;
    ctx.fillRect(edge ? x - 9 : x + w + 5, y + Math.floor(r() * h), 3, 2);
  }
}

/* ── field plot ───────────────────────────────────────────── */
function soilPlot(ctx: CanvasRenderingContext2D, x: number, y: number, r: () => number): void {
  ctx.fillStyle = C.soil;
  ctx.fillRect(x, y, PLOT_W, PLOT_W);
  ctx.fillStyle = C.soilLight;
  for (const fy of [5, 6, 13, 14, 21, 22, 29, 30, 37, 38, 45, 46, 53, 54, 61, 62, 69, 70, 77, 78, 85, 86]) {
    ctx.fillRect(x + 2, y + fy, PLOT_W - 4, 1);
  }
  ctx.fillStyle = C.soilDark;
  for (let i = 0; i < 26; i++) ctx.fillRect(x + 2 + Math.floor(r() * 92), y + 2 + Math.floor(r() * 92), 1, 1);
  ctx.fillStyle = C.outline;
  ctx.fillRect(x, y, PLOT_W, 1);
  ctx.fillRect(x, y + PLOT_W - 1, PLOT_W, 1);
  ctx.fillRect(x, y, 1, PLOT_W);
  ctx.fillRect(x + PLOT_W - 1, y, 1, PLOT_W);
  // corner posts
  for (const [cxp, cyp] of [[x - 1, y - 1], [x + PLOT_W - 3, y - 1], [x - 1, y + PLOT_W - 3], [x + PLOT_W - 3, y + PLOT_W - 3]]) {
    ctx.fillStyle = C.wood;
    ctx.fillRect(cxp, cyp, 4, 4);
    ctx.fillStyle = C.woodLight;
    ctx.fillRect(cxp, cyp, 2, 4);
    ctx.fillStyle = C.outline;
    ctx.fillRect(cxp + 3, cyp, 1, 4);
  }
}

/* ── pond (level ≥ 4) ─────────────────────────────────────── */
function pondRect(height: number): Rect {
  return { x: 500, y: height - 150, w: 200, h: 100 };
}

function drawPond(ctx: CanvasRenderingContext2D, height: number, frame: number): void {
  const cx = 600;
  const cy = height - 100;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ellipseFillC(ctx, C.sand, cx, cy + 2, 82, 38);
  ctx.restore();
  ellipseFillC(ctx, C.outline, cx, cy, 76, 34);
  ellipseFillC(ctx, C.water, cx, cy, 73, 32);
  ellipseFillC(ctx, C.waterLight, cx - 18, cy - 12, 34, 12);
  ctx.fillStyle = C.waterHi;
  const off = frame * 3;
  ctx.fillRect(cx - 40 + off, cy - 8, 14, 1);
  ctx.fillRect(cx + 8 - off, cy + 4, 18, 1);
  ctx.fillRect(cx + 30, cy + 16 - (frame % 2), 10, 1);
  // reeds
  for (const [dx, dy] of [[-84, -8], [-78, 2], [74, 6], [80, -2]] as const) {
    ctx.fillStyle = C.leaf;
    ctx.fillRect(cx + dx, cy + dy, 2, 12);
    ctx.fillStyle = C.leafDark;
    ctx.fillRect(cx + dx, cy + dy, 1, 6);
  }
}

function ellipseFillC(ctx: CanvasRenderingContext2D, color: string, cx: number, cy: number, rx: number, ry: number): void {
  ctx.fillStyle = color;
  ellipseFill(ctx, cx, cy, rx, ry);
}

/* ── scatter flowers ──────────────────────────────────────── */
function flowerDot(ctx: CanvasRenderingContext2D, x: number, y: number, col: string): void {
  ctx.fillStyle = C.leaf;
  ctx.fillRect(x + 1, y + 2, 1, 2);
  ctx.fillStyle = col;
  ctx.fillRect(x, y + 1, 3, 2);
  ctx.fillRect(x + 1, y, 1, 1);
  ctx.fillRect(x + 1, y + 3, 1, 1);
  ctx.fillStyle = C.wheat;
  ctx.fillRect(x + 1, y + 1, 1, 1);
}

export interface ScenePayload { holdings: HoldingRow[]; level: number }

export function drawScene(
  ctx: CanvasRenderingContext2D,
  { holdings, level }: ScenePayload,
  scale = 1,
  frame = 0,
): void {
  const { width, height } = sceneSize(holdings);
  ctx.canvas.width = width * scale;
  ctx.canvas.height = height * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const sway = frame % 2 === 0 ? 0 : 1;
  const r = rng(2024);

  paintGrass(ctx, width, height);

  // ── house zone ──
  const tier = (level >= 4 ? 2 : level >= 2 ? 1 : 0) as 0 | 1 | 2;
  const hw = [60, 84, 104][tier];
  const hx = width - hw - 30;
  const hy = 16;
  const house = drawHouse(ctx, hx, hy, { tier, gold: level >= 5 });
  const gateX = house.doorX;

  // yard fence either side of the gate
  const fy = house.doorY + 2;
  drawFenceRun(ctx, hx - 26, fy - 4, gateX - hx + 8);
  drawFenceRun(ctx, gateX + 14, fy - 4, hx + hw + 26 - gateX - 14);

  // water trough in the yard + flowering bush
  drawTrough(ctx, hx + 16, fy + 8);
  drawBush(ctx, hx + hw + 14, fy + 10, true, sway);

  // ── path: gate → down → left to the field ──
  pathSeg(ctx, gateX, house.doorY, gateX, FIELD_TOP - 26, r);
  pathSeg(ctx, COL_X[1] + PLOT_W + 18, FIELD_TOP - 26, gateX, FIELD_TOP - 26, r);
  pathSeg(ctx, COL_X[1] + PLOT_W + 18, FIELD_TOP - 26, COL_X[1] + PLOT_W + 18, FIELD_TOP + 44, r);

  // ── tree cluster top-left ──
  if (level >= 2) {
    drawTree(ctx, 96, 118, sway);
    drawTree(ctx, 178, 92, sway);
    drawBush(ctx, 46, 128, level >= 3, sway);
  } else {
    drawBush(ctx, 90, 120, false, sway);
    drawRock(ctx, 150, 118);
  }
  if (level >= 3) {
    drawTree(ctx, 30, 96, sway);
    drawRock(ctx, 230, 106, true);
  }

  // ── pond or lower-right props ──
  if (level >= 4) {
    drawPond(ctx, height, frame);
  } else {
    drawHaystack(ctx, 590, height - 110);
    drawLogPile(ctx, 500, height - 90);
  }

  // ── field ──
  const maxDiv = Math.max(1, ...holdings.map((h) => h.t12mDividend));
  holdings.forEach((h, i) => {
    const px = COL_X[i % 2];
    const py = FIELD_TOP + Math.floor(i / 2) * ROW_PITCH;
    soilPlot(ctx, px, py, r);
    const ratio = h.t12mDividend / maxDiv;
    const stage = h.t12mDividend > 0 ? Math.max(1, Math.min(3, Math.round(ratio * 3))) : 0;
    const name = cropName(h.cropIndex);
    for (let ty = 0; ty < 3; ty++) {
      for (let tx = 0; tx < 3; tx++) {
        const s = frame % 2 === 1 && (tx + ty + i) % 2 === 0 ? 1 : 0;
        drawCrop(ctx, name, stage, px + tx * TILE, py + ty * TILE, s);
      }
    }
    drawSign(ctx, h.symbol, `£${Math.round(h.t12mDividend)}/yr`, px + PLOT_W / 2, py + PLOT_W + 8);
  });

  // scarecrow beside the field, beside the path stub
  drawScarecrow(ctx, COL_X[1] + PLOT_W + 42, FIELD_TOP + 42, sway);

  // chickens: two spots, wandering with the frame
  for (const [bx, by] of [[150, FIELD_TOP - 40], [330, FIELD_TOP + 130]] as const) {
    drawChicken(ctx, bx + (frame >= 2 ? 6 : 0), by, frame);
  }

  drawFlowerbed(ctx, hx + hw + 10, height - 120);

  // ── scatter: flowers + pebbles avoiding everything built ──
  const fieldBottom = FIELD_TOP + Math.ceil(holdings.length / 2) * ROW_PITCH;
  const blocked: Rect[] = [
    { x: hx - 34, y: hy - 14, w: hw + 68, h: house.h + 34 },
    { x: 12, y: 70, w: 300, h: 70 }, // tree/prop band top-left
    ...holdings.map((_, i) => ({
      x: COL_X[i % 2] - 8,
      y: FIELD_TOP + Math.floor(i / 2) * ROW_PITCH - 6,
      w: PLOT_W + 16,
      h: PLOT_W + 46,
    })),
    { x: gateX - 12, y: house.doorY - 8, w: 26, h: fieldBottom - house.doorY },
    { x: COL_X[1] + PLOT_W + 4, y: FIELD_TOP - 40, w: 34, h: 110 },
    ...(level >= 4 ? [pondRect(height)] : [{ x: 440, y: height - 220, w: 220, h: 120 }]),
  ];
  const petals = [C.pink, C.white, C.red, C.orange, C.purple];
  const placed: { x: number; y: number }[] = [];
  const want = 36 + level * 8;
  for (let n = 0; placed.length < want && n < want * 10; n++) {
    const x = 14 + Math.floor(r() * (width - 28));
    const y = 80 + Math.floor(r() * (height - 100));
    if (blocked.some((b) => near(b, x, y, 6))) continue;
    if (placed.some((q) => Math.abs(q.x - x) < 10 && Math.abs(q.y - y) < 10)) continue;
    placed.push({ x, y });
    const col = petals[(x * 7 + y) % petals.length];
    flowerDot(ctx, x, y, col);
    if (r() > 0.5) flowerDot(ctx, x + 7, y + 3, petals[(x + y * 3) % petals.length]);
    if (r() > 0.8) flowerDot(ctx, x - 5, y + 5, petals[(x * 3 + y * 5) % petals.length]);
    if (r() > 0.72) {
      // pebble cluster
      ctx.fillStyle = C.stone;
      ctx.fillRect(x + 12, y + 4, 2, 2);
      ctx.fillRect(x + 15, y + 6, 2, 2);
      ctx.fillStyle = C.stoneLight;
      ctx.fillRect(x + 12, y + 4, 1, 1);
    }
    if (r() > 0.93) drawRock(ctx, x + 20, y + 8);
  }

  // chimney smoke last so it floats over the roof
  if (house.chimney) drawSmoke(ctx, house.chimney.x, house.chimney.y + 4, frame);
}
