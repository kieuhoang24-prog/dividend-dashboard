// Terrain palette + text engine + plot signs. Character sprites (houses,
// trees, crops, animals, props) live in generated assets — see assets.ts.

export const TILE = 32;

export const C = {
  outline: "#241a10",
  gBase: "#71a845", gDark: "#57893a", gLight: "#8cc15a", gHi: "#a8d878",
  soilDark: "#4a2f18", soil: "#6b4426", soilLight: "#8a5c33", soilFurrow: "#96683c",
  woodDark: "#3a2617", wood: "#6b4a2b", woodMid: "#8a5a33", woodLight: "#a9744a", woodTan: "#c8935f",
  water: "#3e8fb3", waterLight: "#7fc9e0", waterHi: "#b8e8f0",
  stone: "#8b8b95", stoneDark: "#4a4a55", stoneLight: "#b0b0ba",
  sand: "#d9c27a",
  smoke: "#cfd3d8", smokeDark: "#aeb4bb",
  chicken: "#f2eee6", beak: "#e8a33c",
  text: "#f7e9b8",
  wheat: "#e8c547",
  leaf: "#57913f", leafDark: "#3a6b2a",
  red: "#d9483b", pink: "#c8589e", purple: "#8a63d2", orange: "#e07b2e", white: "#eef0e6",
};

/* ── pixel font (3×5 glyphs) ─────────────────────────────── */
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
        if (glyph[r][c] === "#") {
          ctx.fillStyle = color;
          ctx.fillRect(gx + c * px, y + r * px, px, px);
        }
      }
    }
  }
}

/* ── crop identity (index order is load-bearing: cropIndexFor mod 8) ── */
export const CROP_NAMES = ["wheat", "carrot", "pumpkin", "tomato", "corn", "potato", "berry", "tulip"] as const;

export const CROP_COLORS = ["#e8c547", "#e07b2e", "#c9631f", "#d9483b", "#e8c547", "#4e8c3c", "#8a63d2", "#c8589e"];

/* ── plot sign: big wooden plank on posts, two large text lines ── */
export function drawSign(
  ctx: CanvasRenderingContext2D,
  symbol: string,
  amount: string,
  cx: number,
  top: number,
): void {
  const line1w = textWidth(symbol, 3);
  const line2w = textWidth(amount, 3);
  const w = Math.max(line1w, line2w, 34) + 18;
  const h = 40;
  const x = Math.round(cx - w / 2);
  // posts
  ctx.fillStyle = C.soilDark;
  ctx.fillRect(x - 4, top, 8, 27);
  ctx.fillStyle = C.woodMid;
  ctx.fillRect(x - 3, top, 6, 26);
  ctx.fillStyle = C.woodLight;
  ctx.fillRect(x - 3, top, 3, 26);
  ctx.fillStyle = C.soilDark;
  ctx.fillRect(x + w - 4, top, 8, 27);
  ctx.fillStyle = C.woodMid;
  ctx.fillRect(x + w - 3, top, 6, 26);
  ctx.fillStyle = C.woodLight;
  ctx.fillRect(x + w - 3, top, 3, 26);
  // rope ties
  ctx.fillStyle = C.woodTan;
  ctx.fillRect(x - 2, top, 3, 3);
  ctx.fillRect(x + w - 1, top, 3, 3);
  // plank
  ctx.fillStyle = C.outline;
  ctx.fillRect(x - 4, top + 2, w + 8, h);
  ctx.fillStyle = C.woodTan;
  ctx.fillRect(x - 3, top + 3, w + 6, h - 2);
  ctx.fillStyle = C.woodMid;
  ctx.fillRect(x - 3, top + h - 3, w + 6, 4);
  ctx.fillStyle = C.woodLight;
  ctx.fillRect(x - 3, top + 3, w + 6, 3);
  // wood grain
  ctx.fillStyle = C.wood;
  ctx.fillRect(x, top + 14, w, 1);
  ctx.fillRect(x, top + 28, w, 1);
  // nails
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(x + 1, top + h / 2 - 1, 2, 2);
  ctx.fillRect(x + w - 3, top + h / 2 - 1, 2, 2);
  // text: ticker + price, both large
  drawText(ctx, symbol, x + Math.round((w - line1w) / 2), top + 7, C.text, 3, C.outline);
  drawText(ctx, amount, x + Math.round((w - line2w) / 2), top + 24, C.wheat, 3, C.outline);
}
