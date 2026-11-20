// High-resolution pixel art engine — every color from a shaded palette,
// flagships (houses, trees, pond, props) painted parametrically with a
// consistent top-left light, crops kept as hand-authored 16px grids
// stamped at 2×. All grids padded via G() so row-length typos are safe.

export const TILE = 32;

export const C = {
  outline: "#241a10",
  // grass
  gBase: "#71a845", gDark: "#57893a", gLight: "#8cc15a", gHi: "#a8d878",
  // soil
  soilDark: "#4a2f18", soil: "#6b4426", soilLight: "#8a5c33", soilFurrow: "#96683c",
  // wood
  woodDark: "#3a2617", wood: "#6b4a2b", woodMid: "#8a5a33", woodLight: "#a9744a", woodTan: "#c8935f",
  // thatch & roofs
  thatchDark: "#8a5a33", thatch: "#b07a3f", thatchLight: "#d9a45c", thatchHi: "#f2c980",
  slate: "#3a3a44", slateDark: "#2b2b33", slateLight: "#4e4e5c",
  roofRed: "#b03a2e", roofRedDark: "#7e281f", roofRedLight: "#cf5647",
  // walls
  plaster: "#e8e6df", plasterHi: "#ffffff", plasterDark: "#b9b4a8",
  barn: "#b03a2e", barnDark: "#7e281f", barnLight: "#cf5647",
  glass: "#8fd3df", glassDark: "#4d7f92",
  // plants
  leaf: "#57913f", leafMid: "#7bb661", leafHi: "#a5d878", leafDark: "#3a6b2a",
  trunk: "#5b3a1f", trunkLight: "#7a5230", trunkDark: "#3f2915",
  // crops
  wheat: "#e8c547", wheatDark: "#c9a233", wheatHi: "#f6e89a",
  orange: "#e07b2e", orangeDark: "#a8541f", orangeLight: "#f2a56c",
  red: "#d9483b", redDark: "#9c2c22", redLight: "#ef7f6f",
  purple: "#8a63d2", purpleDark: "#5d3f96", purpleLight: "#b58ae8",
  pink: "#c8589e", pinkDark: "#a13d7c", pinkLight: "#e48fc0",
  // water & stone
  water: "#3e8fb3", waterLight: "#7fc9e0", waterHi: "#b8e8f0",
  stone: "#8b8b95", stoneDark: "#4a4a55", stoneLight: "#b0b0ba",
  sand: "#d9c27a", rope: "#c8935f",
  white: "#eef0e6", smoke: "#cfd3d8", smokeDark: "#aeb4bb",
  chicken: "#f2eee6", comb: "#d9483b", beak: "#e8a33c",
  text: "#f7e9b8",
};

/* ── primitives ───────────────────────────────────────────── */

function p(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function ellipse(ctx: CanvasRenderingContext2D, color: string, cx: number, cy: number, rx: number, ry: number): void {
  for (let dy = -ry; dy <= ry; dy++) {
    const t = 1 - (dy / (ry + 0.5)) ** 2;
    if (t <= 0) continue;
    const w = Math.max(1, Math.round(rx * Math.sqrt(t)));
    p(ctx, color, cx - w, cy + dy, w * 2 + 1, 1);
  }
}

function shadowBlob(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry = 3): void {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ellipse(ctx, "#14200a", cx, cy, rx, ry);
  ctx.restore();
}

/* ── grids (crops + tiny props) ───────────────────────────── */

export function G(...rows: string[]): string[] {
  const width = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(width, "."));
}

const PAL: Record<string, string> = {
  k: C.outline, g: C.leafMid, G: C.leaf, h: C.leafHi, b: C.wood, B: C.soil,
  f: C.soilLight, y: C.wheat, o: C.orange, O: C.orangeDark, r: C.red,
  p: C.pink, u: C.purple, w: C.white, s: C.stone, d: C.stoneDark,
  t: C.glass, c: C.waterLight, Y: C.thatchLight, W: C.plaster, M: C.woodLight,
  R: C.barn, N: C.woodMid, e: C.sand,
};

export function stamp(
  ctx: CanvasRenderingContext2D,
  grid: string[],
  x: number,
  y: number,
  px = 1,
  map?: Record<string, string>,
): void {
  for (let row = 0; row < grid.length; row++) {
    const line = grid[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === ".") continue;
      const color = map?.[ch] ?? PAL[ch] ?? C.outline;
      p(ctx, color, x + col * px, y + row * px, px, px);
    }
  }
}

export function stampSize(grid: string[]): { w: number; h: number } {
  return { w: grid[0].length, h: grid.length };
}

/* ── pixel font (scale-aware) ─────────────────────────────── */
const FONT: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"], D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "###", "#..", "###"], F: ["###", "#..", "###", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"], J: ["..#", "..#", "..#", "#.#", "##."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"], N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  O: ["###", "#.#", "#.#", "#.#", "###"], P: ["###", "#.#", "###", "#..", "#.."],
  Q: ["###", "#.#", "#.#", "###", "..#"], R: ["###", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".##", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"], V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"],
  "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", ".#.", "#..", "###"], "3": ["###", "..#", ".#.", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", ".##", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"], "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"], "9": ["###", "#.#", "###", "..#", "###"],
  "/": ["...", "..#", ".#.", "#..", "..."], ".": ["...", "...", "...", "...", ".#."],
  "-": ["...", "...", "###", "...", "..."], ":": ["...", ".#.", "...", ".#.", "..."],
  "£": [".##", "#..", "###", "#..", "###"], " ": ["...", "...", "...", "...", "..."],
};

export function textWidth(text: string, px = 1): number {
  return text.length * (4 * px) - px;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  px = 1,
  shadowColor?: string,
): void {
  if (shadowColor) drawText(ctx, text, x + px, y + px, shadowColor, px);
  for (const [ci, chRaw] of [...text].entries()) {
    const ch = chRaw.toUpperCase();
    const glyph = FONT[ch] ?? ["###", "#..", "###", "#..", "###"];
    const gx = x + ci * 4 * px;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (glyph[r][c] === "#") p(ctx, color, gx + c * px, y + r * px, px, px);
      }
    }
  }
}

/* ── crops: 16px grids, stamped at 2× ─────────────────────── */
export const CROP_NAMES = ["wheat", "carrot", "pumpkin", "tomato", "corn", "potato", "berry", "tulip"] as const;
export const CROP_COLORS = ["#e8c547", "#e07b2e", "#c9631f", "#d9483b", "#e8c547", "#4e8c3c", "#8a63d2", "#c8589e"];

const STAGE_SEED = G(
  "................", "................", "................", "................",
  "................", "................", "................", "................",
  "......kssk......", ".....kbbbbk.....", "....kbbfbbbk....", "...kbbbfbbbbk...",
  "..kbbffbbbbfbk..", "..kbbbbbbbfbbk..", "..kbbbbbbbbbck..", "...kkkkkkkkkk...",
);
const STAGE_SPROUT = G(
  "................", "................", "................", "......gh........",
  ".....ghhg.......", "....g..gg..g.h..", "...k..gggk.g.h..", "...k..gggk.gg...",
  "......kbbk......", "......kbbk......", "......kbbk......", ".....kNbbNk.....",
  "....kNBBBBNk....", "....kBBBBBBk....", ".....kkkkkk.....", "................",
);
const STAGE_BROAD = G(
  "................", "......kk........", ".....kGggk......", "....kGhhhGk.....",
  "...kgghhhhGk....", "..kgghhghhggk...", ".kggghghghghgk..", ".kghghghhghhgk..",
  ".kgghghhghghgk..", "..kgghghhhggk...", "...kgggggggk....", "....kggGggk.....",
  "....kbBbbBbk....", "....kBBBbBBk....", ".....kkkkkk.....", "................",
);
const STAGE_GRASS = G(
  "................", "....g..g..g.....", "...gh.ggh.gg....", "...gh.gGh.gg....",
  "..ggh.ggh.ggh...", "..gghkGghkggh...", "..gGhgghghGgg...", "...kgggggggk....",
  "....kgggggk.....", "....kbbbbbkk....", "....kbbbbbkk....", "...kNbbbbbNk....",
  "...kNBbbbBNk....", "....kBBBBBk.....", ".....kkkkkk.....", "................",
);
const STAGE_FROND = G(
  "................", "..g..g..g...g...", ".gh.ggh.g..gh...", ".gh.ggh.g..gh.g.",
  ".gGhghGhghgGhgh.", "..kghghghghgk...", "...kgggggggk....", "....kgggggk.....",
  ".....kgggk......", "......kbk.......", "......kbk.......", ".....kbbbk......",
  "....kNBBBNk.....", "....kBBBBBk.....", ".....kkkkkk.....", "................",
);
const STAGE2_BY_CROP: Record<string, string[]> = {
  wheat: STAGE_GRASS, corn: STAGE_GRASS, carrot: STAGE_FROND, pumpkin: STAGE_BROAD,
  tomato: STAGE_BROAD, potato: STAGE_BROAD, berry: STAGE_BROAD, tulip: STAGE_BROAD,
};
const STAGE3: Record<string, string[]> = {
  wheat: G(
    ".yy..yyk...yyk..", "yyy..yyy...yyy..", "yyk..yyk...yyk..", "..g...g.....g...",
    "..g...g.....g...", "..g...g.....g...", "..g...g.....g...", ".kgk.kgk.kkgk...",
    "..kgggggggggk...", "..kgggggggggk...", ".kgGghghghGggk..", ".kggghghghgggk..",
    "..kgggggggggk...", "..kNBBbbbBBNk...", "..kBBBBBBBBBk...", "...kkkkkkkkkk...",
  ),
  carrot: G(
    "................", "g.g.gggg.g.g.g..", "ghghghggghghghg.", "gGhghGgGhGhGghG.",
    ".kghghghghghgk..", "..kggggggggGk...", "...kggggggGk....", "....kgggggk.....",
    ".....kbbbk......", "....kbbboobk....", "...kbbbooobbk...", "..kbbbkookbbk...",
    "..kbbbkookbbk...", "...kbbooobbk....", "....kooook......", ".....kkok.......",
  ),
  pumpkin: G(
    "................", "......kbk.......", "......kbk.......", ".....kbbbk......",
    "....kooooook....", "...koOoooOok....", "..koOooooOoook..", ".koOoooooooOook.",
    ".kooooooooooook.", ".koOoooooooOook.", "..koOooooOook...", "...koOoooOok....",
    "....kooooook....", ".....kbNbNk.....", "....kNBBBBNk....", ".....kkkkkk.....",
  ),
  tomato: G(
    "................", "......kk........", ".....kGhgk......", "....kgggggk.....",
    "...kggrggggk....", "..kgggggrgggk...", ".kgggrggggrggk..", ".kgggggrggwwgk..",
    ".kgggrgggrwggk..", "..kgwwggggggk...", "...kgggggggk....", "....kgggggk.....",
    "....kbNbBNbk....", "....kBBBBBbk....", ".....kkkkkk.....", "................",
  ),
  corn: G(
    "..k.....k.......", ".kgk...kgk......", ".kggk.kggk......", ".kggkkkggk......",
    ".kggkyykkgk.....", ".kggkyykkgk.....", "kggkyyyyyykkgk..", "kggkyyyyyykkgk..",
    "kggkyyyyyykkgk..", ".kgkyyyyyykgk...", ".kgkyyyyyykgk...", ".kgkyyyyyykgk...",
    "..kkbbyybbkk....", "...kbBbbBbk.....", "...kBBbbbBk.....", "....kkkkkkk.....",
  ),
  potato: G(
    "................", "......kk........", ".....kGGGk......", "....kGggGk......",
    "...kGggggGk.....", "..kggggggggk....", ".kgGgggghggggk..", ".kgghggggggggk..",
    ".kgggghgggghggk.", "..kggggggggggk..", "...kggggggggk...", "....kgggggk.....",
    "....kbNbBNbk....", "...kBBBBBBBk....", "...kNBBBBBNk....", "....kkkkkkk.....",
  ),
  berry: G(
    "................", "......kk........", ".....kGGgk......", "....kgggggk.....",
    "...kgugggggGk...", "..kggggguugggk..", ".kguggggggugggk.", ".kgggggguuggggk.",
    ".kggguuggggwwgk.", "..kgggggggggk...", "...kgggggggk....", "....kgggggk.....",
    "....kbNbBNbk....", "....kBBBBBbk....", ".....kkkkkk.....", "................",
  ),
  tulip: G(
    "................", ".....kppk.......", "....kpWppk......", "....kpWppk......",
    "....kppppk......", ".....kppk.......", "......gg........", "..e...gg...e....",
    ".ee...gg..eee...", ".ee..kbbk..eee..", ".eee.kbbk..eee..", ".eee.kbbk..eee..",
    ".....kbbk.......", ".....kbbk.......", "....kkNkkk......", "................",
  ),
};

export function drawCrop(
  ctx: CanvasRenderingContext2D,
  crop: string,
  stage: number,
  x: number,
  y: number,
  sway = 0,
  px = 2,
): void {
  const grid =
    stage <= 0 ? STAGE_SEED
    : stage === 1 ? STAGE_SPROUT
    : stage === 2 ? STAGE2_BY_CROP[crop] ?? STAGE_BROAD
    : STAGE3[crop] ?? STAGE_BROAD;
  stamp(ctx, grid, x + sway, y, px);
}

/* ── tree ─────────────────────────────────────────────────── */
export function drawTree(ctx: CanvasRenderingContext2D, cx: number, baseY: number, sway = 0): void {
  shadowBlob(ctx, cx, baseY + 1, 14, 3);
  // trunk with root flare, light on the left
  p(ctx, C.trunkDark, cx - 4, baseY - 12, 8, 12);
  p(ctx, C.trunk, cx - 3, baseY - 12, 5, 11);
  p(ctx, C.trunkLight, cx - 3, baseY - 12, 2, 9);
  p(ctx, C.trunkDark, cx - 6, baseY - 2, 12, 2);
  p(ctx, C.outline, cx - 4, baseY - 1, 9, 1);
  // canopy: shadow base, mid, highlight cluster (light top-left)
  ellipse(ctx, C.leafDark, cx + sway, baseY - 34, 24, 19);
  ellipse(ctx, C.leaf, cx - 1 + sway, baseY - 36, 22, 17);
  ellipse(ctx, C.leafMid, cx - 5 + sway, baseY - 40, 14, 11);
  ellipse(ctx, C.leafHi, cx - 8 + sway, baseY - 44, 7, 5);
  // edge pixels for hand-drawn wobble
  p(ctx, C.leafDark, cx - 20 + sway, baseY - 30, 2, 2);
  p(ctx, C.leafDark, cx + 16 + sway, baseY - 40, 2, 2);
  p(ctx, C.leafHi, cx - 10 + sway, baseY - 50, 3, 1);
}

export function drawBush(ctx: CanvasRenderingContext2D, cx: number, baseY: number, flowering = false, sway = 0): void {
  shadowBlob(ctx, cx, baseY + 1, 9, 2);
  ellipse(ctx, C.leafDark, cx + sway, baseY - 5, 11, 7);
  ellipse(ctx, C.leaf, cx - 1 + sway, baseY - 6, 9, 6);
  ellipse(ctx, C.leafHi, cx - 3 + sway, baseY - 8, 5, 3);
  if (flowering) {
    p(ctx, C.pink, cx - 6 + sway, baseY - 10, 2, 2);
    p(ctx, C.white, cx + 3 + sway, baseY - 8, 2, 2);
    p(ctx, C.pinkLight, cx - 1 + sway, baseY - 12, 2, 2);
  }
}

export function drawRock(ctx: CanvasRenderingContext2D, cx: number, baseY: number, big = false): void {
  const s = big ? 1.4 : 1;
  shadowBlob(ctx, cx, baseY + 1, 8 * s, 2);
  ellipse(ctx, C.stoneDark, cx, baseY - 3 * s, 7 * s, 4 * s);
  ellipse(ctx, C.stone, cx - 1, baseY - 4 * s, 6 * s, 3 * s);
  ellipse(ctx, C.stoneLight, cx - 2, baseY - 5 * s, 3 * s, 2 * s);
}

/* ── houses (parametric, shaded) ──────────────────────────── */
export interface HouseSpec { tier: 0 | 1 | 2; gold?: boolean }
export interface HouseInfo { w: number; h: number; doorX: number; doorY: number; chimney: { x: number; y: number } | null }

const HOUSE_TIERS = [
  { w: 60, wallH: 22, roofH: 18 },
  { w: 84, wallH: 26, roofH: 20 },
  { w: 104, wallH: 30, roofH: 24 },
] as const;

function roofColors(spec: HouseSpec) {
  if (spec.tier === 2) {
    return spec.gold
      ? { base: C.wheat, light: C.wheatHi, dark: C.wheatDark, edge: C.outline }
      : { base: C.roofRed, light: C.roofRedLight, dark: C.roofRedDark, edge: C.outline };
  }
  return { base: C.thatch, light: C.thatchLight, dark: C.thatchDark, edge: C.outline };
}

function wallColors(spec: HouseSpec) {
  if (spec.tier === 0) return { base: C.woodLight, light: C.woodTan, dark: C.wood, line: C.woodMid };
  if (spec.tier === 1) return { base: C.barn, light: C.barnLight, dark: C.barnDark, line: C.barnDark };
  return { base: C.plaster, light: C.plasterHi, dark: C.plasterDark, line: C.plasterDark };
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, sill: boolean, flowers: boolean): void {
  p(ctx, C.outline, x - 1, y - 1, 12, 12);
  p(ctx, C.glassDark, x, y, 10, 10);
  p(ctx, C.glass, x, y, 5, 5); // light pane top-left
  p(ctx, C.outline, x + 4, y, 2, 10);
  p(ctx, C.outline, x, y + 4, 10, 2);
  if (sill) {
    p(ctx, C.woodDark, x - 2, y + 11, 14, 2);
    if (flowers) {
      p(ctx, C.red, x, y + 9, 2, 2);
      p(ctx, C.redLight, x + 4, y + 8, 2, 2);
      p(ctx, C.red, x + 8, y + 9, 2, 2);
      p(ctx, C.leaf, x - 1, y + 10, 12, 2);
      p(ctx, C.woodMid, x - 1, y + 11, 12, 3);
    }
  }
}

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  p(ctx, C.outline, x - 1, y, w + 2, h + 1);
  p(ctx, C.woodDark, x, y, w, h);
  for (let i = 2; i < w - 1; i += 3) p(ctx, C.wood, x + i, y + 1, 1, h - 2);
  p(ctx, C.woodTan, x + 1, y + 1, 1, h - 2);
  p(ctx, C.wheat, x + w - 3, y + Math.floor(h / 2), 2, 2); // knob
  p(ctx, C.stone, x - 2, y + h, w + 4, 2); // step
}

export function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number, spec: HouseSpec): HouseInfo {
  const t = HOUSE_TIERS[spec.tier];
  const rc = roofColors(spec);
  const wc = wallColors(spec);
  const totalH = t.roofH + t.wallH + 4;
  const cx = x + t.w / 2;

  shadowBlob(ctx, cx, y + totalH + 3, t.w / 2 + 6, 4);

  // chimney (barn/manor only) — drawn first, roof overlaps its base
  let chimney: HouseInfo["chimney"] = null;
  if (spec.tier >= 1) {
    const chimX = x + Math.floor(t.w * 0.72);
    const chimTop = y - 8;
    p(ctx, C.outline, chimX - 1, chimTop - 1, 11, 16);
    for (let r = 0; r < 14; r += 3) {
      p(ctx, spec.tier === 1 ? C.barnDark : C.stoneDark, chimX, chimTop + r + 2, 9, 1);
    }
    p(ctx, spec.tier === 1 ? C.barn : C.stone, chimX, chimTop, 9, 15);
    p(ctx, spec.tier === 1 ? C.barnLight : C.stoneLight, chimX, chimTop, 2, 15);
    p(ctx, C.outline, chimX - 1, chimTop - 1, 11, 2);
    chimney = { x: chimX + 4, y: chimTop };
  }

  // roof: stepped triangle widening downward, thatch/ridge shading
  const peakW = 10;
  for (let i = 0; i < t.roofH; i++) {
    const rw = peakW + Math.round(((t.w + 12 - peakW) * i) / (t.roofH - 1));
    const rx = cx - rw / 2;
    const ry = y + i;
    p(ctx, rc.base, rx, ry, rw, 1);
    // diagonal straw streaks
    for (let sx = rx + 3 + ((i * 7) % 11); sx < rx + rw - 2; sx += 11) {
      p(ctx, rc.light, sx, ry, 4, 1);
    }
    // lit ridge top-left, shadow edge
    if (i < 3) p(ctx, rc.light, cx - 4, ry, 8, 1);
    p(ctx, C.outline, rx, ry, 1, 1);
    p(ctx, C.outline, rx + rw - 1, ry, 1, 1);
    if (i === t.roofH - 1) {
      p(ctx, rc.dark, rx, ry + 1, rw, 2); // eave shadow overhang
      p(ctx, C.outline, rx, ry + 3, rw, 1);
    }
  }

  // wall
  const wy = y + t.roofH;
  p(ctx, wc.base, x, wy, t.w, t.wallH);
  p(ctx, wc.light, x, wy, 3, t.wallH); // left light edge
  p(ctx, wc.dark, x + t.w - 3, wy, 3, t.wallH); // right shadow
  p(ctx, C.outline, x - 1, wy - 1, 1, t.wallH + 2);
  p(ctx, C.outline, x + t.w, wy - 1, 1, t.wallH + 2);
  if (spec.tier === 0) {
    for (let r = 4; r < t.wallH; r += 5) p(ctx, wc.line, x + 1, wy + r, t.w - 2, 1); // log rows
  } else if (spec.tier === 1) {
    for (let cX = x + 6; cX < x + t.w - 4; cX += 12) p(ctx, wc.line, cX, wy + 2, 1, t.wallH - 4); // barn seams
    p(ctx, C.plaster, cx - 10, wy + 2, 20, 8); // hayloft
    p(ctx, C.outline, cx - 11, wy + 1, 22, 1);
    p(ctx, C.outline, cx - 11, wy + 10, 22, 1);
    p(ctx, C.woodDark, cx - 2, wy + 3, 4, 6); // loft door
  } else {
    for (let cX = x + 8; cX < x + t.w - 4; cX += 16) p(ctx, wc.dark, cX, wy + 1, 1, t.wallH - 2); // pilasters
    p(ctx, wc.light, x + 4, wy + 1, t.w - 10, 3); // cornice light
  }

  // windows
  const flowerBoxes = spec.tier >= 1;
  drawWindow(ctx, x + 8, wy + 5, true, flowerBoxes);
  drawWindow(ctx, x + t.w - 18, wy + 5, true, flowerBoxes);
  if (spec.tier === 2) {
    drawWindow(ctx, x + 26, wy + 5, true, false);
    drawWindow(ctx, x + t.w - 36, wy + 5, true, false);
  }

  // door + step
  const dw = spec.tier === 0 ? 12 : 14;
  const dh = Math.min(t.wallH - 6, 18);
  drawDoor(ctx, Math.round(cx - dw / 2), wy + t.wallH - dh, dw, dh);

  // stone foundation
  p(ctx, C.stoneDark, x - 2, wy + t.wallH, t.w + 4, 4);
  p(ctx, C.stone, x - 1, wy + t.wallH, t.w + 2, 2);

  return {
    w: t.w, h: totalH,
    doorX: Math.round(cx), doorY: y + totalH + 2,
    chimney,
  };
}

export function drawSmoke(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  const rise = frame * 3;
  const wrap = (v: number, m: number) => ((v % m) + m) % m;
  ctx.save();
  ctx.globalAlpha = 0.75;
  const y1 = y - 4 - wrap(rise, 18);
  p(ctx, C.smokeDark, x - 2 + Math.round(Math.sin((y1 - y) / 4)), y1, 3, 3);
  const y2 = y - 4 - wrap(rise + 9, 18);
  p(ctx, C.smoke, x + 2 + Math.round(Math.sin((y2 - y) / 4)), y2, 2, 2);
  ctx.restore();
}

/* ── props ────────────────────────────────────────────────── */
export function drawFenceRun(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  p(ctx, C.woodDark, x, y + 3, w, 3); // rail
  p(ctx, C.woodTan, x, y + 3, w, 1);
  for (let px2 = x; px2 < x + w - 4; px2 += 22) {
    p(ctx, C.outline, px2, y, 6, 14);
    p(ctx, C.woodMid, px2, y + 1, 5, 12);
    p(ctx, C.woodLight, px2, y + 1, 2, 12);
  }
}

export function drawLogPile(ctx: CanvasRenderingContext2D, cx: number, baseY: number): void {
  shadowBlob(ctx, cx, baseY, 16, 3);
  for (const [row, n] of [[0, 3], [1, 2], [2, 1]] as const) {
    const y = baseY - 5 - row * 5;
    for (let i = 0; i < n; i++) {
      const lx = cx - (n - 1) * 6 + i * 12;
      ellipse(ctx, C.trunkDark, lx, y, 5, 3);
      ellipse(ctx, C.trunk, lx - 1, y - 1, 4, 2);
      p(ctx, C.woodTan, lx - 3, y - 2, 2, 1);
    }
  }
}

export function drawTrough(ctx: CanvasRenderingContext2D, cx: number, baseY: number): void {
  shadowBlob(ctx, cx, baseY + 1, 13, 2);
  p(ctx, C.outline, cx - 12, baseY - 10, 24, 9);
  p(ctx, C.woodMid, cx - 11, baseY - 9, 22, 7);
  p(ctx, C.woodLight, cx - 11, baseY - 9, 22, 2);
  p(ctx, C.water, cx - 9, baseY - 8, 18, 3);
  p(ctx, C.waterLight, cx - 6, baseY - 8, 6, 1);
  p(ctx, C.woodDark, cx - 9, baseY - 2, 3, 4);
  p(ctx, C.woodDark, cx + 6, baseY - 2, 3, 4);
}

export function drawHaystack(ctx: CanvasRenderingContext2D, cx: number, baseY: number): void {
  shadowBlob(ctx, cx, baseY + 1, 14, 3);
  for (let i = 0; i < 12; i++) {
    const w = 6 + i * 1.4;
    p(ctx, i % 3 === 0 ? C.wheatDark : C.wheat, cx - w / 2, baseY - 22 + i * 1.8, w, 2);
  }
  p(ctx, C.wheatHi, cx - 5, baseY - 18, 3, 2);
  p(ctx, C.wheatHi, cx + 1, baseY - 12, 4, 2);
}

export function drawScarecrow(ctx: CanvasRenderingContext2D, cx: number, baseY: number, sway = 0): void {
  p(ctx, C.woodDark, cx - 1, baseY - 26, 3, 26); // post
  p(ctx, C.wood, cx - 6 + sway, baseY - 20, 14, 3); // arms
  p(ctx, C.woodTan, cx - 6 + sway, baseY - 20, 14, 1);
  p(ctx, C.outline, cx - 4 + sway, baseY - 32, 9, 8); // head sack
  p(ctx, C.woodTan, cx - 3 + sway, baseY - 31, 7, 6);
  p(ctx, C.outline, cx - 1 + sway, baseY - 29, 1, 1); // eyes
  p(ctx, C.outline, cx + 2 + sway, baseY - 29, 1, 1);
  p(ctx, C.wheat, cx - 4 + sway, baseY - 33, 8, 2); // straw hat
  p(ctx, C.wheatDark, cx - 6 + sway, baseY - 31, 12, 1);
}

export function drawChicken(ctx: CanvasRenderingContext2D, cx: number, baseY: number, frame: number): void {
  const peck = frame === 1;
  shadowBlob(ctx, cx, baseY, 5, 1);
  p(ctx, C.outline, cx - 4, baseY - 7, 9, 6);
  p(ctx, C.chicken, cx - 3, baseY - 6, 7, 4);
  p(ctx, C.white, cx - 3, baseY - 4, 7, 2); // tail
  p(ctx, C.outline, cx + (peck ? 0 : 1), baseY - 10, 4, 4);
  p(ctx, C.chicken, cx + (peck ? 1 : 2), baseY - 9, 2, 2);
  p(ctx, C.comb, cx + (peck ? 1 : 2), baseY - 11, 2, 2);
  p(ctx, C.beak, cx + (peck ? 4 : 4), baseY - 8, 2, 1);
  p(ctx, C.beak, cx - 1, baseY - 1, 4, 1);
}

export function drawFlowerbed(ctx: CanvasRenderingContext2D, cx: number, baseY: number): void {
  ellipse(ctx, C.soilDark, cx, baseY - 2, 16, 5);
  ellipse(ctx, C.soil, cx, baseY - 3, 14, 4);
  const spots: [number, number, string][] = [
    [-9, -5, C.pink], [-3, -7, C.white], [3, -6, C.red], [9, -4, C.purple], [0, -3, C.orange],
  ];
  for (const [dx, dy, col] of spots) {
    p(ctx, C.leaf, cx + dx, baseY + dy + 1, 1, 2);
    p(ctx, col, cx + dx - 1, baseY + dy - 1, 3, 2);
    p(ctx, C.wheat, cx + dx, baseY + dy - 1, 1, 1);
  }
}

/* ── plot sign: hanging plank on posts, two text lines ────── */
export function drawSign(ctx: CanvasRenderingContext2D, symbol: string, amount: string, cx: number, top: number): void {
  const line1w = textWidth(symbol, 2);
  const line2w = textWidth(amount, 2);
  const w = Math.max(line1w, line2w, 24) + 10;
  const h = 24;
  const x = Math.round(cx - w / 2);
  // posts
  p(ctx, C.outline, x - 3, top, 6, 17);
  p(ctx, C.woodMid, x - 2, top, 4, 16);
  p(ctx, C.woodLight, x - 2, top, 2, 16);
  p(ctx, C.outline, x + w - 3, top, 6, 17);
  p(ctx, C.woodMid, x + w - 2, top, 4, 16);
  p(ctx, C.woodLight, x + w - 2, top, 2, 16);
  // rope loop hints
  p(ctx, C.rope, x - 1, top, 2, 2);
  p(ctx, C.rope, x + w - 1, top, 2, 2);
  // plank
  p(ctx, C.outline, x - 3, top + 2, w + 6, h);
  p(ctx, C.woodTan, x - 2, top + 3, w + 4, h - 2);
  p(ctx, C.woodMid, x - 2, top + h - 2, w + 4, 3);
  p(ctx, C.woodLight, x - 2, top + 3, w + 4, 2);
  // nails
  p(ctx, C.stoneDark, x, top + h / 2 - 1, 1, 1);
  p(ctx, C.stoneDark, x + w, top + h / 2 - 1, 1, 1);
  // text
  drawText(ctx, symbol, x + Math.round((w - line1w) / 2), top + 5, C.text, 2, C.outline);
  drawText(ctx, amount, x + Math.round((w - line2w) / 2), top + 16, C.wheat, 2, C.outline);
}
