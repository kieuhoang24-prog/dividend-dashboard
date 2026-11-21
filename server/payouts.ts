import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? "/app/data";
const DRIP_FILE = path.join(DATA_DIR, "drip.json");
const STATE_FILE = path.join(DATA_DIR, "import-state.json");
const DAY_MS = 86400000;

// Optional per-symbol ex->pay lags (days) and Yahoo scale corrections,
// supplied via env (e.g. PAYOUT_LAG_JSON={"ABC.L":21}); unknown symbols use
// the default lag below. Kept out of the repo: they are per-portfolio config.
const DEFAULT_LAG_DAYS = 14;
function parseJsonEnv(name: string): Record<string, number> {
  try {
    return JSON.parse(process.env[name] ?? "{}") ?? {};
  } catch {
    return {};
  }
}
const EX_TO_PAY_LAG: Record<string, number> = parseJsonEnv("PAYOUT_LAG_JSON");
const EX_SCALE: Record<string, number> = parseJsonEnv("PAYOUT_SCALE_JSON");

export interface DripSettings {
  enabled: boolean;
  symbols: Record<string, boolean>;
}

export function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadDripSettings(): DripSettings {
  try {
    return JSON.parse(fs.readFileSync(DRIP_FILE, "utf8"));
  } catch {
    return { enabled: false, symbols: {} };
  }
}

export function saveDripSettings(s: DripSettings): void {
  ensureDataDir();
  fs.writeFileSync(DRIP_FILE, JSON.stringify(s, null, 2));
}

function loadState(): { processed: Record<string, string[]>; drips: Record<string, string[]> } {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { processed: {}, drips: {} };
  }
}

function saveState(s: { processed: Record<string, string[]>; drips: Record<string, string[]> }): void {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

function rollBusinessDay(ms: number): number {
  const day = new Date(ms).getUTCDay();
  if (day === 6) return ms + 2 * DAY_MS; // Sat -> Mon
  if (day === 0) return ms + DAY_MS; // Sun -> Mon
  return ms;
}

function payDateFor(exIso: string, symbol: string): string {
  const lag = (EX_TO_PAY_LAG[symbol] ?? 14) * DAY_MS;
  return new Date(rollBusinessDay(Date.parse(`${exIso}T12:00:00Z`) + lag)).toISOString().slice(0, 10);
}

async function gfJson(url: string, token: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${url.split("?")[0]} -> HTTP ${res.status}`);
  return res.json();
}

async function yahooDividends(symbol: string, fromIso: string): Promise<{ date: string; amount: number }[]> {
  const p1 = Math.floor(Date.parse(`${fromIso}T00:00:00Z`) / 1000);
  const p2 = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&events=div&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`yahoo HTTP ${res.status}`);
  const j: any = await res.json();
  const divs = j?.chart?.result?.[0]?.events?.dividends ?? {};
  const scale = EX_SCALE[symbol] ?? 1;
  return Object.values(divs).map((e: any) => ({
    date: new Date(e.date * 1000).toISOString().slice(0, 10),
    amount: e.amount * scale,
  }));
}

/** Import new payouts (pay-dated, business-rolled) + DRIP buys per settings. */
export async function runPayoutJob(
  baseUrl: string,
  token: string,
): Promise<{ added: number; dripped: number; errors: string[] }> {
  const out = { added: 0, dripped: 0, errors: [] as string[] };
  // the security token is NOT valid as a Bearer on API endpoints — exchange
  // it for a JWT first (same flow the dashboard server uses)
  const authRes = await fetch(`${baseUrl}/api/v1/auth/anonymous`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: token }),
  });
  const authJson: any = await authRes.json();
  const jwt: string = authJson?.authToken ?? authJson?.token ?? "";
  if (!jwt) throw new Error("auth/anonymous returned no authToken");
  token = jwt;
  const state = loadState();
  state.processed ??= {};
  state.drips ??= {};
  const drip = loadDripSettings();

  const exportData = await gfJson(`${baseUrl}/api/v1/export`, token);
  const activities: any[] = exportData?.activities ?? [];
  const existing = new Set(
    activities.filter((a) => a?.type === "DIVIDEND").map((a) => `${a.symbol}|${String(a.date).slice(0, 10)}`),
  );

  const holdingsRaw = await gfJson(`${baseUrl}/api/v1/portfolio/holdings`, token);
  const qtyBySymbol: Record<string, { qty: number; currency: string }> = {};
  for (const h of holdingsRaw?.holdings ?? []) {
    const sym = h.symbol ?? h.assetProfile?.symbol;
    if (sym) qtyBySymbol[sym] = { qty: Number(h.quantity) || 0, currency: h.assetProfile?.currency ?? h.currency };
  }

  const symbols = new Set<string>([...Object.keys(state.processed), ...Object.keys(qtyBySymbol)]);
  for (const symbol of symbols) {
    if (!qtyBySymbol[symbol] || qtyBySymbol[symbol].qty <= 0) continue;
    state.processed[symbol] ??= [];
    let events: { date: string; amount: number }[] = [];
    try {
      events = await yahooDividends(symbol, "2026-01-01");
    } catch (e: any) {
      out.errors.push(`${symbol}: yahoo ${e.message}`);
      continue;
    }
    for (const ev of events) {
      const key = `${symbol}|${ev.date}`;
      const processed = state.processed[symbol] ?? [];
      if (existing.has(key) || processed.includes(ev.date)) continue;
      const info = qtyBySymbol[symbol];
      const payDate = payDateFor(ev.date, symbol);
      try {
        await gfJson(`${baseUrl}/api/v1/import`, token, {
          method: "POST",
          body: JSON.stringify({
            activities: [
              {
                date: payDate,
                type: "DIVIDEND",
                symbol,
                dataSource: "YAHOO",
                quantity: info.qty,
                unitPrice: ev.amount,
                currency: info.currency,
                fee: 0,
                comment: "Distribution (auto)",
              },
            ],
          }),
        });
        out.added++;
        processed.push(ev.date);
        state.processed[symbol] = processed;
        if (drip.enabled && drip.symbols[symbol] !== false) {
          const drippedList = state.drips[symbol] ?? [];
          if (!drippedList.includes(payDate)) {
            try {
              const q = await gfJson(`${baseUrl}/api/v1/symbol/YAHOO/${encodeURIComponent(symbol)}`, token);
              const price = Number(q?.marketPrice) || 0;
              const cur = q?.currency ?? info.currency;
              const amount = info.qty * ev.amount;
              const qty = price > 0 ? Math.floor((amount / price) * 10000) / 10000 : 0;
              if (qty > 0) {
                await gfJson(`${baseUrl}/api/v1/import`, token, {
                  method: "POST",
                  body: JSON.stringify({
                    activities: [
                      {
                        date: payDate,
                        type: "BUY",
                        symbol,
                        dataSource: "YAHOO",
                        quantity: qty,
                        unitPrice: price,
                        currency: cur,
                        fee: 0,
                        comment: "DRIP",
                      },
                    ],
                  }),
                });
                out.dripped++;
                drippedList.push(payDate);
                state.drips[symbol] = drippedList;
              }
            } catch (e: any) {
              out.errors.push(`${symbol}: drip ${e.message}`);
            }
          }
        }
      } catch (e: any) {
        out.errors.push(`${symbol}: ${e.message}`);
      }
    }
  }
  saveState(state);
  return out;
}
