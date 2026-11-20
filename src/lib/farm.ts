// Scene composer: textured ground, seasonal palettes, 3-column field with
// per-stock growth stages, manor + yard, orchard, windmill, pond, critters
// (farmer AI: water/harvest/plant per stock), particles, day/night, weather.

import { C, TILE, CROP_NAMES, drawSign, drawText } from "./art.js";
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
import {
  type Settings,
  type World,
  spawnAmbient,
  updateParticles,
  drawParticles,
  burst,
  floatText,
  firework,
} from "./world.js";

export const SCENE_W = 720;
const FIELD_TOP = 152;
const PLOT_W = 3 * TILE;
const ROW_PITCH = PLOT_W + 62;
const COLS = 3;
const COL_X = [26, 196, 366];
const STUB_X = Math.round((COL_X[0] + PLOT_W + COL_X[1]) / 2);
const HOUSE_KEY = "house-manor";
const HOUSE_W = [178, 190, 200];

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

export function plotRects(holdings: HoldingRow[]): { symbol: string; name: string; x: number; y: number; w: number; h: number }[] {
  return holdings.map((h, i) => ({
    symbol: h.symbol,
    name: h.name,
    x: COL_X[i % COLS],
    y: FIELD_TOP + Math.floor(i / COLS) * ROW_PITCH,
    w: PLOT_W,
    h: PLOT_W,
  }));
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

/* ── ground ───────────────────────────────────────────────── */
function drawTuft(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number): void {
  if (variant === 0) {
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

function paintGrass(ctx: CanvasRenderingContext2D, w: number, h: number, world: World, tick: number): void {
  const r = rng(11);
  const textured = hasGround("ground-grass");
  if (textured) drawGroundTiled(ctx, "ground-grass", 0, 0, w, h, 240);
  else {
    ctx.fillStyle = C.gBase;
    ctx.fillRect(0, 0, w, h);
    for (let cy = 0; cy < h; cy += 8) {
      for (let cx = 0; cx < w; cx += 8) {
        const t = r();
        ctx.fillStyle = t > 0.74 ? C.gLight : t < 0.2 ? C.gDark : C.gBase;
        ctx.fillRect(cx, cy, 8, 8);
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    const cx = Math.floor(r() * w);
    const cy = Math.floor(r() * h);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = C.soil;
    ellipseFill(ctx, cx, cy, 10 + r() * 16, 5 + r() * 8);
    ctx.restore();
    for (let d = 0; d < 12; d++) p(ctx, C.soilDark, cx - 10 + Math.floor(r() * 20), cy - 6 + Math.floor(r() * 12), 1, 1);
  }
  // dense life layer: tufts, clumps, thousands of blade strokes
  for (let i = 0; i < 300; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(r() * h);
    const tone = r();
    ctx.fillStyle = tone > 0.66 ? C.gHi : tone > 0.33 ? C.gLight : C.gDark;
    ctx.fillRect(x, y, 1, 2 + Math.floor(r() * 2));
  }
  for (let i = 0; i < 90; i++) drawTuft(ctx, Math.floor(r() * (w - 8)), Math.floor(r() * (h - 10)), Math.floor(r() * 3));
  for (let i = 0; i < 18; i++) drawTallGrass(ctx, Math.floor(r() * (w - 10)), Math.floor(r() * (h - 12)));
  // clover patches
  for (let i = 0; i < 4; i++) {
    const cx = Math.floor(r() * (w - 12));
    const cy = Math.floor(r() * (h - 12));
    for (let l = 0; l < 5; l++) {
      p(ctx, C.gDark, cx + (l % 3) * 4, cy + Math.floor(l / 3) * 4, 2, 2);
      p(ctx, C.leafDark, cx + (l % 3) * 4 + 1, cy + Math.floor(l / 3) * 4, 1, 1);
    }
  }
  // mushrooms
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(r() * (w - 8));
    const y = Math.floor(r() * (h - 8));
    p(ctx, C.woodTan, x + 1, y + 2, 2, 2);
    p(ctx, "#d9483b", x, y, 4, 2);
    p(ctx, "#eef0e6", x + 1, y, 1, 1);
  }
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(r() * (w - 4));
    const y = Math.floor(r() * (h - 4));
    p(ctx, C.white, x, y, 2, 2);
    p(ctx, C.wheat, x, y, 1, 1);
  }
  // wind ripple sweeping the field
  if (tick % 2 === 0) {
    const bandY = ((tick * 13) % (h + 160)) - 80;
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = C.gHi;
    ellipseFill(ctx, w * 0.5, bandY, w * 0.6, 26);
    ctx.restore();
  }
  // seasonal ground tint
  if (world.season === "winter") {
    ctx.fillStyle = "rgba(238, 244, 250, 0.5)";
    ctx.fillRect(0, 0, w, h);
  } else if (world.season === "autumn") {
    ctx.fillStyle = "rgba(200, 120, 40, 0.08)";
    ctx.fillRect(0, 0, w, h);
  } else if (world.season === "spring") {
    ctx.fillStyle = "rgba(255, 190, 210, 0.06)";
    ctx.fillRect(0, 0, w, h);
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
    drawGroundTiled(ctx, "ground-path", x - 7, y - 7, w + 14, h + 14, 240);
    ctx.restore();
    // wheel ruts along the path direction
    if (w > h) {
      ctx.fillStyle = "rgba(40, 24, 10, 0.35)";
      ctx.fillRect(x, y - 3, w, 2);
      ctx.fillRect(x, y + 4, w, 2);
    } else {
      ctx.fillStyle = "rgba(40, 24, 10, 0.35)";
      ctx.fillRect(x - 3, y, 2, h);
      ctx.fillRect(x + 4, y, 2, h);
    }
  } else {
    ctx.fillStyle = C.soil;
    ctx.fillRect(x - 7, y - 7, w + 14, h + 14);
  }
  ctx.fillStyle = C.stone;
  for (let i = 0; i < (w + h) / 40; i++) {
    const edge = r() > 0.5;
    ctx.fillRect(edge ? x - 9 : x + w + 5, y + Math.floor(r() * h), 3, 2);
  }
  // grass encroaching on the path edges
  if (w > h) {
    for (let i = 0; i < w; i += 3) {
      if (r() > 0.4) p(ctx, C.gDark, x - 8 + i, y - 7, 1, 2);
      if (r() > 0.4) p(ctx, C.gDark, x - 8 + i, y + h + 6, 1, 2);
    }
  } else {
    for (let i = 0; i < h; i += 3) {
      if (r() > 0.4) p(ctx, C.gDark, x - 7, y - 8 + i, 2, 1);
      if (r() > 0.4) p(ctx, C.gDark, x + w + 6, y - 8 + i, 2, 1);
    }
  }
  if (w > h) {
    for (let i = 0; i < w + 12; i += 2) {
      if (r() > 0.45) p(ctx, C.gDark, x - 9 + i, y - 9, 1, 1);
      if (r() > 0.45) p(ctx, C.gDark, x - 9 + i, y + h + 8, 1, 1);
    }
  } else {
    for (let i = 0; i < h + 12; i += 2) {
      if (r() > 0.45) p(ctx, C.gDark, x - 9, y - 9 + i, 1, 1);
      if (r() > 0.45) p(ctx, C.gDark, x + w + 8, y - 9 + i, 1, 1);
    }
  }
}

/* ── soil plot ────────────────────────────────────────────── */
const wateredUntil: number[] = [];

function soilPlot(ctx: CanvasRenderingContext2D, x: number, y: number, idx: number, tick: number, r: () => number): void {
  ctx.fillStyle = C.soil;
  ctx.fillRect(x, y, PLOT_W, PLOT_W);
  ctx.fillStyle = C.soilLight;
  for (const fy of [5, 6, 13, 14, 21, 22, 29, 30, 37, 38, 45, 46, 53, 54, 61, 62, 69, 70, 77, 78, 85, 86]) {
    ctx.fillRect(x + 2, y + fy, PLOT_W - 4, 1);
  }
  ctx.fillStyle = C.soilDark;
  for (let i = 0; i < 26; i++) ctx.fillRect(x + 2 + Math.floor(r() * 92), y + 2 + Math.floor(r() * 92), 1, 1);
  // freshly watered: darker, damp soil with a cool sheen
  if ((wateredUntil[idx] ?? 0) > tick) {
    ctx.fillStyle = "rgba(30, 16, 6, 0.45)";
    ctx.fillRect(x + 1, y + 1, PLOT_W - 2, PLOT_W - 2);
    ctx.fillStyle = "rgba(130, 170, 225, 0.14)";
    ctx.fillRect(x + 8, y + 10, 4, 2);
    ctx.fillRect(x + 46, y + 42, 4, 2);
    ctx.fillRect(x + 26, y + 66, 4, 2);
  }
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

/* ── fence / flowers ──────────────────────────────────────── */
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

function flowerDot(ctx: CanvasRenderingContext2D, x: number, y: number, col: string): void {
  p(ctx, C.leaf, x + 1, y + 2, 1, 2);
  p(ctx, col, x, y + 1, 3, 2);
  p(ctx, col, x + 1, y, 1, 1);
  p(ctx, col, x + 1, y + 3, 1, 1);
  p(ctx, C.wheat, x + 1, y + 1, 1, 1);
}

/** Soft ground shadow under a tree canopy. */
function treeShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number): void {
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#14200a";
  ellipseFill(ctx, cx, cy, rx, 6);
  ctx.restore();
}

function pondRect(height: number): Rect {
  return { x: 500, y: height - 150, w: 200, h: 100 };
}

/* ── critters ─────────────────────────────────────────────── */
type CritterKind = "chicken" | "pig" | "cow" | "farmer" | "duck" | "cat" | "horse" | "goat" | "rabbit" | "dog";

const CRITTER_DEFS: Record<CritterKind, { n: number; speed: number; size: number }> = {
  chicken: { n: 3, speed: 10, size: 18 },
  pig: { n: 1, speed: 6, size: 40 },
  cow: { n: 1, speed: 5, size: 52 },
  farmer: { n: 1, speed: 9, size: 46 },
  duck: { n: 2, speed: 4, size: 20 },
  cat: { n: 1, speed: 8, size: 24 },
  horse: { n: 1, speed: 5, size: 54 },
  goat: { n: 1, speed: 5, size: 34 },
  rabbit: { n: 1, speed: 10, size: 16 },
  dog: { n: 1, speed: 8, size: 30 },
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
  mood: number;
  sleep: boolean;
}
let critters: Critter[] | null = null;

interface Butterfly { x: number; y: number; tx: number; ty: number; tick: number }
let butterflies: Butterfly[] | null = null;

// ── emote bubbles (♪ ♥ ! Zz) ──
type EmoteKind = "heart" | "note" | "alert" | "zzz";
interface Emote { kind: EmoteKind; x: number; y: number; life: number }
let emotes: Emote[] = [];

function spawnEmote(kind: EmoteKind, x: number, y: number, life = 7): void {
  if (emotes.length < 12) emotes.push({ kind, x, y, life });
}

function homeFor(kind: CritterKind, fieldBottom: number): { x: number; y: number } | null {
  switch (kind) {
    case "chicken": return { x: 150, y: fieldBottom - 10 };
    case "cow": return { x: 600, y: fieldBottom - 26 };
    case "horse": return { x: 560, y: fieldBottom - 44 };
    case "pig": return { x: 540, y: fieldBottom - 18 };
    case "goat": return { x: 612, y: fieldBottom - 22 };
    case "rabbit": return { x: 60, y: FIELD_TOP - 40 };
    case "duck": return { x: 500, y: FIELD_TOP + 26 };
    case "dog": return { x: STUB_X + 34, y: FIELD_TOP + 48 };
    default: return null; // the cat curls up wherever it is
  }
}

let doorPos = { x: 0, y: 0 };
let farmerVanished = false;
let rainingNow = false;
let truffle: { x: number; y: number; until: number } | null = null;
let crow: { x: number; y: number; vx: number; vy: number; state: "fly" | "peck" | "flee"; left: number } | null = null;

let brain: { plotIdx: number; mode: "walk" | "water" | "harvest" | "plant" | "weed" | "sleep"; actionLeft: number; stroll: { x: number; y: number } | null; roundWatered: number } | null = null;
let prevLevel = 0;
const prevNext = new Map<string, string>();
let rainbowUntil = -999;
let egg: { x: number; y: number; until: number } | null = null;

function critterCell(c: Critter): PropName {
  if (c.sleep) {
    if (c.kind === "cow") return "cow-lying";
    if (c.kind === "chicken") return "chicken-sleep";
    if (c.kind === "duck") return "duck-sleep";
    if (c.kind === "cat") return "cat-sleep";
    if (c.kind === "dog") return "dog";
    return c.kind === "pig" ? "pig-root" : (c.kind as PropName);
  }
  if (c.pause > 0) {
    if (c.kind === "chicken") return "chicken-peck";
    if (c.kind === "pig") return "pig-root";
    if (c.kind === "cow") return "cow-graze";
    if (c.kind === "duck") return "duck-flap";
    if (c.kind === "cat") return "cat-sit";
    if (c.kind === "horse") return "horse-graze";
    const b = brain!;
    if (c.kind === "farmer") {
      if (b.mode === "water") return c.tick % 4 < 2 ? "farmer-water1" : "farmer-water2";
      if (b.mode === "harvest") return c.tick % 4 < 2 ? "farmer-harvest1" : "farmer-harvest2";
      if (b.mode === "plant") return c.tick % 4 < 2 ? "farmer-seed1" : "farmer-seed2";
      if (b.mode === "weed") return "farmer-hoe";
      return "farmer-idle";
    }
    return "goat";
  }
  if (c.kind === "farmer") {
    if (rainingNow) return "farmer-rain";
    return c.tick % 4 < 2 ? "farmer-walk1" : "farmer-walk2";
  }
  if (c.kind === "cat") return "cat-walk";
  if (c.kind === "duck") return "duck";
  if (c.kind === "dog") return "dog-walk";
  if (c.kind === "horse") return "horse";
  return c.kind as PropName;
}

function zoneFor(kind: CritterKind, _width: number, height: number, level: number): Rect | null {
  // full-map roam for everyone; only ducks bias to water when it exists
  if (kind === "duck" && level >= 4) return pondRect(height);
  return null;
}

function pickTarget(
  c: Critter,
  blocked: Rect[],
  r: () => number,
  width: number,
  height: number,
  level: number,
): void {
  const zone = zoneFor(c.kind, width, height, level);
  for (let attempt = 0; attempt < 8; attempt++) {
    const tx = Math.max(22, Math.min(width - 22, zone ? zone.x + r() * zone.w : 22 + r() * (width - 44)));
    const ty = Math.max(74, Math.min(height - 20, zone ? zone.y + r() * zone.h : 74 + r() * (height - 104)));
    if (!blocked.some((b) => near(b, tx, ty, 2)) || attempt === 7) {
      c.tx = tx;
      c.ty = ty;
      return;
    }
  }
}

function tryStep(c: Critter, tx: number, ty: number, blocked: Rect[], width: number, height: number, speed: number): boolean {
  const base = Math.atan2(ty - c.y, tx - c.x);
  for (const off of [0, 0.55, -0.55, 1.1, -1.1, 1.7, -1.7, Math.PI]) {
    const a = base + off;
    const nx = c.x + Math.cos(a) * speed;
    const ny = c.y + Math.sin(a) * speed;
    if (nx < 18 || nx > width - 18 || ny < 70 || ny > height - 20) continue;
    if (blocked.some((b) => near(b, nx, ny, 2))) continue;
    c.x = nx;
    c.y = ny;
    c.face = Math.cos(a) < 0 ? -1 : 1;
    c.tick++;
    return true;
  }
  return false;
}

function updateCritters(
  blocked: Rect[],
  width: number,
  height: number,
  level: number,
  world: World,
  holdings: HoldingRow[],
  tick: number,
): void {
  const r = rng(77 + Math.floor(world.windT * 100));
  // daily rhythm state
  const h = world.hour;
  const rainDay = world.weather === "rain";
  const homesActive = h >= 17 || h < 5.5; // animals path home after 17:00
  const farmerHidden = h >= 19.8 || h < 6.4;
  const morningRound = h >= 6.4 && h < 10 && !rainDay;
  rainingNow = rainDay;
  farmerVanished = farmerHidden && brain?.mode === "sleep";
  if (!critters) {
    const spawnAt: Record<CritterKind, [number, number]> = {
      chicken: [150, height - 96],
      pig: [545, height - 170],
      cow: [620, height - 178],
      farmer: [STUB_X + 8, FIELD_TOP + 40],
      duck: [500, height - 122],
      cat: [480, FIELD_TOP + 100],
      horse: [585, height - 178],
      goat: [650, height - 174],
      rabbit: [64, FIELD_TOP - 46],
      dog: [STUB_X + 34, FIELD_TOP + 48],
    };
    critters = [];
    for (const [kind, def] of Object.entries(CRITTER_DEFS) as [CritterKind, { n: number; speed: number; size: number }][]) {
      // ducks only exist where there is water to swim (the pond, level 4+)
      if (kind === "duck" && level < 4) continue;
      for (let i = 0; i < def.n; i++) {
        const [sx, sy] = spawnAt[kind];
        critters.push({ kind, x: sx + i * 24, y: sy + i * 9, tx: sx, ty: sy, pause: i, tick: i * 2, face: 1, mood: 0, sleep: false });
      }
    }
  }
  if (!brain) brain = { plotIdx: 0, mode: "walk", actionLeft: 0, stroll: null, roundWatered: 0 };

  // butterflies over the flower zones; the cat hunts the nearest one
  if (!butterflies) {
    butterflies = [
      { x: 180, y: 120, tx: 180, ty: 120, tick: 0 },
      { x: 520, y: FIELD_TOP + 20, tx: 520, ty: FIELD_TOP + 20, tick: 0 },
    ];
  }
  for (const b of butterflies) {
    b.tick++;
    const dx = b.tx - b.x;
    const dy = b.ty - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 10) {
      // keep butterflies off the crop plots so the cat never chases them there
      let tries = 0;
      do {
        b.tx = 60 + r() * (width - 120);
        b.ty = 70 + r() * (height * 0.82);
        tries++;
      } while (
        tries < 6 &&
        holdings.some((_, i) => {
          const px = COL_X[i % COLS];
          const py = FIELD_TOP + Math.floor(i / COLS) * ROW_PITCH;
          return b.tx > px - 6 && b.tx < px + PLOT_W + 6 && b.ty > py - 6 && b.ty < py + PLOT_W + 6;
        })
      );
      continue;
    }
    b.x += (dx / d) * 2.2 + Math.sin(b.tick * 0.8) * 0.7;
    b.y += (dy / d) * 2.2 + Math.cos(b.tick * 0.7) * 0.6;
  }
  const cat = critters.find((c) => c.kind === "cat");
  if (cat) {
    const nearest = butterflies.reduce((best, b) =>
      Math.hypot(b.x - cat.x, b.y - cat.y) < Math.hypot(best.x - cat.x, best.y - cat.y) ? b : best);
    if (Math.hypot(nearest.x - cat.x, nearest.y - cat.y) < 130) {
      cat.tx = nearest.x;
      cat.ty = nearest.y + 8;
      cat.pause = 0;
    }
  }

    // crow swoop: goes for a ripe plot; the scarecrow scares it off
    const readyPlots = plotRects(holdings).filter((_, i) => holdings[i].growth?.ready);
    if (!crow && tick % 160 === 60 && readyPlots.length) {
      const target = readyPlots[Math.floor(r() * readyPlots.length)];
      crow = {
        x: width + 20, y: 90,
        vx: -6, vy: (target.y + 20 - 90) / Math.max(1, (width + 20 - target.x - 40) / 6),
        state: "fly", left: 0,
      };
      (crow as unknown as { target: { x: number; y: number; guarded: boolean } }).target = {
        x: target.x + PLOT_W / 2,
        y: target.y + 24,
        guarded: Math.hypot(target.x - 318, target.y - FIELD_TOP - 40) < 130,
      };
    }
    if (crow) {
      const tgt = (crow as unknown as { target: { x: number; y: number; guarded: boolean } }).target;
      if (crow.state === "fly") {
        crow.x += crow.vx;
        crow.y += crow.vy;
        if (Math.hypot(crow.x - tgt.x, crow.y - tgt.y) < 14) {
          if (tgt.guarded) {
            crow.state = "flee";
            spawnEmote("alert", 318, FIELD_TOP + 26);
          } else {
            crow.state = "peck";
            crow.left = 4;
          }
        }
      } else if (crow.state === "peck") {
        crow.left--;
        if (tick % 2 === 0 && world.particles.length < 200) {
          burst(world, "seed", crow.x, crow.y + 6, 1, ["#54381f"], 0.6);
        }
        if (crow.left <= 0) crow.state = "flee";
      } else {
        crow.x += 7;
        crow.y -= 4;
        if (crow.x > width + 30) crow = null;
      }
    }

    for (const c of critters) {
    const speed = CRITTER_DEFS[c.kind].speed;
    c.x = Math.max(18, Math.min(width - 18, c.x));
    c.y = Math.max(70, Math.min(height - 20, c.y));

    // ── daily rhythm ──
    // animals sleep when it's deep night; they path home at dusk
    if (homesActive) {
      if (!c.sleep && c.kind !== "cat") {
        c.sleep = true;
        if (r() < 0.4) spawnEmote("note", c.x, c.y - 18);
      }
      // walk to the home anchor once, then settle
      const home = homeFor(c.kind, height - 90);
      if (home && Math.hypot(home.x - c.x, home.y - c.y) > 14) {
        c.tx = home.x;
        c.ty = home.y;
        if (!tryStep(c, c.tx, c.ty, blocked, width, height, speed)) {
          c.sleep = true;
        }
        continue;
      }
      // settled at home: sleep, occasional Zz
      if (tick % 14 === 0 && r() < 0.6) spawnEmote("zzz", c.x, c.y - 16, 8);
      continue;
    } else if (c.sleep) {
      c.sleep = false;
      if (r() < 0.5) spawnEmote("note", c.x, c.y - 18);
    }
    if (world.nightDepth > 0.45 && c.kind !== "farmer") {
      // deep night before homes activate: settle in place with Zz
      if (tick % 14 === 0) spawnEmote("zzz", c.x, c.y - 16, 8);
      continue;
    }

    // ── farmer schedule ──
    if (c.kind === "farmer") {
      if (farmerHidden) {
        // walk home, then vanish inside the manor for the night
        if (Math.hypot(doorPos.x - c.x, doorPos.y - c.y) > 12) {
          c.tx = doorPos.x;
          c.ty = doorPos.y;
          tryStep(c, c.tx, c.ty, blocked, width, height, speed);
          continue;
        }
        brain!.mode = "sleep";
        continue;
      }
      if (brain!.mode === "sleep") brain!.mode = "walk"; // dawn: back to work
      // rain day: skip the watering round — crops are watered by the rain
      if (rainDay && brain!.roundWatered !== tick - (tick % 1000)) {
        brain!.roundWatered = tick - (tick % 1000);
        for (let i = 0; i < holdings.length; i++) wateredUntil[i] = tick + 2500;
      }
      // morning: the watering round comes first
      if (morningRound && brain!.mode !== "water" && brain!.roundWatered !== tick - (tick % 1000)) {
        brain!.mode = "water";
        brain!.stroll = null;
        const rect = plotRects(holdings)[brain!.plotIdx];
        if (rect) {
          c.tx = rect.x + PLOT_W / 2;
          c.ty = rect.y + PLOT_W - 8;
        }
      }
    }
    if (c.pause > 0) {
      c.pause--;
      if (c.kind === "farmer" && c.pause === 0) {
        if (brain!.stroll) {
          // stroll finished → resume the plot tour
          brain!.stroll = null;
          brain!.mode = "walk";
          const rect = plotRects(holdings)[brain!.plotIdx];
          if (rect) {
            c.tx = rect.x + PLOT_W / 2;
            c.ty = rect.y + PLOT_W - 8;
          }
        } else {
          brain!.plotIdx = (brain!.plotIdx + 1) % Math.max(1, holdings.length);
          if (brain!.plotIdx === 0 && morningRound) {
            brain!.roundWatered = tick - (tick % 1000); // morning round complete
          }
          if (brain!.plotIdx === 0) {
            // full tour done: take a stroll anywhere on the map first
            pickTarget(c, blocked, r, width, height, level);
            brain!.stroll = { x: c.tx, y: c.ty };
          } else {
            brain!.mode = "walk";
            const rect = plotRects(holdings)[brain!.plotIdx];
            if (rect) {
              c.tx = rect.x + PLOT_W / 2;
              c.ty = rect.y + PLOT_W - 8;
            }
          }
        }
      }
      continue;
    }
    // farmer strolling: just walk to the stroll point
    if (c.kind === "farmer" && brain!.stroll) {
      if (Math.hypot(c.tx - c.x, c.ty - c.y) < 10) {
        c.pause = 3;
      }
      if (!tryStep(c, c.tx, c.ty, blocked, width, height, speed)) {
        brain!.stroll = null;
        brain!.mode = "walk";
      }
      continue;
    }
    // farmer routine: walk to plot → act by that stock's dividend state
    if (c.kind === "farmer" && brain!.mode === "walk") {
      const rect = plotRects(holdings)[brain!.plotIdx];
      if (rect) {
        c.tx = rect.x + PLOT_W / 2;
        c.ty = rect.y + PLOT_W - 8;
      }
      if (Math.hypot(c.tx - c.x, c.ty - c.y) < 10 && holdings.length) {
        const h = holdings[brain!.plotIdx];
        const rect2 = plotRects(holdings)[brain!.plotIdx];
        if (morningRound) {
          // the morning round waters every plot before anything else
          brain!.mode = "water";
          brain!.actionLeft = 3;
        } else if (h?.growth?.ready) {
          brain!.mode = "harvest";
          brain!.actionLeft = 3;
          burst(world, "sparkle", rect2.x + PLOT_W / 2, rect2.y + 24, 14, ["#f2a63b", "#e8c547", "#ffffff"], 1.6);
          floatText(world, rect2.x + PLOT_W / 2 - 12, rect2.y - 2, `★ ${h.symbol}`);
        } else if ((h?.growth?.progressPct ?? 100) < 18) {
          brain!.mode = "plant";
          brain!.actionLeft = 2;
          burst(world, "seed", rect2.x + PLOT_W / 2, rect2.y + 40, 8, ["#d9b35c", "#8a5c33"], 1.1);
        } else {
          brain!.mode = "weed";
          brain!.actionLeft = 2;
          burst(world, "seed", rect2.x + PLOT_W / 2, rect2.y + 30, 3, ["#54381f"], 0.7);
        }
        c.pause = brain!.actionLeft;
        if (brain!.mode === "water") {
          wateredUntil[brain!.plotIdx] = tick + 2500; // damp until the next round
        }
        continue;
      }
    }
    if (c.kind === "farmer" && brain!.mode === "water" && c.pause > 0) {
      const rect = plotRects(holdings)[brain!.plotIdx];
      if (rect && world.particles.length < 200) {
        burst(world, "drop", rect.x + PLOT_W / 2 + (r() - 0.5) * 44, rect.y + 8, 2, ["#8fd3df"], 0.9);
      }
    }
    // hard clamp: nothing but ducks stands on crop soil
    if (c.kind !== "duck") {
      for (const b of blocked) {
        if (near(b, c.x, c.y, 0) && b.h === PLOT_W - 8) {
          // inside a plot rect: push to the nearest horizontal edge
          const midX = b.x + b.w / 2;
          c.x = c.x < midX ? b.x - 3 : b.x + b.w + 3;
        }
      }
    }
    const stuck = blocked.some((b) => near(b, c.x, c.y, 2));
    if (stuck) {
      // trapped inside solid terrain (bad spawn or push): teleport to the
      // nearest open point — tryStep alone can never escape a small rect
      let done = false;
      for (let radius = 14; radius <= 100 && !done; radius += 14) {
        for (let a = 0; a < Math.PI * 2 && !done; a += Math.PI / 10) {
          const ex = c.x + Math.cos(a) * radius;
          const ey = c.y + Math.sin(a) * radius;
          if (ex < 18 || ex > width - 18 || ey < 70 || ey > height - 20) continue;
          if (!blocked.some((b) => near(b, ex, ey, 2))) {
            c.x = ex;
            c.y = ey;
            done = true;
          }
        }
      }
      pickTarget(c, blocked, r, width, height, level);
      continue;
    }
    const dist = Math.hypot(c.tx - c.x, c.ty - c.y);
    if (dist < 8) {
      c.pause = 1 + Math.floor(r() * 3);
      c.tick++;
      if (c.kind === "chicken" && r() < 0.08 && !egg) {
        egg = { x: c.x + 6, y: c.y, until: world.windT + 40 };
      }
      if (c.kind === "pig" && r() < 0.3 && !truffle) {
        truffle = { x: c.x + 10, y: c.y + 2, until: world.windT + 70 };
        spawnEmote("alert", c.x, c.y - 24);
        burst(world, "seed", c.x + 10, c.y, 4, ["#54381f", "#8a5c33"], 0.8);
      }
      pickTarget(c, blocked, r, width, height, level);
      continue;
    }
    if (stuck) pickTarget(c, blocked, r, width, height, level);
    if (!tryStep(c, c.tx, c.ty, blocked, width, height, speed)) {
      pickTarget(c, blocked, r, width, height, level);
    }
  }
}

/** Public accessors for interactivity. */
export function critterPositions(): { kind: string; x: number; y: number }[] {
  return (critters ?? []).map((c) => ({ kind: c.kind, x: c.x, y: c.y }));
}


/** Pet an animal: ♥ burst, mood up, occasional ♪. */
export function petCritter(kind: string, x: number, y: number): void {
  const target = (critters ?? []).find((c) => c.kind === kind && Math.hypot(c.x - x, c.y - y) < 30);
  if (!target) return;
  target.mood++;
  spawnEmote("heart", target.x, target.y - CRITTER_DEFS[target.kind].size - 6);
  if (target.mood % 3 === 0) spawnEmote("note", target.x + 10, target.y - CRITTER_DEFS[target.kind].size - 12);
  target.face = target.face === 1 ? -1 : 1;
}

/* ── pond (level ≥ 4) ─────────────────────────────────────── */
function ambientColor(world: World, settings: Settings): string {
  // day = white; night deep blue-purple (contrast survives multiply);
  // dusk/dawn warm blends; rain desaturates.
  let r = 255, g = 255, b = 255;
  const nd = world.nightDepth;
  r += (96 - r) * nd;
  g += (116 - g) * nd;
  b += (190 - b) * nd;
  if (world.duskWarm > 0.02) {
    r += (255 - r) * world.duskWarm * 0.55;
    g += (150 - g) * world.duskWarm * 0.5;
    b += (80 - b) * world.duskWarm * 0.55;
  }
  if (world.dawnPink > 0.02) {
    r += (255 - r) * world.dawnPink * 0.4;
    g += (190 - g) * world.dawnPink * 0.4;
    b += (170 - b) * world.dawnPink * 0.4;
  }
  if (world.weather === "rain" && settings.weather) {
    r *= 0.8;
    g *= 0.83;
    b *= 0.9;
  }
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}

function addLight(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 2, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawPond(ctx: CanvasRenderingContext2D, height: number, tick: number, world: World): void {
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
  const off = (tick % 12) * 2;
  ctx.fillRect(cx - 40 + off, cy - 8, 14, 1);
  ctx.fillRect(cx + 8 - off, cy + 4, 18, 1);
  ctx.fillRect(cx + 30, cy + 16 - (tick % 2), 10, 1);
  for (const [dx, dy] of [[-30, 8], [12, -4], [40, 14]] as const) {
    ctx.fillStyle = C.leaf;
    ellipseFill(ctx, cx + dx, cy + dy, 5, 3);
    ctx.fillStyle = C.leafDark;
    ctx.fillRect(cx + dx + 3, cy + dy - 1, 1, 2);
  }
  for (const [dx, dy] of [[-84, -8], [-78, 2], [74, 6], [80, -2]] as const) {
    p(ctx, C.leaf, cx + dx, cy + dy, 2, 12);
    p(ctx, C.leafDark, cx + dx, cy + dy, 1, 6);
  }
  if (tick % 26 === 5) {
    burst(world, "drop", cx + ((tick % 3) * 20) - 20, cy - 4, 5, ["#8fd3df", "#b8e8f0"], 1.1);
  }
}

/* ── scene ────────────────────────────────────────────────── */
export interface ScenePayload {
  holdings: HoldingRow[];
  level: number;
  /** display currency symbol (from base currency) */
  currencySymbol: string;
  /** current calendar month beats the trailing average → rainbow after rain */
  monthlyBeat: boolean;
  settings: Settings;
  /** live world state (clock, weather, particles) — advanced by the caller */
  world: World;
  /** progress toward the next farm level (scaffolding near the top) */
  farmNext?: { progressPct: number };
}

let sceneTick = 0;
let lastHoldingsSig = "";

export function drawScene(
  ctx: CanvasRenderingContext2D,
  payload: ScenePayload,
  scale = 1,
): void {
  const { holdings, level, monthlyBeat, settings, world } = payload;
  const tick = sceneTick++;
  // portfolio changed (stocks added/removed)? reset per-holding state so
  // watering indexes, event history and the farmer's tour never go stale
  const sig = holdings.map((h) => h.symbol).join(",");
  if (sig !== lastHoldingsSig) {
    lastHoldingsSig = sig;
    wateredUntil.length = 0;
    prevNext.clear();
    brain = null;
  }
  const { width, height } = sceneSize(holdings);
  ctx.canvas.width = width * scale;
  ctx.canvas.height = height * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const r = rng(2024);

  paintGrass(ctx, width, height, world, tick);

  // ── house + yard ──
  const tier = (level >= 4 ? 2 : level >= 2 ? 1 : 0) as 0 | 1 | 2;
  const hw = HOUSE_W[tier];
  const aspect = assetAspect(HOUSE_KEY);
  const hh = Math.round(hw * aspect);
  const hx = width - hw - 22;
  const hy = 6;
  const gateX = hx + Math.round(hw / 2);
  const doorY = hy + hh;
  const fy = doorY + 4;
  const fieldBottom = FIELD_TOP + Math.ceil(holdings.length / COLS) * ROW_PITCH;

  // stone plaza in front of the door
  const rr = rng(tick + 5);
  for (let i = 0; i < 46; i++) {
    p(ctx, i % 3 === 0 ? C.stone : i % 3 === 1 ? C.stoneLight : C.stoneDark, gateX - 34 + Math.floor(rr() * 68), doorY + 2 + Math.floor(rr() * 16), 2, 2);
  }

  drawAsset(ctx, HOUSE_KEY, hx, hy, hw);
  fenceRun(ctx, hx - 26, fy, Math.max(12, gateX - hx - 10));
  fenceRun(ctx, gateX + 14, fy, Math.max(12, hx + hw + 26 - gateX - 14));
  // farmer's home door (evening walk-in target)
  doorPos = { x: gateX, y: doorY + 12 };

  const mailboxToday = localStorage.getItem(`dd_mailbox_${new Date().toISOString().slice(0, 10)}`) === "1";
  drawPropSprite(ctx, "well", hx - 58, fy + 18, 44);
  drawPropSprite(ctx, "trough", hx - 6, fy + 16, 20);
  drawPropSprite(ctx, "mailbox", hx + hw + 16, fy + 16, 26, mailboxToday);
  drawPropSprite(ctx, "bed-tulip", hx + 30, fy + 18, 30);
  drawPropSprite(ctx, "bed-mixed", hx + 95, fy + 18, 30);
  drawPropSprite(ctx, "crates", hx + 4, fy + 20, 24);
  drawPropSprite(ctx, "bush", hx + hw + 40, fy + 16, 30);

  // ── path + connector ──
  const PATH_Y = FIELD_TOP - 12;
  pathSeg(ctx, STUB_X, PATH_Y, hx - 14, PATH_Y, r);
  pathSeg(ctx, hx - 14, PATH_Y, hx - 14, fy + 2, r);
  pathSeg(ctx, STUB_X, PATH_Y, STUB_X, fieldBottom + 4, r);
  for (const cx of COL_X) {
    pathSeg(ctx, cx + PLOT_W / 2, FIELD_TOP + PLOT_W + 30, cx + PLOT_W / 2, FIELD_TOP - 10, r);
  }

  // ── orchard (season-filtered trees, spread so nothing stacks) ──
  const seasonFilter =
    world.season === "autumn"
      ? "hue-rotate(-38deg) saturate(1.35) brightness(1.06)"
      : world.season === "winter"
        ? "grayscale(0.65) brightness(1.1)"
        : world.season === "spring"
          ? "saturate(1.15)"
          : "none";
  try {
    ctx.filter = seasonFilter;
  } catch { /* unsupported: draw as-is */ }
  const oak = drawAsset(ctx, "tree-oak", 24, 10, 116);
  treeShadow(ctx, 24 + oak.w / 2, 10 + oak.h, oak.w / 2.4);
  const apple = drawPropSprite(ctx, "tree-apple", 356, 144, 108, false);
  treeShadow(ctx, 356, 144, apple.w / 2.4);
  const pine = drawPropSprite(ctx, "tree-pine", 262, 104, 88, false);
  treeShadow(ctx, 262, 104, pine.w / 2.6);
  try {
    ctx.filter = "none";
  } catch { /* ignore */ }

  // ── windmill in the open meadow, tower in line with the 2nd crop row ──
  const windCells = ["wind0", "wind1", "wind2", "wind3"] as const;
  drawPropSprite(ctx, windCells[Math.floor(tick / 2) % 4], 655, FIELD_TOP + ROW_PITCH + PLOT_W, 140);

  // ── pond / meadow props (elm + the pink blossom tree live here) ──
  try {
    ctx.filter = seasonFilter;
  } catch { /* ignore */ }
  const elm = drawPropSprite(ctx, "tree-elm", 498, fieldBottom - 116, 88, false);
  treeShadow(ctx, 498, fieldBottom - 116, elm.w / 2.4);
  try {
    ctx.filter = "none";
  } catch { /* ignore */ }
  // the pink blossom tree: below the windmill, along the 3rd crop row
  // (drawn unfiltered so it stays pink through every season)
  const blossom = drawPropSprite(ctx, "tree-blossom", 620, FIELD_TOP + 2 * ROW_PITCH + 116, 118, false);
  treeShadow(ctx, 620, FIELD_TOP + 2 * ROW_PITCH + 116, blossom.w / 2.4);
  if (level >= 4) {
    drawPond(ctx, height, tick, world);
  } else {
    drawPropSprite(ctx, "haystack", 600, height - 116, 40);
    drawPropSprite(ctx, "hay-cart", 500, height - 94, 34);
  }
  drawPropSprite(ctx, "rock", 288, 132, 22);

  // ── field ──
  const maxDiv = Math.max(1, ...holdings.map((h) => h.t12mDividend));
  let goldenIdx = -1;
  holdings.forEach((h, i) => {
    if (h.growth && (goldenIdx === -1 || h.yieldPct > holdings[goldenIdx].yieldPct)) goldenIdx = i;
  });
  holdings.forEach((h, i) => {
    const px = COL_X[i % COLS];
    const py = FIELD_TOP + Math.floor(i / COLS) * ROW_PITCH;
    soilPlot(ctx, px, py, i, tick, r);
    const stage = h.growth ? h.growth.stage : h.t12mDividend > 0 ? 1 + Math.min(3, Math.round((h.t12mDividend / maxDiv) * 3)) : 0;
    const ready = h.growth?.ready ?? false;
    const golden = i === goldenIdx;
    const name = cropName(h.cropIndex);
    const windLean = stage >= 2 ? Math.round(world.wind * 1.2) : 0;
    for (let ty = 0; ty < 3; ty++) {
      for (let tx = 0; tx < 3; tx++) {
        if (golden) {
          try {
            ctx.filter = "saturate(1.6) brightness(1.18)";
          } catch { /* ignore */ }
        }
        drawCropSprite(ctx, name, stage, px + tx * TILE + 2 + (ty % 2 === 0 ? windLean : -windLean), py + ty * TILE + 30, 36);
        try {
          ctx.filter = "none";
        } catch { /* ignore */ }
        if (ready && tick % 2 === 1) {
          p(ctx, C.white, px + tx * TILE + 14, py + ty * TILE - 2, 2, 2);
          p(ctx, C.wheat, px + tx * TILE + 22, py + ty * TILE + 6, 1, 1);
        }
        if (golden && tick % 3 === 0) {
          p(ctx, "#f2a63b", px + tx * TILE + 8, py + ty * TILE + 8, 1, 1);
        }
      }
    }
    drawSign(ctx, h.symbol, `${payload.currencySymbol}${Math.round(h.t12mDividend)}/yr`, px + PLOT_W / 2, py + PLOT_W + 6);
  });

  drawPropSprite(ctx, "scarecrow", 318, FIELD_TOP + 64, 50);
  // chicken coop at the end of the gutter walkway
  drawPropSprite(ctx, "coop", 150, fieldBottom + 10, 48);

  // harvest countdown board
  const nextPayout = holdings
    .map((h) => h.growth?.nextPayout)
    .filter(Boolean)
    .sort()[0];
  if (nextPayout) {
    const days = Math.max(0, Math.round((Date.parse(`${nextPayout}T12:00:00Z`) - Date.now()) / 86400000));
    const bx = STUB_X - 46;
    const by = FIELD_TOP - 2;
    p(ctx, C.outline, bx - 2, by + 14, 6, 22);
    p(ctx, C.woodMid, bx - 1, by + 15, 4, 20);
    p(ctx, C.outline, bx - 4, by - 4, 52, 22);
    p(ctx, C.woodTan, bx - 3, by - 3, 50, 20);
    drawText(ctx, "NEXT", bx + 4, by, C.text, 1, C.outline);
    drawText(ctx, `${days}d`, bx + 12, by + 9, C.wheat, 2, C.outline);
  }

  // milestone scaffolding
  if (payload.farmNext && payload.farmNext.progressPct >= 85) {
    const sx = COL_X[2] + PLOT_W + 26;
    const sy = fieldBottom + 12;
    p(ctx, C.woodDark, sx, sy - 40, 4, 40);
    p(ctx, C.woodDark, sx + 44, sy - 40, 4, 40);
    p(ctx, C.wood, sx - 4, sy - 34, 56, 3);
    p(ctx, C.wood, sx - 4, sy - 18, 56, 3);
    p(ctx, C.woodTan, sx + 8, sy - 34, 3, 34);
    p(ctx, C.woodTan, sx + 30, sy - 34, 3, 34);
  }

  // ── scatter ──
  const blocked: Rect[] = [
    { x: hx - 34, y: hy - 14, w: hw + 68, h: hh + 34 },
    { x: 12, y: 60, w: 340, h: 100 },
    { x: 600, y: FIELD_TOP + ROW_PITCH + 2, w: 112, h: 164 },
    { x: 556, y: FIELD_TOP + 2 * ROW_PITCH + 16, w: 130, h: 156 },
    ...holdings.map((_, i) => ({
      x: COL_X[i % COLS] - 8,
      y: FIELD_TOP + Math.floor(i / COLS) * ROW_PITCH - 6,
      w: PLOT_W + 16,
      h: PLOT_W + 46,
    })),
    { x: gateX - 12, y: hy + hh - 8, w: 26, h: fieldBottom - hy - hh },
    { x: COL_X[2] + PLOT_W + 4, y: FIELD_TOP - 40, w: 34, h: 110 },
    ...(level >= 4 ? [pondRect(height)] : [{ x: 430, y: height - 220, w: 230, h: 130 }]),
  ];
  const petals = [C.pink, C.white, C.red, C.orange, C.purple];
  const placed: { x: number; y: number }[] = [];
  const want = 34 + level * 7;
  for (let n = 0; placed.length < want && n < want * 10; n++) {
    const x = 14 + Math.floor(r() * (width - 28));
    const y = 80 + Math.floor(r() * (height - 100));
    if (blocked.some((b) => near(b, x, y, 6))) continue;
    if (placed.some((q) => Math.abs(q.x - x) < 10 && Math.abs(q.y - y) < 10)) continue;
    placed.push({ x, y });
    flowerDot(ctx, x, y, petals[(x * 7 + y) % petals.length]);
    if (r() > 0.5) flowerDot(ctx, x + 7, y + 3, petals[(x + y * 3) % petals.length]);
    if (r() > 0.72) {
      p(ctx, C.stone, x + 12, y + 4, 2, 2);
      p(ctx, C.stone, x + 15, y + 6, 2, 2);
      p(ctx, C.stoneLight, x + 12, y + 4, 1, 1);
    }
  }

  // October pumpkins + winter snowman
  if (world.season === "autumn" && new Date().getMonth() === 9) {
    drawCropSprite(ctx, "pumpkin", 4, hx + hw + 8, fy + 26, 22);
    drawCropSprite(ctx, "pumpkin", 4, hx + hw + 34, fy + 28, 18);
  }
  if (world.season === "winter") {
    const smx = 556;
    const smy = height - 130;
    p(ctx, "#eef0e6", smx - 8, smy - 14, 16, 14);
    p(ctx, "#eef0e6", smx - 6, smy - 26, 12, 13);
    p(ctx, C.outline, smx - 3, smy - 21, 2, 2);
    p(ctx, C.outline, smx + 1, smy - 21, 2, 2);
    p(ctx, "#d9483b", smx - 2, smy - 17, 5, 2);
    p(ctx, C.woodDark, smx - 12, smy - 12, 5, 2);
    p(ctx, C.woodDark, smx + 8, smy - 12, 5, 2);
  }

  // ── critters ──
  // solids they steer around: manor, windmill, pond water, plot soil (inset
  // so they brush edges but never stand on crops), scarecrow, coop, yard props
  const solid: Rect[] = [    { x: hx - 12, y: hy - 6, w: hw + 24, h: hh + 12 },
    { x: 602, y: FIELD_TOP + ROW_PITCH + 6, w: 106, h: 156 },
    ...(level >= 4 ? [{ x: 532, y: height - 132, w: 136, h: 64 }] : [{ x: 560, y: height - 160, w: 90, h: 60 }]),
    ...holdings.map((_, i) => ({
      x: COL_X[i % COLS] + 4,
      y: FIELD_TOP + Math.floor(i / COLS) * ROW_PITCH + 4,
      w: PLOT_W - 8,
      h: PLOT_W - 8,
    })),
    { x: 296, y: FIELD_TOP + 16, w: 46, h: 56 },
    { x: 128, y: fieldBottom - 40, w: 46, h: 50 },
    { x: hx - 84, y: fy - 28, w: 44, h: 46 },
    { x: hx - 18, y: fy - 6, w: 22, h: 24 },
    { x: hx + 10, y: fy - 12, w: 38, h: 30 },
    { x: hx + 75, y: fy - 12, w: 38, h: 30 },
    { x: hx - 18, y: fy - 4, w: 34, h: 26 },
    { x: STUB_X - 50, y: FIELD_TOP - 6, w: 56, h: 40 },
  ];
  updateCritters(solid, width, height, level, world, holdings, tick);
  // debug hook: live critter state for the browser console
  (window as unknown as Record<string, unknown>).__dd = {
    tick,
    critters: critters!.map((c) => ({
      k: c.kind.slice(0, 2),
      x: Math.round(c.x),
      y: Math.round(c.y),
      tx: Math.round(c.tx),
      ty: Math.round(c.ty),
      p: c.pause,
      t: c.tick,
    })),
  };
  const drawn = [...critters!].sort((a, b) => a.y - b.y);
  for (const c of drawn) {
    if (c.kind === "farmer" && farmerVanished) continue; // indoors for the night
    const moving = c.pause <= 0;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#14200a";
    ellipseFill(ctx, c.x, c.y + 1, CRITTER_DEFS[c.kind].size / 3.5, 2);
    ctx.restore();
    const bob = moving && c.tick % 2 === 0 ? -1 : 0;
    drawPropSprite(ctx, critterCell(c), c.x, c.y + bob, CRITTER_DEFS[c.kind].size, c.face === -1);
    // sleep emotes
    if (c.sleep && tick % 12 < 3) spawnEmote("zzz", c.x, c.y - CRITTER_DEFS[c.kind].size - 4, 6);
  }
  for (const b of butterflies!) {
    drawPropSprite(ctx, b.tick % 2 === 0 ? "butterfly-open" : "butterfly-closed", b.x, b.y, 12);
  }
  // truffle the pig dug up
  if (truffle) {
    if (world.windT > truffle.until) truffle = null;
    else {
      p(ctx, "#6b4a2b", truffle.x - 3, truffle.y - 2, 6, 4);
      p(ctx, "#8a5c33", truffle.x - 2, truffle.y - 3, 4, 2);
      if (tick % 4 === 0) p(ctx, "#f2a63b", truffle.x + 6, truffle.y - 6, 1, 1);
    }
  }
  // crow
  if (crow) {
    const flap = tick % 2 === 0;
    p(ctx, "#20242c", crow.x - 4, crow.y - 1, 7, 3);
    p(ctx, "#20242c", crow.x - (flap ? 1 : 3), crow.y - (flap ? 4 : 2), 4, 2);
    p(ctx, "#e8a33c", crow.x + 3, crow.y, 2, 1);
  }
  // emote bubbles
  for (const e of emotes) {
    p(ctx, C.outline, e.x - 7, e.y - 12, 14, 11);
    p(ctx, "#f4f1e8", e.x - 6, e.y - 11, 12, 9);
    p(ctx, C.outline, e.x - 1, e.y, 2, 2);
    if (e.kind === "heart") {
      p(ctx, "#d9483b", e.x - 3, e.y - 10, 2, 2);
      p(ctx, "#d9483b", e.x, e.y - 10, 2, 2);
      p(ctx, "#d9483b", e.x - 2, e.y - 8, 4, 2);
      p(ctx, "#d9483b", e.x - 1, e.y - 6, 2, 1);
    } else if (e.kind === "note") {
      p(ctx, "#3a6bd9", e.x - 1, e.y - 10, 1, 6);
      p(ctx, "#3a6bd9", e.x - 2, e.y - 5, 2, 2);
      p(ctx, "#3a6bd9", e.x + 1, e.y - 11, 1, 5);
    } else if (e.kind === "alert") {
      drawText(ctx, "!", e.x - 1, e.y - 11, "#d9483b", 2);
    } else {
      drawText(ctx, "Z", e.x - 3, e.y - 11, "#8a97a6", 2);
    }
  }
  emotes = emotes.filter((e) => --e.life > 0).map((e) => ({ ...e, y: e.kind === "zzz" ? e.y - 0.2 : e.y }));
  if (egg) {
    if (world.windT > egg.until) egg = null;
    else {
      p(ctx, "#f2eee6", egg.x - 2, egg.y - 4, 4, 5);
      p(ctx, "#d9d2c2", egg.x - 2, egg.y - 1, 4, 2);
    }
  }

  // ── weathervane ──
  const vaneX = hx + Math.round(hw * 0.56);
  const vaneY = hy - 2;
  p(ctx, C.outline, vaneX, vaneY - 10, 1, 12);
  ctx.save();
  ctx.translate(vaneX, vaneY - 8);
  ctx.rotate(Math.sin(tick * 0.05) * 1.2);
  p(ctx, level >= 5 ? "#f2a63b" : "#8b8b95", -6, -1, 12, 2);
  p(ctx, level >= 5 ? "#f2a63b" : "#8b8b95", -2, -3, 4, 2);
  ctx.restore();

  // ── events ──
  for (const h of holdings) {
    if (!h.growth) continue;
    const prev = prevNext.get(h.symbol);
    if (prev && prev !== h.growth.nextPayout && h.growth.stage <= 1) {
      firework(world, hx + hw / 2, hy + 8);
      burst(world, "confetti", hx + hw / 2, hy + hh * 0.6, 18, ["#e8c547", "#d9483b", "#7bb661", "#5fb3c4"], 2);
      localStorage.setItem(`dd_mailbox_${new Date().toISOString().slice(0, 10)}`, "1");
    }
    prevNext.set(h.symbol, h.growth.nextPayout);
  }
  if (prevLevel && level > prevLevel) {
    burst(world, "confetti", width / 2, 140, 30, ["#e8c547", "#d9483b", "#7bb661", "#5fb3c4", "#c8589e"], 2.6);
  }
  prevLevel = level;

  if (world.rainJustEnded && monthlyBeat) rainbowUntil = tick + 45;
  if (tick < rainbowUntil) {
    const alpha = Math.min(0.4, (rainbowUntil - tick) / 60);
    const bands = ["#d9483b", "#e8a33c", "#e8c547", "#7bb661", "#5fb3c4", "#8a63d2"];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 4;
    bands.forEach((col) => {
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(width * 0.5, height + 40, height * 0.72 - bands.indexOf(col) * 4, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    });
    ctx.restore();
  }

  // ── particles ──
  spawnAmbient(world, width, height, tick);
  updateParticles(world, width, height);
  drawParticles(ctx, world);

  // ── atmosphere: real two-pass lighting (multiply ambient + additive lights) ──
  // ambient multiply: the scene darkens toward the time color while contrast
  // survives — never a flat black overlay.
  const amb = ambientColor(world, settings);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = amb;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";
  // additive light sources: they brighten through the darkness
  const lightA = world.nightDepth;
  if (lightA > 0.03) {
    ctx.globalCompositeOperation = "lighter";
    // moon + moonlight pool
    const mg = ctx.createRadialGradient(width * 0.42, 26, 6, width * 0.42, 26, 120);
    mg.addColorStop(0, `rgba(190, 208, 255, ${0.4 * lightA})`);
    mg.addColorStop(1, "rgba(190, 208, 255, 0)");
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, width, height);
    p(ctx, "#dfe6ff", width * 0.42 - 5, 18, 9, 9);
    p(ctx, "#aab8d8", width * 0.42 - 3, 20, 3, 3);
    // lantern at the path end (flicker)
    const flick = tick % 5 === 0 ? 0.82 : 1;
    addLight(ctx, hx - 14, fy - 8, 46, `rgba(255, 190, 105, ${0.5 * lightA * flick})`);
    // manor windows
    addLight(ctx, hx + 18, hy + hh * 0.64, 34, `rgba(255, 180, 90, ${0.45 * lightA})`);
    addLight(ctx, hx + hw - 20, hy + hh * 0.64, 34, `rgba(255, 180, 90, ${0.4 * lightA})`);
    // coop light
    addLight(ctx, 150, fieldBottom - 18, 40, `rgba(255, 200, 130, ${0.35 * lightA})`);
    ctx.globalCompositeOperation = "source-over";
  }
  const clx = ((tick * 2) % (width + 360)) - 180;
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#14200a";
  ellipseFill(ctx, clx, 200 + Math.sin(tick * 0.05) * 60, 130, 46);
  ctx.restore();
  const vg = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.42, width / 2, height / 2, Math.max(width, height) * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(8, 10, 16, 0.3)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);
}
