import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { demoPayload } from "./demo.js";
import { fetchUpstream } from "./ghostfolio.js";
import { runPayoutJob, loadDripSettings, saveDripSettings } from "./payouts.js";
import type { PortfolioPayload } from "../shared/types.js";

const PORT = Number(process.env.PORT ?? 8090);
const GHOSTFOLIO_URL = (process.env.GHOSTFOLIO_URL ?? "http://localhost:3333").replace(/\/+$/, "");
const GHOSTFOLIO_TOKEN = process.env.GHOSTFOLIO_TOKEN?.trim() ?? "";
const BASE_CURRENCY = process.env.BASE_CURRENCY?.trim() || "GBP";
const REFRESH_SECONDS = Math.max(30, Number(process.env.REFRESH_SECONDS ?? 300) || 300);
const API_KEY = process.env.DASHBOARD_API_KEY?.trim() ?? "";
const API_KEY_NOTE = API_KEY ? "api-key required" : "open (LAN)";

let cache: { payload: PortfolioPayload; fetchedAt: number } | null = null;
let lastError: string | null = null;
let inflight: Promise<PortfolioPayload> | null = null;

// single in-flight upstream fetch: concurrent requests share one refresh
function computePayload(force: boolean): Promise<PortfolioPayload> {
  const ageMs = cache ? Date.now() - cache.fetchedAt : Infinity;
  if (!force && cache && ageMs <= REFRESH_SECONDS * 1000) {
    return Promise.resolve(cache.payload);
  }
  if (!inflight) {
    inflight = (async () => {
      if (!GHOSTFOLIO_TOKEN) {
        return demoPayload(REFRESH_SECONDS, BASE_CURRENCY);
      }
      try {
        const payload = await fetchUpstream(GHOSTFOLIO_URL, GHOSTFOLIO_TOKEN, BASE_CURRENCY);
        payload.meta.refreshSeconds = REFRESH_SECONDS;
        lastError = null;
        return payload;
      } catch (err: any) {
        lastError = String(err?.message ?? err);
        console.warn(`[ghostfolio] fetch failed: ${lastError}`);
        if (cache) {
          // serve the previous good cache, flagged
          return { ...cache.payload, meta: { ...cache.payload.meta, warning: lastError } };
        }
        return demoPayload(REFRESH_SECONDS, BASE_CURRENCY, `Ghostfolio not reachable: ${lastError}`);
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight.then((payload) => {
    cache = { payload, fetchedAt: Date.now() };
    return payload;
  });
}

async function getPayload(force: boolean): Promise<PortfolioPayload> {
  const payload = await computePayload(force);
  return lastError && payload.mode === "live"
    ? { ...payload, meta: { ...payload.meta, warning: lastError } }
    : payload;
}

const app = new Hono();

// ── dividend payout auto-importer + DRIP (runs 90s after boot, then every 6h) ──
async function safePayoutJob(): Promise<void> {
  if (!GHOSTFOLIO_TOKEN) return;
  try {
    const r = await runPayoutJob(GHOSTFOLIO_URL, GHOSTFOLIO_TOKEN);
    if (r.added || r.dripped || r.errors.length) {
      console.log(`[payouts] added=${r.added} dripped=${r.dripped} errors=${r.errors.length}`);
      cache = null; // force a fresh fetch so the UI reflects new activities
    }
  } catch (err: any) {
    console.warn(`[payouts] job failed: ${String(err?.message ?? err)}`);
  }
}
setTimeout(safePayoutJob, 90 * 1000);
setInterval(safePayoutJob, 6 * 3600 * 1000);


// optional LAN gate: set DASHBOARD_API_KEY to require it on /api endpoints
// (health stays open). Off by default for trusted home networks.
if (API_KEY) {
  app.use("/api/*", async (c, next) => {
    if (c.req.path === "/api/health") return next();
    if (c.req.header("X-API-Key") === API_KEY) return next();
    return c.json({ error: "unauthorized" }, 401);
  });
}

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    version: "0.1.0",
    uptimeS: Math.round(process.uptime()),
    mode: GHOSTFOLIO_TOKEN ? "live" : "demo",
    baseCurrency: BASE_CURRENCY,
    ghostfolioUrl: GHOSTFOLIO_URL,
    tokenConfigured: Boolean(GHOSTFOLIO_TOKEN),
    refreshSeconds: REFRESH_SECONDS,
    apiGate: API_KEY_NOTE,
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

// index.html must always revalidate (hashed assets cache forever, the shell
// must not — otherwise browsers pin a stale bundle across deploys)
app.use(async (c, next) => {
  await next();
  if (c.req.path === "/" || c.req.path === "/index.html") {
    c.header("Cache-Control", "no-cache, must-revalidate");
  }
});

app.get("/api/drip-settings", (c) => c.json(loadDripSettings()));

app.post("/api/drip-settings", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean") {
    return c.json({ error: "boolean 'enabled' required" }, 400);
  }
  const cur = loadDripSettings();
  const next = {
    enabled: body.enabled as boolean,
    symbols: body.symbols && typeof body.symbols === "object" ? body.symbols : cur.symbols,
  };
  saveDripSettings(next);
  return c.json(next);
});

app.post("/api/payout-job", async (c) => {
  if (!GHOSTFOLIO_TOKEN) return c.json({ error: "no token configured" }, 400);
  try {
    return c.json(await runPayoutJob(GHOSTFOLIO_URL, GHOSTFOLIO_TOKEN));
  } catch (err: any) {
    return c.json({ error: String(err?.message ?? err) }, 500);
  }
});

// Static SPA (built client). API routes are registered first and win.
app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));

console.log(
  `[dividend-dashboard] port=${PORT} ghostfolio=${GHOSTFOLIO_URL} token=${GHOSTFOLIO_TOKEN ? "set" : "missing → demo mode"} refresh=${REFRESH_SECONDS}s`,
);

serve({ fetch: app.fetch, port: PORT });
