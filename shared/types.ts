// Shared payload contract between the Node server and the React client.

export interface HoldingGrowth {
  /** 0 seeds → 1 ball → 2 bigger → 3 near-ready → 4 ready */
  stage: number;
  /** in the payout window → sparkle */
  ready: boolean;
  /** predicted next payout date, ISO YYYY-MM-DD */
  nextPayout: string;
  /** this stock's cadence in days (median gap of its own dividend history) */
  cycleDays: number;
  /** 0..100 through the growth cycle */
  progressPct: number;
}

export interface HoldingRow {
  symbol: string;
  name: string;
  quantity: number;
  /** Market value in base currency */
  value: number;
  /** Trailing-12-month dividend income in base currency */
  t12mDividend: number;
  /** t12mDividend / value * 100 */
  yieldPct: number;
  /** 0..7 index into the client's crop palette */
  cropIndex: number;
  /** Per-stock HM growth cycle driven by this stock's own dividend dates */
  growth?: HoldingGrowth;
}

export interface DividendRow {
  symbol: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Amount in base currency */
  amount: number;
}

export interface MonthBucket {
  /** YYYY-MM */
  key: string;
  label: string;
  monthIndex: number;
  total: number;
  items: { symbol: string; amount: number }[];
}

export interface StageBand {
  min: number;
  name: string;
  perk: string;
}

export interface FarmStatus {
  level: number;
  name: string;
  bands: StageBand[];
  next: { name: string; gap: number } | null;
  progressPct: number;
}

export interface PortfolioPayload {
  mode: "live" | "demo";
  baseCurrency: string;
  currencySymbol: string;
  /** epoch ms when the payload was assembled */
  generatedAt: number;
  totals: {
    annualDividend: number;
    monthlyDividend: number;
    totalValue: number;
  };
  holdings: HoldingRow[];
  /** Dividend events, most recent ~24 months, newest first */
  dividends: DividendRow[];
  /** Last 12 calendar months, oldest first */
  calendar: MonthBucket[];
  farm: FarmStatus;
  meta: {
    refreshSeconds: number;
    /** epoch ms of the last successful upstream fetch (live mode) */
    fetchedAt: number;
    source: string;
    /** Non-fatal hint, e.g. upstream fetch failed → serving cache/demo */
    warning?: string;
  };
}

export const CROP_COUNT = 8;

/** Deterministic crop picker so every client draws the same farm. */
export function cropIndexFor(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  return h % CROP_COUNT;
}

/** Annual dividend income bands (base currency) that level the farm up. */
export const STAGE_BANDS: StageBand[] = [
  { min: 0, name: "Seedling plot", perk: "A tiny patch of hope" },
  { min: 500, name: "Sprout garden", perk: "Trees appear on the field" },
  { min: 1000, name: "Growing farm", perk: "Bigger farmhouse, more land" },
  { min: 2500, name: "Thriving estate", perk: "Fences, flowers, a pond" },
  { min: 5000, name: "Golden harvest", perk: "Golden roofs over the barns" },
];

export function farmStatusFor(annualDividend: number): FarmStatus {
  let level = 1;
  for (let i = 0; i < STAGE_BANDS.length; i++) {
    if (annualDividend >= STAGE_BANDS[i].min) level = i + 1;
  }
  const current = STAGE_BANDS[level - 1];
  const nextBand = STAGE_BANDS[level] ?? null;
  const next = nextBand ? { name: nextBand.name, gap: nextBand.min - annualDividend } : null;
  const span = nextBand ? nextBand.min - current.min : 1;
  const progressPct = nextBand
    ? Math.max(0, Math.min(100, Math.round(((annualDividend - current.min) / span) * 100)))
    : 100;
  return { level, name: current.name, bands: STAGE_BANDS, next, progressPct };
}
