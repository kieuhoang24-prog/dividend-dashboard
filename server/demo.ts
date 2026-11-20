import { buildPayload, isoDay, type RawPosition } from "./lib/compute.js";
import type { DividendRow, PortfolioPayload } from "../shared/types.js";

/**
 * Deterministic demo portfolio (~£1,222/yr dividends) so the farm renders
 * before a Ghostfolio token is wired up. Mirrors how real payers behave:
 * monthly (MAIN, O), quarterly (SCHD, KO, …), semi-annual-ish (PG).
 */
interface DemoSeed {
  symbol: string;
  name: string;
  quantity: number;
  unitPrice: number;
  value: number;
  /** calendar month numbers (0=Jan) this payer pays out */
  payMonths: number[];
  payDay: number;
  /** amount per payout in base currency */
  perPayout: number;
}

const SEEDS: DemoSeed[] = [
  { symbol: "MAIN", name: "Main Street Capital", quantity: 130, unitPrice: 46.2, value: 6006, payMonths: [0,1,2,3,4,5,6,7,8,9,10,11], payDay: 17, perPayout: 10 },
  { symbol: "O", name: "Realty Income", quantity: 120, unitPrice: 45.8, value: 5496, payMonths: [0,1,2,3,4,5,6,7,8,9,10,11], payDay: 20, perPayout: 12 },
  { symbol: "SCHD", name: "Schwab U.S. Dividend Equity ETF", quantity: 150, unitPrice: 29.0, value: 4350, payMonths: [0,3,6,9], payDay: 25, perPayout: 37 },
  { symbol: "ENB", name: "Enbridge Inc.", quantity: 300, unitPrice: 26.0, value: 7800, payMonths: [2,5,8,11], payDay: 2, perPayout: 59 },
  { symbol: "EPD", name: "Enterprise Products Partners", quantity: 250, unitPrice: 24.9, value: 6225, payMonths: [1,4,7,10], payDay: 8, perPayout: 39 },
  { symbol: "VZ", name: "Verizon Communications", quantity: 160, unitPrice: 20.0, value: 3200, payMonths: [2,5,8,11], payDay: 18, perPayout: 24 },
  { symbol: "XOM", name: "Exxon Mobil Corporation", quantity: 100, unitPrice: 45.0, value: 4500, payMonths: [1,4,7,10], payDay: 3, perPayout: 27.5 },
  { symbol: "JNJ", name: "Johnson & Johnson", quantity: 100, unitPrice: 30.0, value: 3000, payMonths: [2,5,8,11], payDay: 12, perPayout: 21 },
  { symbol: "KO", name: "Coca-Cola Company", quantity: 160, unitPrice: 15.0, value: 2400, payMonths: [1,4,7,10], payDay: 16, perPayout: 18 },
  { symbol: "PG", name: "Procter & Gamble", quantity: 65, unitPrice: 31.0, value: 2015, payMonths: [0,3,6,9], payDay: 20, perPayout: 14 },
];

export function demoPositions(): RawPosition[] {
  return SEEDS.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    quantity: s.quantity,
    value: s.value,
  }));
}

/** 24 months of payout history, deterministic (no RNG state). */
export function demoEvents(base: Date = new Date()): DividendRow[] {
  const events: DividendRow[] = [];
  for (const [ti, s] of SEEDS.entries()) {
    for (let back = 0; back < 25; back++) {
      const d = new Date(base.getFullYear(), base.getMonth() - back, s.payDay, 12);
      if (d > base) continue;
      if (!s.payMonths.includes((d.getMonth() + 12) % 12)) continue;
      const wobble = 1 + 0.05 * Math.sin(back * 2.1 + ti * 1.7);
      events.push({
        symbol: s.symbol,
        date: isoDay(d),
        amount: Math.round(s.perPayout * wobble * 100) / 100,
      });
    }
  }
  return events;
}

export function demoPayload(
  refreshSeconds: number,
  baseCurrency: string,
  warning?: string,
): PortfolioPayload {
  return buildPayload({
    mode: "demo",
    baseCurrency,
    positions: demoPositions(),
    events: demoEvents(),
    meta: {
      refreshSeconds,
      fetchedAt: Date.now(),
      source: "demo data",
      ...(warning ? { warning } : {}),
    },
  });
}
