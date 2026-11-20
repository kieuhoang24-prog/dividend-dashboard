// Scene composer: painted grass/soil/path/pond (procedural) + generated
// Stardew-style sprites (house tiers, oak tree, crop sheets, props).

import {
  C,
  TILE,
  CROP_NAMES,
  drawSign,
} from "./art.js";
import {
  drawAsset,
  assetAspect,
  drawCropSprite,
  drawPropSprite,
  drawGroundTiled,
  hasGround,
  type PropName,
} from "./assets.js";
import type { HoldingRow } from "../../shared/types";

export const SCENE_W = 720;
const FIELD_TOP = 152;
const PLOT_W = 3 * TILE; // 96
const ROW_PITCH = PLOT_W + 44;
const COLS = 3;
const COL_X = [26, 196, 366];
const STUB_X = Math.round((COL_X[0] + PLOT_W + COL_X[1]) / 2); // gutter walkway between col 1 and 2
const HOUSE_KEY = "house-manor";

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
  const rows = Math.max(1, Math.ceil(holdings.length / COLS));
  return { width: SCENE_W, height: FIELD_TOP + rows * ROW_PITCH + 90 };
}

interface Rect { x: number; y: number; w: number; h: number }
function near(r: Rect, x: number, y: number, pad = 4): boolean {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

function p(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function ellipseFill(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  for (let dy = -ry; dy <= ry; dy++) {
    const t = 1 - (dy / (ry + 0.5)) ** 2;
    if (t <= 0) continue;
    const w = Math.max(1, Math.round(rx * Math.sqrt(t)));
    p(ctx, ctx.fillStyle as string, cx - w, cy + dy, w * 2 + 1, 1);
  }
}

/* ── grass ────────────────────────────────────────────────── */
function drawTuft(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number): void {  if (variant === 0) {
    p(ctx, C.gDark, x, y + 2, 1, 3);
    p(ctx, C.gLight, x + 2, y + 1, 1, 4);
    p(ctx, C.gDark, x + 4, y + 2, 1, 3);
    p(ctx, C.gHi, x + 2, y, 1, 1);
    p(ctx, C.gBase, x + 1, y + 4, 3, 1);
  } else if (variant === 1) {
    p(ctx, C.gLight, x, y + 2, 1, 2);
    p(ctx, C.gDark, x + 1, y + 1, 1, 3);
    p(ctx, C.gLight, x + 3, y, 1, 4);
    p(ctx, C.gDark, x + 4, y + 2, 1, 2);
    p(ctx, C.gHi, x + 3, y, 1, 1);
  } else {
    p(ctx, C.gDark, x + 1, y + 3, 4, 1);
    p(ctx, C.gLight, x, y + 1, 1, 2);
    p(ctx, C.gDark, x + 2, y, 1, 3);
    p(ctx, C.gLight, x + 5, y + 1, 1, 2);
    p(ctx, C.gHi, x + 2, y, 1, 1);
  }
}

function drawTallGrass(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  p(ctx, C.gDark, x + 1, y + 4, 6, 5);
  p(ctx, C.gBase, x + 2, y + 6, 4, 2);
  p(ctx, C.gDark, x + 2, y + 2, 1, 4);
  p(ctx, C.gDark, x + 5, y + 1, 1, 5);
  p(ctx, C.gLight, x + 3, y, 1, 6);
  p(ctx, C.gLight, x + 4, y + 3, 1, 4);
  p(ctx, C.gHi, x + 3, y, 1, 2);
  p(ctx, C.gDark, x, y + 7, 8, 1);
}

function paintGrass(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const r = rng(11);
  const textured = hasGround("ground-grass");
  if (textured) {
    // generated SDV-style texture, mirror-tiled so there are no seams
    drawGroundTiled(ctx, "ground-grass", 0, 0, w, h, 192);
  } else {
    ctx.fillStyle = C.gBase;
    ctx.fillRect(0, 0, w, h);
    // tonal patchwork: 8px noise cells in three greens
    for (let cy = 0; cy < h; cy += 8) {
      for (let cx = 0; cx < w; cx += 8) {
        const t = r();
        ctx.fillStyle = t > 0.74 ? C.gLight : t < 0.2 ? C.gDark : C.gBase;
        ctx.fillRect(cx, cy, 8, 8);
      }
    }
    // large soft meadow/shade patches
    ctx.save();
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = r() > 0.5 ? C.gLight : C.gDark;
      ellipseFill(ctx, Math.floor(r() * w), Math.floor(r() * h), 18 + r() * 34, 10 + r() * 16);
    }
    ctx.restore();
    // pixel dither
    for (let i = 0; i < (w * h) / 40; i++) {
      const x = Math.floor(r() * w);
      const y = Math.floor(r() * h);
      ctx.fillStyle = r() > 0.5 ? C.gLight : C.gDark;
      ctx.fillRect(x, y, 2, 1);
    }
  }
  // worn dirt patches, dithered into the grass
  for (let i = 0; i < (textured ? 4 : 6); i++) {
    const cx = Math.floor(r() * w);
    const cy = Math.floor(r() * h);
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = C.soil;
    ellipseFill(ctx, cx, cy, 10 + r() * 16, 5 + r() * 8);
    ctx.restore();
    for (let d = 0; d < 14; d++) {
      p(ctx, C.soilDark, cx - 10 + Math.floor(r() * 20), cy - 6 + Math.floor(r() * 12), 1, 1);
    }
  }
  // life layer: tufts, tall clumps, daisies (lighter counts over the texture)
  for (let i = 0; i < (textured ? 60 : 100); i++) drawTuft(ctx, Math.floor(r() * (w - 8)), Math.floor(r() * (h - 10)), Math.floor(r() * 3));
  for (let i = 0; i < (textured ? 10 : 16); i++) drawTallGrass(ctx, Math.floor(r() * (w - 10)), Math.floor(r() * (h - 12)));
  for (let i = 0; i < 34; i++) {
    const x = Math.floor(r() * (w - 4));
    const y = Math.floor(r() * (h - 4));
    p(ctx, C.white, x, y, 2, 2);
    p(ctx, C.wheat, x, y, 1, 1);
  }
}

/* ── dirt path ────────────────────────────────────────────── */
function pathSeg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, r: () => number): void {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1) || 14;
  const h = Math.abs(y2 - y1) || 14;
  if (hasGround("ground-path")) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 7, y - 7, w + 14, h + 14);
    ctx.clip();
    drawGroundTiled(ctx, "ground-path", x - 7, y - 7, w + 14, h + 14, 128);
    ctx.restore();
  } else {
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
  }
  ctx.fillStyle = C.stone;
  for (let i = 0; i < (w + h) / 60; i++) {
    const edge = r() > 0.5;
    ctx.fillRect(edge ? x - 9 : x + w + 5, y + Math.floor(r() * h), 3, 2);
  }
  // dithered edges: soil dissolves into grass instead of a hard rectangle
  if (w > h) {
    for (let i = 0; i < w + 12; i += 2) {
      if (r() > 0.45) p(ctx, C.gDark, x - 9 + i, y - 9, 1, 1);
      if (r() > 0.45) p(ctx, C.gDark, x - 9 + i, y + h + 8, 1, 1);
      if (r() > 0.7) p(ctx, C.soilLight, x - 8 + i, y - 8, 1, 1);
      if (r() > 0.7) p(ctx, C.soilLight, x - 8 + i, y + h + 8, 1, 1);
    }
  } else {
    for (let i = 0; i < h + 12; i += 2) {
      if (r() > 0.45) p(ctx, C.gDark, x - 9, y - 9 + i, 1, 1);
      if (r() > 0.45) p(ctx, C.gDark, x + w + 8, y - 9 + i, 1, 1);
      if (r() > 0.7) p(ctx, C.soilLight, x - 8, y - 9 + i, 1, 1);
      if (r() > 0.7) p(ctx, C.soilLight, x + w + 8, y - 9 + i, 1, 1);
    }
  }
}

/* ── soil plot ────────────────────────────────────────────── */
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
  for (const [cxp, cyp] of [[x - 1, y - 1], [x + PLOT_W - 3, y - 1], [x - 1, y + PLOT_W - 3], [x + PLOT_W - 3, y + PLOT_W - 3]]) {
    ctx.fillStyle = C.wood;
    ctx.fillRect(cxp, cyp, 4, 4);
    ctx.fillStyle = C.woodLight;
    ctx.fillRect(cxp, cyp, 2, 4);
    ctx.fillStyle = C.outline;
    ctx.fillRect(cxp + 3, cyp, 1, 4);
  }
}

/* ── yard fence (procedural, simple rails) ────────────────── */
function fenceRun(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  if (w < 12) return;
  p(ctx, C.woodDark, x, y + 3, w, 3);
  p(ctx, C.woodTan, x, y + 3, w, 1);
  for (let px2 = x; px2 < x + w - 4; px2 += 22) {
    p(ctx, C.outline, px2, y, 6, 14);
    p(ctx, C.woodMid, px2, y + 1, 5, 12);
    p(ctx, C.woodLight, px2, y + 1, 2, 12);
  }
}

/* ── free-range critters ──────────────────────────────────── */
type CritterKind = "chicken" | "pig" | "cow" | "farmer";

const CRITTER_DEFS: Record<CritterKind, { n: number; speed: number; size: number }> = {
  chicken: { n: 3, speed: 7, size: 18 },
  pig: { n: 1, speed: 4, size: 36 },
  cow: { n: 1, speed: 3, size: 48 },
  farmer: { n: 1, speed: 6, size: 44 },
};

interface Critter {
  kind: CritterKind;
  x: number;
  y: number;
  tx: number;
  ty: number;
  pause: number;
  tick: number;
  face: 1 | -1;
}
let critters: Critter[] | null = null;

function critterCell(c: Critter): PropName {
  if (c.pause > 0) {
    if (c.kind === "chicken") return "chicken-peck";
    if (c.kind === "pig") return "pig-root";
    if (c.kind === "cow") return "cow-graze";
    return c.tick % 4 < 2 ? "farmer-idle" : "farmer-hoe"; // tends crops while pausing
  }
  if (c.kind === "farmer") return c.tick % 4 < 2 ? "farmer-walk1" : "farmer-walk2";
  return c.kind as PropName;
}

function updateCritters(blocked: Rect[], width: number, height: number, frame: number): void {
  const r = rng(77 + frame * 13);
  if (!critters) {
    const spawnAt: Record<CritterKind, [number, number]> = {
      // chickens by the field, pig & cow in the open right meadow, farmer on his path
      chicken: [110, FIELD_TOP - 44],
      pig: [545, height - 165],
      cow: [625, height - 150],
      farmer: [STUB_X + 8, FIELD_TOP + 40],
    };
    critters = [];
    for (const [kind, def] of Object.entries(CRITTER_DEFS) as [CritterKind, { n: number; speed: number; size: number }][]) {
      for (let i = 0; i < def.n; i++) {
        const [sx, sy] = spawnAt[kind];
        critters.push({
          kind,
          x: sx + i * 26,
          y: sy + i * 10,
          tx: sx,
          ty: sy,
          pause: i,
          tick: i * 2,
          face: 1,
        });
      }
    }
  }
  for (const c of critters) {
    const speed = CRITTER_DEFS[c.kind].speed;
    c.x = Math.max(18, Math.min(width - 18, c.x));
    c.y = Math.max(70, Math.min(height - 20, c.y));
    if (c.pause > 0) {
      c.pause--;
      continue;
    }
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) {
      // arrived: pause (peck/root/graze/hoe), then wander somewhere new
      c.pause = 1 + Math.floor(r() * 3);
      c.tick++;
      c.tx = 22 + r() * (width - 44);
      c.ty = 74 + r() * (height - 104);
      continue;
    }
    c.face = dx < 0 ? -1 : 1;
    const nx = c.x + (dx / dist) * speed;
    const ny = c.y + (dy / dist) * speed;
    if (blocked.some((b) => near(b, nx, ny, 2))) {
      c.tx = 22 + r() * (width - 44);
      c.ty = 74 + r() * (height - 104);
    } else {
      c.x = nx;
      c.y = ny;
      c.tick++;
    }
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
  ctx.fillStyle = C.sand;
  ellipseFill(ctx, cx, cy + 2, 82, 38);
  ctx.restore();
  ctx.fillStyle = C.outline;
  ellipseFill(ctx, cx, cy, 76, 34);
  ctx.fillStyle = C.water;
  ellipseFill(ctx, cx, cy, 73, 32);
  ctx.fillStyle = "#7fc9e0";
  ellipseFill(ctx, cx - 18, cy - 12, 34, 12);
  ctx.fillStyle = C.waterHi;
  const off = frame * 3;
  ctx.fillRect(cx - 40 + off, cy - 8, 14, 1);
  ctx.fillRect(cx + 8 - off, cy + 4, 18, 1);
  ctx.fillRect(cx + 30, cy + 16 - (frame % 2), 10, 1);
  for (const [dx, dy] of [[-84, -8], [-78, 2], [74, 6], [80, -2]] as const) {
    p(ctx, C.leaf, cx + dx, cy + dy, 2, 12);
    p(ctx, C.leafDark, cx + dx, cy + dy, 1, 6);
  }
}

/* ── scatter flowers ──────────────────────────────────────── */
function flowerDot(ctx: CanvasRenderingContext2D, x: number, y: number, col: string): void {
  p(ctx, C.leaf, x + 1, y + 2, 1, 2);
  p(ctx, col, x, y + 1, 3, 2);
  p(ctx, col, x + 1, y, 1, 1);
  p(ctx, col, x + 1, y + 3, 1, 1);
  p(ctx, C.wheat, x + 1, y + 1, 1, 1);
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
  const r = rng(2024);

  paintGrass(ctx, width, height);

  // ── house zone (manor sprite at every level) ──
  const tier = (level >= 4 ? 2 : level >= 2 ? 1 : 0) as 0 | 1 | 2;
  const hw = [178, 190, 200][tier];
  const aspect = assetAspect(HOUSE_KEY);
  const hh = Math.round(hw * aspect);
  const hx = width - hw - 22;
  const hy = 6;
  const house = drawAsset(ctx, HOUSE_KEY, hx, hy, hw);
  const gateX = hx + Math.round(hw / 2);
  const doorY = hy + hh;
  const fy = doorY + 4;

  fenceRun(ctx, hx - 26, fy, Math.max(12, gateX - hx - 10));
  fenceRun(ctx, gateX + 14, fy, Math.max(12, hx + hw + 26 - gateX - 14));

  drawPropSprite(ctx, "trough", hx - 46, fy + 14, 20);
  drawPropSprite(ctx, "bush", hx + hw + 12, fy + 14, 30);

  // ── path: horizontal above the field, stub down the col gutter walkway ──
  const PATH_Y = FIELD_TOP - 12;
  pathSeg(ctx, STUB_X, PATH_Y, gateX, PATH_Y, r);
  pathSeg(ctx, STUB_X, PATH_Y, STUB_X, FIELD_TOP + 3 * ROW_PITCH + 4, r);

  // ── tree cluster (generated sprite) ──
  if (level >= 2) {
    drawAsset(ctx, "tree-oak", 40, 14, 124);
    drawAsset(ctx, "tree-oak", 158, 46, 104);
    drawPropSprite(ctx, "bush", 30, 132, 26);
  } else {
    drawAsset(ctx, "tree-oak", 80, 44, 96);
    drawPropSprite(ctx, "rock", 158, 122, 18);
  }
  if (level >= 3) {
    drawAsset(ctx, "tree-oak", 6, 60, 96);
    drawPropSprite(ctx, "rock", 288, 132, 22);
  }

  // ── pond or lower-right props ──
  if (level >= 4) {
    drawPond(ctx, height, frame);
  } else {
    drawPropSprite(ctx, "haystack", 596, height - 112, 40);
    drawPropSprite(ctx, "logs", 502, height - 92, 26);
  }

  // ── field ──
  const maxDiv = Math.max(1, ...holdings.map((h) => h.t12mDividend));
  holdings.forEach((h, i) => {
    const px = COL_X[i % COLS];
    const py = FIELD_TOP + Math.floor(i / COLS) * ROW_PITCH;
    soilPlot(ctx, px, py, r);
    const ratio = h.t12mDividend / maxDiv;
    // growth stage comes from this stock's own dividend cycle; holdings with
    // no dividend history fall back to the income-rank stage (cells 1-4)
    const stage = h.growth
      ? h.growth.stage
      : h.t12mDividend > 0
        ? 1 + Math.min(3, Math.round(ratio * 3))
        : 0;
    const ready = h.growth?.ready ?? false;
    const name = cropName(h.cropIndex);
    for (let ty = 0; ty < 3; ty++) {
      for (let tx = 0; tx < 3; tx++) {
        drawCropSprite(ctx, name, stage, px + tx * TILE + 2, py + ty * TILE + 30, 36);
        if (ready && frame % 2 === 1) {
          // harvest-ready sparkle pulse while the dividend window is open
          p(ctx, C.white, px + tx * TILE + 14, py + ty * TILE - 2, 2, 2);
          p(ctx, C.wheat, px + tx * TILE + 22, py + ty * TILE + 6, 1, 1);
        }
      }
    }
    drawSign(ctx, h.symbol, `£${Math.round(h.t12mDividend)}/yr`, px + PLOT_W / 2, py + PLOT_W + 8);
  });

  drawPropSprite(ctx, "scarecrow", 181, FIELD_TOP + 62, 50);

  // ── scatter: flowers + pebbles avoiding everything built ──
  const fieldBottom = FIELD_TOP + Math.ceil(holdings.length / COLS) * ROW_PITCH;
  const blocked: Rect[] = [
    { x: hx - 34, y: hy - 14, w: hw + 68, h: hh + 34 },
    { x: 12, y: 60, w: 300, h: 84 },
    ...holdings.map((_, i) => ({
      x: COL_X[i % COLS] - 8,
      y: FIELD_TOP + Math.floor(i / COLS) * ROW_PITCH - 6,
      w: PLOT_W + 16,
      h: PLOT_W + 46,
    })),
    { x: gateX - 12, y: hy + hh - 8, w: 26, h: fieldBottom - hy - hh },
    { x: COL_X[2] + PLOT_W + 4, y: FIELD_TOP - 40, w: 34, h: 110 },
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
      p(ctx, C.stone, x + 12, y + 4, 2, 2);
      p(ctx, C.stone, x + 15, y + 6, 2, 2);
      p(ctx, C.stoneLight, x + 12, y + 4, 1, 1);
    }
  }

  // ── free-range critters: chickens, pig, cow, and the farmer ──
  updateCritters(blocked, width, height, frame);
  const drawn = [...critters!].sort((a, b) => a.y - b.y);
  for (const c of drawn) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#14200a";
    ellipseFill(ctx, c.x, c.y + 1, CRITTER_DEFS[c.kind].size / 3.5, 2);
    ctx.restore();
    drawPropSprite(ctx, critterCell(c), c.x, c.y, CRITTER_DEFS[c.kind].size, c.face === -1);
  }

  // ── chimney smoke ──
  if (tier >= 1) {
    const chimX = hx + Math.round(hw * 0.56);
    const chimY = hy + Math.round(hh * 0.03);
    ctx.save();
    ctx.globalAlpha = 0.75;
    const wrap = (v: number, m: number) => ((v % m) + m) % m;
    const rise = frame * 3;
    p(ctx, C.smokeDark, chimX - 2 + Math.round(Math.sin(rise)), chimY - 4 - wrap(rise, 18), 3, 3);
    p(ctx, C.smoke, chimX + 2, chimY - 4 - wrap(rise + 9, 18), 2, 2);
    ctx.restore();
  }
}

// re-exported for App-level callers
export { drawPropSprite as drawProp, type PropName };
