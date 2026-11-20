// Hand-crafted pixel art, defined entirely in code.
// Grids are strings of palette characters; G() pads rows to a rectangle, so
// a stray short row can never corrupt a sprite. Everything stamps 1 pixel
// per character; the canvas scale (x3) is what makes it crisp.

export const TILE = 16;

export const PAL: Record<string, string> = {
  k: "#17181d", // outline
  g: "#7bb661", // leaf green
  G: "#4e8c3c", // dark leaf
  h: "#a5d885", // leaf highlight
  b: "#6b4a2b", // stem / wood
  B: "#54381f", // soil dark
  f: "#7a5230", // soil light
  y: "#e8c547", // wheat yellow
  o: "#e07b2e", // orange
  O: "#a8541f", // dark orange
  r: "#d9483b", // red
  p: "#c8589e", // pink
  u: "#8a63d2", // purple
  w: "#eef0e6", // highlight white
  s: "#8b8b95", // stone light
  d: "#3a3a44", // stone dark / slate
  t: "#5fb3c4", // water
  c: "#8fd3df", // water highlight
  Y: "#f2a63b", // gold
  W: "#e8e6df", // white wall
  M: "#a9744a", // light wood
  R: "#b03a2e", // red barn wall
  N: "#8a5a33", // thatch / plank
  e: "#d9c27a", // sand / shore
};

/** Pad grid rows to equal width with transparency. */
export function G(...rows: string[]): string[] {
  const width = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(width, "."));
}

export function stamp(
  ctx: CanvasRenderingContext2D,
  grid: string[],
  x: number,
  y: number,
  map?: Record<string, string>,
  px = 1,
): void {
  for (let row = 0; row < grid.length; row++) {
    const line = grid[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === ".") continue;
      const key = map?.[ch] ?? ch;
      ctx.fillStyle = PAL[key] ?? PAL.k;
      ctx.fillRect(x + col * px, y + row * px, px, px);
    }
  }
}

export function stampSize(grid: string[]): { w: number; h: number } {
  return { w: grid[0].length, h: grid.length };
}

/* ────────────────────────────────────────────────────────────
   Pixel font: 3×5 glyphs, drawn at 1px/char.
   ──────────────────────────────────────────────────────────── */
const FONT: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "###", "#..", "###"],
  F: ["###", "#..", "###", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", "##."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  O: ["###", "#.#", "#.#", "#.#", "###"],
  P: ["###", "#.#", "###", "#..", "#.."],
  Q: ["###", "#.#", "#.#", "###", "..#"],
  R: ["###", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".##", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", ".#.", "#..", "###"],
  "3": ["###", "..#", ".#.", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", ".##", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
  "/": ["...", "..#", ".#.", "#..", "..."],
  ".": ["...", "...", "...", "...", ".#."],
  "-": ["...", "...", "###", "...", "..."],
  ":": ["...", ".#.", "...", ".#.", "..."],
  "£": [".##", "#..", "###", "#..", "###"],
  " ": ["...", "...", "...", "...", "..."],
};

export function textWidth(text: string): number {
  return text.length * 4 - 1;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
): void {
  ctx.fillStyle = color;
  for (const [ci, chRaw] of [...text].entries()) {
    const ch = chRaw.toUpperCase();
    const glyph = FONT[ch] ?? FONT["?"] ?? ["###", "#..", "###", "#..", "###"];
    const gx = x + ci * 4;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (glyph[r][c] === "#") ctx.fillRect(gx + c, y + r, 1, 1);
      }
    }
  }
}

/* ────────────────────────────────────────────────────────────
   Crops: index order is load-bearing (cropIndexFor() mod 8).
   ──────────────────────────────────────────────────────────── */
export const CROP_NAMES = ["wheat", "carrot", "pumpkin", "tomato", "corn", "potato", "berry", "tulip"] as const;

export const CROP_COLORS = ["#e8c547", "#e07b2e", "#c9631f", "#d9483b", "#e8c547", "#4e8c3c", "#8a63d2", "#c8589e"];

const STAGE_SEED = G(
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......kssk......",
  ".....kbbbbk.....",
  "....kbbfbbbk....",
  "...kbbbfbbbbk...",
  "..kbbffbbbbfbk..",
  "..kbbbbbbbfbbk..",
  "..kbbbbbbbbbck..",
  "...kkkkkkkkkk...",
);

const STAGE_SPROUT = G(
  "................",
  "................",
  "................",
  "......gh........",
  ".....ghhg.......",
  "....g..gg..g.h..",
  "...k..gggk.g.h..",
  "...k..gggk.gg...",
  "......kbbk......",
  "......kbbk......",
  "......kbbk......",
  ".....kNbbNk.....",
  "....kNBBBBNk....",
  "....kBBBBBBk....",
  ".....kkkkkk.....",
  "................",
);

const STAGE_BROAD = G(
  "................",
  "......kk........",
  ".....kGggk......",
  "....kGhhhGk.....",
  "...kgghhhhGk....",
  "..kgghhghhggk...",
  ".kggghghghghgk..",
  ".kghghghhghhgk..",
  ".kgghghhghghgk..",
  "..kgghghhhggk...",
  "...kgggggggk....",
  "....kggGggk.....",
  "....kbBbbBbk....",
  "....kBBBbBBk....",
  ".....kkkkkk.....",
  "................",
);

const STAGE_GRASS = G(
  "................",
  "....g..g..g.....",
  "...gh.ggh.gg....",
  "...gh.gGh.gg....",
  "..ggh.ggh.ggh...",
  "..gghkGghkggh...",
  "..gGhgghghGgg...",
  "...kgggggggk....",
  "....kgggggk.....",
  "....kbbbbbkk....",
  "....kbbbbbkk....",
  "...kNbbbbbNk....",
  "...kNBbbbBNk....",
  "....kBBBBBk.....",
  ".....kkkkkk.....",
  "................",
);

const STAGE_FROND = G(
  "................",
  "..g..g..g...g...",
  ".gh.ggh.g..gh...",
  ".gh.ggh.g..gh.g.",
  ".gGhghGhghgGhgh.",
  "..kghghghghgk...",
  "...kgggggggk....",
  "....kgggggk.....",
  ".....kgggk......",
  "......kbk.......",
  "......kbk.......",
  ".....kbbbk......",
  "....kNBBBNk.....",
  "....kBBBBBk.....",
  ".....kkkkkk.....",
  "................",
);

const STAGE2_BY_CROP: Record<string, string[]> = {
  wheat: STAGE_GRASS,
  corn: STAGE_GRASS,
  carrot: STAGE_FROND,
  pumpkin: STAGE_BROAD,
  tomato: STAGE_BROAD,
  potato: STAGE_BROAD,
  berry: STAGE_BROAD,
  tulip: STAGE_BROAD,
};

const STAGE3: Record<string, string[]> = {
  wheat: G(
    ".yy..yyk...yyk..",
    "yyy..yyy...yyy..",
    "yyk..yyk...yyk..",
    "..g...g.....g...",
    "..g...g.....g...",
    "..g...g.....g...",
    "..g...g.....g...",
    ".kgk.kgk.kkgk...",
    "..kgggggggggk...",
    "..kgggggggggk...",
    ".kgGghghghGggk..",
    ".kggghghghgggk..",
    "..kgggggggggk...",
    "..kNBBbbbBBNk...",
    "..kBBBBBBBBBk...",
    "...kkkkkkkkkk...",
  ),
  carrot: G(
    "................",
    "g.g.gggg.g.g.g..",
    "ghghghggghghghg.",
    "gGhghGgGhGhGghG.",
    ".kghghghghghgk..",
    "..kggggggggGk...",
    "...kggggggGk....",
    "....kgggggk.....",
    ".....kbbbk......",
    "....kbbboobk....",
    "...kbbbooobbk...",
    "..kbbbkookbbk...",
    "..kbbbkookbbk...",
    "...kbbooobbk....",
    "....kooook......",
    ".....kkok.......",
  ),
  pumpkin: G(
    "................",
    "......kbk.......",
    "......kbk.......",
    ".....kbbbk......",
    "....kooooook....",
    "...koOoooOok....",
    "..koOooooOoook..",
    ".koOoooooooOook.",
    ".kooooooooooook.",
    ".koOoooooooOook.",
    "..koOooooOook...",
    "...koOoooOok....",
    "....kooooook....",
    ".....kbNbNk.....",
    "....kNBBBBNk....",
    ".....kkkkkk.....",
  ),
  tomato: G(
    "................",
    "......kk........",
    ".....kGhgk......",
    "....kgggggk.....",
    "...kggrggggk....",
    "..kgggggrgggk...",
    ".kgggrggggrggk..",
    ".kgggggrggwwgk..",
    ".kgggrgggrwggk..",
    "..kgwwggggggk...",
    "...kgggggggk....",
    "....kgggggk.....",
    "....kbNbBNbk....",
    "....kBBBBBbk....",
    ".....kkkkkk.....",
    "................",
  ),
  corn: G(
    "..k.....k.......",
    ".kgk...kgk......",
    ".kggk.kggk......",
    ".kggkkkggk......",
    ".kggkyykkgk.....",
    ".kggkyykkgk.....",
    "kggkyyyyyykkgk..",
    "kggkyyyyyykkgk..",
    "kggkyyyyyykkgk..",
    ".kgkyyyyyykgk...",
    ".kgkyyyyyykgk...",
    ".kgkyyyyyykgk...",
    "..kkbbyybbkk....",
    "...kbBbbBbk.....",
    "...kBBbbbBk.....",
    "....kkkkkkk.....",
  ),
  potato: G(
    "................",
    "......kk........",
    ".....kGGGk......",
    "....kGggGk......",
    "...kGggggGk.....",
    "..kggggggggk....",
    ".kgGgggghggggk..",
    ".kgghggggggggk..",
    ".kgggghgggghggk.",
    "..kggggggggggk..",
    "...kggggggggk...",
    "....kgggggk.....",
    "....kbNbBNbk....",
    "...kBBBBBBBk....",
    "...kNBBBBBNk....",
    "....kkkkkkk.....",
  ),
  berry: G(
    "................",
    "......kk........",
    ".....kGGgk......",
    "....kgggggk.....",
    "...kgugggggGk...",
    "..kggggguugggk..",
    ".kguggggggugggk.",
    ".kgggggguuggggk.",
    ".kggguuggggwwgk.",
    "..kgggggggggk...",
    "...kgggggggk....",
    "....kgggggk.....",
    "....kbNbBNbk....",
    "....kBBBBBbk....",
    ".....kkkkkk.....",
    "................",
  ),
  tulip: G(
    "................",
    ".....kppk.......",
    "....kpWppk......",
    "....kpWppk......",
    "....kppppk......",
    ".....kppk.......",
    "......gg........",
    "..e...gg...e....",
    ".ee...gg..eee...",
    ".ee..kbbk..eee..",
    ".eee.kbbk..eee..",
    ".eee.kbbk..eee..",
    ".....kbbk.......",
    ".....kbbk.......",
    "....kkNkkk......",
    "................",
  ),
};

const STAGE3_BY_NAME = STAGE3;

export function drawCrop(
  ctx: CanvasRenderingContext2D,
  crop: string,
  stage: number,
  x: number,
  y: number,
  sway = 0,
): void {
  const grid =
    stage <= 0
      ? STAGE_SEED
      : stage === 1
        ? STAGE_SPROUT
        : stage === 2
          ? STAGE2_BY_CROP[crop] ?? STAGE_BROAD
          : STAGE3_BY_NAME[crop] ?? STAGE_BROAD;
  stamp(ctx, grid, x + sway, y);
}

/* ────────────────────────────────────────────────────────────
   Props
   ──────────────────────────────────────────────────────────── */
export const TREE_BIG = G(
  ".......kkkkkkk........",
  ".....kkGGGGGGGGkk.....",
  "...kkGGGGGGGGGGGGkk...",
  "..kGGGGgGGGGgGGGGGk...",
  ".kGGGgggggGGGGGGGGGk..",
  "kGGgggggggggGGGGGGGGk.",
  "kGGggghhggggGGGgggGGk.",
  "kGGgghhhhgggggggggggGk",
  "kGgggghhggggggGGGggggk",
  "kGggggggggggGGGGGGgggg",
  ".kGgggGGGGGGGGGGGGGk..",
  "..kGGGGGGGGGGGGGGGk...",
  "...kkGGGGGGGGGGkk.....",
  ".....kkkkkkkkkk.......",
  "........bbb...........",
  ".......kbbbk..........",
  ".......kbbbk..........",
  "......kbbbbk..........",
  "......kNbbNk..........",
  "......kNNNNk..........",
  ".......kkkk...........",
);

export const BUSH = G(
  "...kkggggkk...",
  ".kgGggghgggk..",
  "kgGgghhgggggk.",
  "kgghghggggghgk",
  ".kggggggggggk.",
  "..kgggggggk...",
  "...kbbbNbk....",
  "....kNNNk.....",
);

export const ROCK_BIG = G(
  "....kkkkkk....",
  "..kksssssskk..",
  ".kssssssssssk.",
  ".kssshhssssdk.",
  ".kssshssssddk.",
  ".kssssssssddk.",
  ".kdddddddsddk.",
  ".kkdddddddsk..",
  "..kkkkkkkkk...",
);

export const ROCK_SMALL = G(
  "..kkkk..",
  ".kssssk.",
  ".ksshsk.",
  ".kssddk.",
  ".ksdddk.",
  ".kkddsk.",
  "..kkkk..",
);

export const FLOWER = G(
  ".w.",
  "www",
  "wyw",
  ".w.",
);

export const FENCE = G(
  "................",
  "................",
  ".kbbbbbbbbbbbNk.",
  ".kNfbbbbbbbfNk..",
  ".kbbbbbbbbbbbNk.",
  "..kbbNk...kbbNk.",
  "...kbbk....bbk..",
  "...kbbk...kbbk..",
  "..kNbbNk.kNbbNk.",
  "..kkkkkk.kkkkkk.",
);

/* Houses: tier 0 cabin, 1 farmhouse (red barn), 2 manor (gold roof at level 5) */
export const HOUSE_CABIN = G(
  "..........kk........",
  ".........kddk.......",
  "........kddddk......",
  ".......kddMMddk.....",
  "......kddMMMMddk....",
  ".....kddMMMMMddk....",
  "....kddMMMMMMNddk...",
  "...kddMMMMMMMNdddk..",
  "..kkkkkkkkkkkkkkkk..",
  "..kMMMMMMMMMMMMMMk..",
  "..kMttMMMtMMMMtMMk..",
  "..kMttMMMtMMMMtMMk..",
  "..kMMMMMMkkkMMMMMk..",
  "..kMMMMMMkNkMMMMMk..",
  "..kMMMMMMkNkMMMMMk..",
  "..kMMMMMMkNkMMMMMk..",
  "..kkkkkkkkkkkkkkkk..",
);

export const HOUSE_FARM = G(
  "......kdk...........k..",
  "......kdk..........kdk.",
  "......kbk....kkkk..kbk.",
  "...kkkkkkkkkkddddkkkkkk",
  "..kdddddddddddddddddddk",
  ".kddRRRRRRRRRRRRRRRRddk",
  ".kdRRRRRRRRRRRRRRRRRddk",
  ".kdRRRRRRRRRRRRRRRRRddk",
  ".kdRRRMMRRRkkkRRRMMRRdk",
  ".kdRRRMMRRRtktRRRMMRRdk",
  ".kdRRRMMRRRkkkRRRMMRRdk",
  ".kdRRRRRRRRRkRRRRRRRRdk",
  ".kdRRRRRRRRbRRRRRRRRRdk",
  ".kdRRRRRRRRbRRRRRRRRRdk",
  ".kdRRRRRRRRbRRRRRRRRRdk",
  ".kdRRRRRRRRbRRRRRRRRRdk",
  ".kdddddddddddddddddddak",
  ".kkkkkkkkkkkkkkkkkkkkk.",
);

export const HOUSE_MANOR = G(
  "........kk........",
  ".......kRRk.......",
  "......kRRRRk......",
  ".....kRRRRRRk.....",
  "....kRRRRRRRRk....",
  "...kRRRRRRRRRRk...",
  "..kRRRRRRRRRRRRk..",
  ".kRRRRRRRRRRRRRRk.",
  ".kkkkkkkkkkkkkkkkk",
  ".kWWtWWWWttWWWWtWk",
  ".kWWtWWWWttWWWWtWk",
  ".kWWWWWWWkkWWWWWWk",
  ".kWWWWWWWbbWWWWWWk",
  ".kWWWWWWWbbWWWWWWk",
  ".kWWWWWWWbbWWWWWWk",
  ".kWWWWWWWbbWWWWWWk",
  ".kkkkkkkkkkkkkkkkk",
  ".kNBBBBBBBBBBBBBNk",
  ".kkkkkkkkkkkkkkkkk",
);

/** Manor roof char swaps between red (tier 2) and gold (tier 2 + level 5). */
export const GOLD_ROOF_MAP: Record<string, string> = { R: "Y" };

/* Smoke puffs above the chimney, alternate per animation frame. */
export function drawSmoke(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  ctx.fillStyle = "#cfd3d8";
  if (frame === 0) {
    ctx.fillRect(x + 1, y - 4, 2, 2);
    ctx.fillRect(x - 1, y - 8, 2, 2);
  } else {
    ctx.fillRect(x + 2, y - 5, 2, 2);
    ctx.fillRect(x, y - 9, 2, 2);
  }
}

/* ────────────────────────────────────────────────────────────
   Plot sign: plank + post, two centered text lines.
   ──────────────────────────────────────────────────────────── */
export function drawSign(
  ctx: CanvasRenderingContext2D,
  symbol: string,
  amount: string,
  cx: number,
  top: number,
): void {
  const line1w = textWidth(symbol);
  const line2w = textWidth(amount);
  const w = Math.max(line1w, line2w, 20) + 6;
  const h = 14;
  const x = Math.round(cx - w / 2);

  // post
  ctx.fillStyle = PAL.B;
  ctx.fillRect(cx - 1, top + h, 2, 7);
  ctx.fillStyle = PAL.k;
  ctx.fillRect(cx - 1, top + h, 1, 7);

  // plank
  ctx.fillStyle = PAL.k;
  ctx.fillRect(x - 1, top - 1, w + 2, h + 2);
  ctx.fillStyle = PAL.N;
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = PAL.b;
  ctx.fillRect(x, top + 4, w, 1);
  ctx.fillRect(x, top + 9, w, 1);

  // text
  drawText(ctx, symbol, x + Math.round((w - line1w) / 2), top + 1, "#241505");
  drawText(ctx, symbol, x + Math.round((w - line1w) / 2), top, "#f7e9b8");
  drawText(ctx, amount, x + Math.round((w - line2w) / 2), top + 8, "#e8c547");
}
