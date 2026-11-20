import { describe, expect, it } from "vitest";
import {
  buildPayload,
  growthFor,
  type RawPosition,
} from "../server/lib/compute.js";
import {
  cropIndexFor,
  farmStatusFor,
  STAGE_BANDS,
  type DividendRow,
} from "../shared/types.js";

const NOW = new Date("2026-11-20T12:00:00Z");
const day = (offset: number) =>
  new Date(NOW.getTime() + offset * 86400000).toISOString().slice(0, 10);

function ev(symbol: string, offsetDays: number, amount = 1): DividendRow {
  return { symbol, date: day(offsetDays), amount };
}

describe("growthFor", () => {
  it("returns undefined with no dividend history", () => {
    expect(growthFor("XOM", [], NOW)).toBeUndefined();
  });

  it("single event assumes a 30-day monthly cadence", () => {
    const g = growthFor("O", [ev("O", -10)], NOW)!;
    expect(g.cycleDays).toBe(30);
    // 10 days into a 30-day cycle
    expect(g.progressPct).toBe(33);
    expect(g.stage).toBe(1); // ball
    expect(g.ready).toBe(false);
  });

  it("median gap defines the cadence across many payouts", () => {
    const events = [ev("ENB", -100), ev("ENB", -9), ev("ENB", -101), ev("ENB", -11)];
    const g = growthFor("ENB", events, NOW)!;
    // gaps: -9→-11 = 2d?? no: sorted dates ascending → gaps 2, 90, 2 → median 2 → clamped to min 20
    expect(g.cycleDays).toBe(20);
  });

  it("cadence clamps to 20..400 days", () => {
    const g = growthFor("A", [ev("A", -1), ev("A", -2), ev("A", -3)], NOW)!;
    expect(g.cycleDays).toBe(20); // same-day-ish gaps clamped up
    const g2 = growthFor("B", [ev("B", -1000), ev("B", -500)], NOW)!;
    expect(g2.cycleDays).toBe(400); // huge gap clamped down
  });

  it("stage thresholds follow the Harvest Moon curve", () => {
    // 30-day cadence, paid 2 days ago → 6% → seeds
    expect(growthFor("O", [ev("O", -2)], NOW)!.stage).toBe(0);
    // 5 days → 17% → ball
    expect(growthFor("O", [ev("O", -5)], NOW)!.stage).toBe(1);
    // 15 days → 50% → bigger
    expect(growthFor("O", [ev("O", -15)], NOW)!.stage).toBe(2);
    // 23 days → 77% → near-ready
    expect(growthFor("O", [ev("O", -23)], NOW)!.stage).toBe(3);
  });

  it("ready flips on at 85% of the cycle", () => {
    expect(growthFor("O", [ev("O", -24)], NOW)!.ready).toBe(false); // 80%
    expect(growthFor("O", [ev("O", -26)], NOW)!.ready).toBe(true); // 87%
  });

  it("overdue payouts stay ready until the next activity lands", () => {
    const g = growthFor("ENB", [ev("ENB", -100)], NOW)!; // 100d into a 92d cycle
    expect(g.stage).toBe(4);
    expect(g.ready).toBe(true);
    expect(Date.parse(g.nextPayout)).toBeLessThanOrEqual(NOW.getTime());
  });
});

describe("buildPayload", () => {
  const pos: RawPosition[] = [
    { symbol: "ENB", name: "Enbridge", quantity: 100, value: 5000 },
    { symbol: "O", name: "Realty Income", quantity: 50, value: 2500 },
  ];

  it("handles a completely empty portfolio", () => {
    const p = buildPayload({
      mode: "demo", baseCurrency: "GBP", positions: [], events: [],
      meta: { refreshSeconds: 300, fetchedAt: 0, source: "test" },
    });
    expect(p.totals).toEqual({ annualDividend: 0, monthlyDividend: 0, totalValue: 0 });
    expect(p.farm.level).toBe(1);
    expect(p.holdings).toEqual([]);
    expect(p.calendar).toHaveLength(12);
  });

  it("counts only trailing-12-month dividends", () => {
    const events = [
      ev("ENB", -100, 50), // inside 12m
      ev("ENB", -400, 999), // outside → excluded
    ];
    const p = buildPayload({
      mode: "demo", baseCurrency: "GBP",
      positions: pos.filter((x) => x.symbol === "ENB"), events,
      meta: { refreshSeconds: 300, fetchedAt: 0, source: "test" },
    });
    expect(p.holdings[0].t12mDividend).toBe(50);
  });

  it("calendar is 12 months, oldest first, with the current month last", () => {
    const p = buildPayload({
      mode: "demo", baseCurrency: "GBP", positions: [], events: [],
      meta: { refreshSeconds: 300, fetchedAt: 0, source: "test" },
    });
    expect(p.calendar).toHaveLength(12);
    const nowM = NOW.getFullYear() * 12 + NOW.getMonth();
    const first = p.calendar[0];
    const last = p.calendar[11];
    const firstM = +first.key.slice(0, 4) * 12 + (+first.key.slice(5) - 1);
    const lastM = +last.key.slice(0, 4) * 12 + (+last.key.slice(5) - 1);
    expect(lastM).toBe(nowM);
    expect(firstM).toBe(nowM - 11);
  });

  it("maps base currency to a display symbol", () => {
    const usd = buildPayload({
      mode: "demo", baseCurrency: "USD", positions: [], events: [],
      meta: { refreshSeconds: 300, fetchedAt: 0, source: "test" },
    });
    expect(usd.currencySymbol).toBe("$");
    const gbp = buildPayload({
      mode: "demo", baseCurrency: "GBP", positions: [], events: [],
      meta: { refreshSeconds: 300, fetchedAt: 0, source: "test" },
    });
    expect(gbp.currencySymbol).toBe("£");
  });

  it("assigns unique crops to the first eight holdings", () => {
    const positions: RawPosition[] = "ABCDEFGH".split("").map((s) => ({
      symbol: s, name: s, quantity: 1, value: 100,
    }));
    const p = buildPayload({
      mode: "demo", baseCurrency: "GBP", positions, events: [],
      meta: { refreshSeconds: 300, fetchedAt: 0, source: "test" },
    });
    const crops = p.holdings.map((h) => h.cropIndex);
    expect(new Set(crops).size).toBe(8);
  });
});

describe("shared helpers", () => {
  it("farm levels follow the milestone bands exactly", () => {
    expect(farmStatusFor(0).level).toBe(1);
    expect(farmStatusFor(499).level).toBe(1);
    expect(farmStatusFor(500).level).toBe(2);
    expect(farmStatusFor(2499).level).toBe(3);
    expect(farmStatusFor(2500).level).toBe(4);
    expect(farmStatusFor(9999).level).toBe(5);
    expect(farmStatusFor(5000).name).toBe("Golden harvest");
  });

  it("stage bands are monotonic", () => {
    for (let i = 1; i < STAGE_BANDS.length; i++) {
      expect(STAGE_BANDS[i].min).toBeGreaterThan(STAGE_BANDS[i - 1].min);
    }
  });

  it("crop hash is deterministic and spreads across 8 buckets", () => {
    const syms = ["ENB", "EPD", "O", "SCHD", "MAIN", "XOM", "VZ", "JNJ", "KO", "PG"];
    const seen = new Set(syms.map((s) => cropIndexFor(s)));
    expect(cropIndexFor("ENB")).toBe(cropIndexFor("ENB"));
    expect(seen.size).toBeGreaterThan(3);
  });
});
