import {
  CROP_COUNT,
  cropIndexFor,
  farmStatusFor,
  type DividendRow,
  type HoldingGrowth,
  type HoldingRow,
  type MonthBucket,
  type PortfolioPayload,
} from "../../shared/types.js";

export interface RawPosition {
  symbol: string;
  name: string;
  quantity: number;
  /** Market value in base currency */
  value: number;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
  CHF: "Fr",
  CNY: "¥",
  VND: "₫",
};

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? `${code.toUpperCase()} `;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function withinTrailing(dateStr: string, days: number, now: Date): boolean {
  const t = new Date(`${dateStr}T12:00:00Z`).getTime();
  return now.getTime() - t <= days * 86400000 && t <= now.getTime() + 86400000;
}

const DAY_MS = 86400000;

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY_MS);
}

function rollToBusinessDay(ms: number): number {
  const day = new Date(ms).getUTCDay();
  if (day === 6) return ms + 2 * DAY_MS; // Sat -> Mon
  if (day === 0) return ms + DAY_MS; // Sun -> Mon
  return ms;
}

/**
 * Per-stock Harvest-Moon growth cycle, driven entirely by this symbol's own
 * dividend history: seeds right after its last payout, five stages across its
 * cadence, ready (+sparkle) once the next payout approaches or is due.
 */
export function growthFor(symbol: string, events: DividendRow[], now: Date): HoldingGrowth | undefined {
  const dates = events
    .filter((e) => e.symbol === symbol)
    .map((e) => e.date)
    .sort();
  if (dates.length === 0) return undefined;
  const lastPayout = dates[dates.length - 1];
  const gaps: number[] = [];
  for (let i = Math.max(1, dates.length - 6); i < dates.length; i++) {
    gaps.push(dayDiff(dates[i - 1], dates[i]));
  }
  gaps.sort((a, b) => a - b);
  const cadence = gaps.length
    ? Math.max(20, Math.min(400, Math.round(gaps[Math.floor(gaps.length / 2)])))
    : 30; // single payout → assume monthly
  const lastMs = Date.parse(`${lastPayout}T12:00:00Z`);
  const nextMs = rollToBusinessDay(lastMs + cadence * DAY_MS);
  const nowMs = now.getTime();
  const progress = Math.max(0, Math.min(1.4, (nowMs - lastMs) / (nextMs - lastMs)));
  // Harvest Moon pacing: spend real time tiny — seeds/sprouts early, ripe
  // only once the payout window opens
  const stage =
    progress < 0.15 ? 0 : progress < 0.38 ? 1 : progress < 0.62 ? 2 : progress < 0.85 ? 3 : 4;
  const ready = progress >= 0.85;
  return {
    stage,
    ready,
    nextPayout: new Date(Math.max(nowMs, nextMs)).toISOString().slice(0, 10),
    cycleDays: cadence,
    progressPct: Math.round(Math.min(progress, 1) * 100),
  };
}

/**
 * Assemble the client payload from positions + dividend events.
 * `events` carry amounts already converted to the base currency.
 */
export function buildPayload(opts: {
  mode: "live" | "demo";
  baseCurrency: string;
  positions: RawPosition[];
  events: DividendRow[];
  meta: PortfolioPayload["meta"];
}): PortfolioPayload {
  const { mode, baseCurrency, positions, events, meta } = opts;
  const now = new Date();

  const t12BySymbol = new Map<string, number>();
  for (const e of events) {
    if (withinTrailing(e.date, 365, now)) {
      t12BySymbol.set(e.symbol, (t12BySymbol.get(e.symbol) ?? 0) + e.amount);
    }
  }

  // Assign crops with max variety: greedy pick per holding, skipping crops
  // already taken until the palette wraps (8 crops, so >8 holdings repeat).
  const usedCrops = new Set<number>();
  const holdings: HoldingRow[] = positions
    .map((p, idx) => {
      const t12 = t12BySymbol.get(p.symbol) ?? 0;
      const base = cropIndexFor(p.symbol);
      let crop = 0;
      for (let attempt = 0; attempt < CROP_COUNT; attempt++) {
        const candidate = (base + idx + attempt) % CROP_COUNT;
        if (!usedCrops.has(candidate)) {
          crop = candidate;
          break;
        }
      }
      usedCrops.add(crop);
      return {
        symbol: p.symbol,
        name: p.name,
        quantity: p.quantity,
        value: p.value,
        t12mDividend: Math.round(t12 * 100) / 100,
        yieldPct: p.value > 0 ? Math.round((t12 / p.value) * 1000) / 10 : 0,
        cropIndex: crop,
        growth: growthFor(p.symbol, events, now),
      };
    })
    .sort((a, b) => b.t12mDividend - a.t12mDividend || b.value - a.value);

  const annualDividend = holdings.reduce((s, h) => s + h.t12mDividend, 0);

  // Harvest calendar: the last 12 calendar months, oldest first.
  const calendar: MonthBucket[] = [];
  for (let back = 11; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    calendar.push({
      key,
      label: MONTH_NAMES[d.getMonth()],
      monthIndex: d.getMonth(),
      total: 0,
      items: [],
    });
  }
  const calByMonth = new Map(calendar.map((c) => [c.key, c]));
  for (const e of events) {
    const key = e.date.slice(0, 7);
    const bucket = calByMonth.get(key);
    if (!bucket) continue;
    bucket.total += e.amount;
    let item = bucket.items.find((i) => i.symbol === e.symbol);
    if (!item) {
      item = { symbol: e.symbol, amount: 0 };
      bucket.items.push(item);
    }
    item.amount += e.amount;
  }
  for (const b of calendar) {
    b.total = Math.round(b.total * 100) / 100;
    for (const it of b.items) it.amount = Math.round(it.amount * 100) / 100;
    b.items.sort((a, b2) => b2.amount - a.amount);
  }

  const dividends = [...events]
    .filter((e) => withinTrailing(e.date, 730, now))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const rounded = (n: number) => Math.round(n * 100) / 100;

  return {
    mode,
    baseCurrency,
    currencySymbol: currencySymbol(baseCurrency),
    generatedAt: Date.now(),
    totals: {
      annualDividend: rounded(annualDividend),
      monthlyDividend: rounded(annualDividend / 12),
      totalValue: rounded(holdings.reduce((s, h) => s + h.value, 0)),
    },
    holdings,
    dividends,
    calendar,
    farm: farmStatusFor(annualDividend),
    meta,
  };
}

export { isoDay };
