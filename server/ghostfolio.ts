import { buildPayload, type RawPosition } from "./lib/compute.js";
import type { DividendRow, PortfolioPayload } from "../shared/types.js";

const FETCH_TIMEOUT_MS = 10000;

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} from ${new URL(url).pathname}${body ? `: ${body.slice(0, 160)}` : ""}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Exchange the account security token for a short-lived JWT. */
async function getAuthToken(baseUrl: string, securityToken: string): Promise<string> {
  const json = await fetchJson(`${baseUrl}/api/v1/auth/anonymous`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: securityToken }),
  });
  const token = json?.authToken ?? json?.auth?.authToken ?? json?.token ?? (typeof json === "string" ? json : null);
  if (!token) throw new Error("auth/anonymous returned no authToken");
  return token;
}

function isCashPosition(symbol: string, assetClass?: string): boolean {
  return assetClass === "CASH" || /^CASH/i.test(symbol) || symbol === "USD" || symbol === "GBP" || symbol === "EUR";
}

/** Defensively normalize the holdings endpoint across Ghostfolio versions. */
function normalizeHoldings(raw: any): RawPosition[] {
  const root = raw?.holdings ?? raw;
  const arr: any[] = Array.isArray(root) ? root : Object.values(root ?? {});
  return arr
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      symbol: String(p.symbol ?? ""),
      name: String(p.name ?? p.symbol ?? ""),
      quantity: Number(p.quantity ?? 0) || 0,
      value: Number(p.valueInBaseCurrency ?? p.value ?? 0) || 0,
      assetClass: p.assetClass ? String(p.assetClass) : undefined,
    }))
    .filter((p) => p.symbol && !isCashPosition(p.symbol, p.assetClass) && (p.quantity > 0 || p.value > 0))
    .map(({ symbol, name, quantity, value }) => ({ symbol, name, quantity, value }));
}

/** Fallback: derive open positions from BUY/SELL activities when holdings endpoint is empty. */
function positionsFromActivities(activities: any[]): RawPosition[] {
  const bySymbol = new Map<string, { name: string; qty: number; value: number }>();
  for (const a of activities) {
    if (!a?.symbol) continue;
    const qty = Number(a.quantity ?? 0) || 0;
    const val = Number(a.valueInBaseCurrency ?? a.value ?? 0) || 0;
    const key = String(a.symbol);
    let pos = bySymbol.get(key);
    if (!pos) {
      pos = { name: String(a.symbol), qty: 0, value: 0 };
      bySymbol.set(key, pos);
    }
    if (a.type === "BUY") {
      pos.qty += qty;
      pos.value += val;
    } else if (a.type === "SELL") {
      const sold = Math.min(pos.qty, qty);
      pos.qty -= sold;
      pos.value -= pos.qty > 0 ? (pos.value / Math.max(pos.qty, 1)) * sold : val;
    }
  }
  return [...bySymbol.entries()]
    .filter(([symbol, p]) => !isCashPosition(symbol) && (p.qty > 0.0001 || p.value > 0))
    .map(([symbol, p]) => ({ symbol, name: p.name, quantity: Math.max(0, p.qty), value: Math.max(0, p.value) }));
}

export async function fetchUpstream(
  baseUrl: string,
  securityToken: string,
  baseCurrency: string,
): Promise<PortfolioPayload> {
  const auth = await getAuthToken(baseUrl, securityToken);
  const headers = { Authorization: `Bearer ${auth}` };

  const exported = await fetchJson(`${baseUrl}/api/v1/export`, { headers });
  const activities: any[] = Array.isArray(exported?.activities) ? exported.activities : [];

  let positions: RawPosition[] = [];
  try {
    const holdingsRaw = await fetchJson(`${baseUrl}/api/v1/portfolio/holdings`, { headers });
    positions = normalizeHoldings(holdingsRaw);
  } catch {
    positions = [];
  }
  if (positions.length === 0) positions = positionsFromActivities(activities);

  const events: DividendRow[] = activities
    .filter((a) => a?.type === "DIVIDEND" && a.symbol && a.date)
    .map((a) => ({
      symbol: String(a.symbol),
      date: String(a.date).slice(0, 10),
      amount: Number(a.valueInBaseCurrency ?? a.value ?? 0) || 0,
    }));

  return buildPayload({
    mode: "live",
    baseCurrency,
    positions,
    events,
    meta: { refreshSeconds: 0, fetchedAt: Date.now(), source: new URL(baseUrl).host },
  });
}
