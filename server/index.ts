import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { demoPayload } from "./demo.js";
import { fetchUpstream } from "./ghostfolio.js";
import type { PortfolioPayload } from "../shared/types.js";

const PORT = Number(process.env.PORT ?? 8090);
const GHOSTFOLIO_URL = (process.env.GHOSTFOLIO_URL ?? "http://localhost:3333").replace(/\/+$/, "");
const GHOSTFOLIO_TOKEN = process.env.GHOSTFOLIO_TOKEN?.trim() ?? "";
const BASE_CURRENCY = process.env.BASE_CURRENCY?.trim() || "GBP";
const REFRESH_SECONDS = Math.max(30, Number(process.env.REFRESH_SECONDS ?? 300) || 300);

let cache: { payload: PortfolioPayload; fetchedAt: number } | null = null;
let lastError: string | null = null;

async function getPayload(force: boolean): Promise<PortfolioPayload> {
  const ageMs = cache ? Date.now() - cache.fetchedAt : Infinity;
  const stale = force || !cache || ageMs > REFRESH_SECONDS * 1000;

  if (stale) {
    if (!GHOSTFOLIO_TOKEN) {
      cache = { payload: demoPayload(REFRESH_SECONDS, BASE_CURRENCY), fetchedAt: Date.now() };
      lastError = null;
    } else {
      try {
        const payload = await fetchUpstream(GHOSTFOLIO_URL, GHOSTFOLIO_TOKEN, BASE_CURRENCY);
        payload.meta.refreshSeconds = REFRESH_SECONDS;
        cache = { payload, fetchedAt: Date.now() };
        lastError = null;
      } catch (err: any) {
        lastError = String(err?.message ?? err);
        console.warn(`[ghostfolio] fetch failed: ${lastError}`);
        if (!cache) {
          cache = {
            payload: demoPayload(REFRESH_SECONDS, BASE_CURRENCY, `Ghostfolio not reachable: ${lastError}`),
            fetchedAt: Date.now(),
          };
        }
        // otherwise keep serving the stale cache
      }
    }
  }

  const payload = cache!.payload;
  return lastError && payload.mode === "live" ? { ...payload, meta: { ...payload.meta, warning: lastError } } : payload;
}

const app = new Hono();

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    mode: GHOSTFOLIO_TOKEN ? "live" : "demo",
    baseCurrency: BASE_CURRENCY,
    ghostfolioUrl: GHOSTFOLIO_URL,
    tokenConfigured: Boolean(GHOSTFOLIO_TOKEN),
    refreshSeconds: REFRESH_SECONDS,
    cacheAgeMs: cache ? Date.now() - cache.fetchedAt : null,
    lastError,
  }),
);

app.get("/api/portfolio", async (c) => c.json(await getPayload(false)));
app.post("/api/refresh", async (c) => c.json(await getPayload(true)));

/** Home Assistant-friendly: per-stock next payout schedule. */
app.get("/api/next-payouts", async (c) => {
  const payload = await getPayload(false);
  return c.json(
    payload.holdings
      .filter((h) => h.growth)
      .map((h) => ({
        symbol: h.symbol,
        name: h.name,
        nextPayout: h.growth!.nextPayout,
        cycleDays: h.growth!.cycleDays,
        ready: h.growth!.ready,
        stage: h.growth!.stage,
        t12mDividend: h.t12mDividend,
      })),
  );
});

// Static SPA (built client). API routes are registered first and win.
app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));

console.log(
  `[dividend-dashboard] port=${PORT} ghostfolio=${GHOSTFOLIO_URL} token=${GHOSTFOLIO_TOKEN ? "set" : "missing → demo mode"} refresh=${REFRESH_SECONDS}s`,
);

serve({ fetch: app.fetch, port: PORT });
