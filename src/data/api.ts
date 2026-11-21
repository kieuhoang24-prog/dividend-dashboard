import type { PortfolioPayload } from "../../shared/types";

export interface HealthInfo {
  status: string;
  mode: "live" | "demo";
  baseCurrency: string;
  ghostfolioUrl: string;
  tokenConfigured: boolean;
  refreshSeconds: number;
  cacheAgeMs: number | null;
  lastError: string | null;
}

export async function getPortfolio(force = false): Promise<PortfolioPayload> {
  const res = await fetch(force ? "/api/refresh" : "/api/portfolio", {
    method: force ? "POST" : "GET",
  });
  if (!res.ok) throw new Error(`portfolio fetch failed: HTTP ${res.status}`);
  return res.json();
}

export async function getHealth(): Promise<HealthInfo> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`health fetch failed: HTTP ${res.status}`);
  return res.json();
}

export interface DripSettings {
  enabled: boolean;
  symbols: Record<string, boolean>;
}

export async function getDripSettings(): Promise<DripSettings> {
  const res = await fetch("/api/drip-settings");
  if (!res.ok) throw new Error(`drip settings fetch failed: HTTP ${res.status}`);
  return res.json();
}

export async function saveDripSettings(s: DripSettings): Promise<DripSettings> {
  const res = await fetch("/api/drip-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  });
  if (!res.ok) throw new Error(`drip settings save failed: HTTP ${res.status}`);
  return res.json();
}

export async function runPayoutJobNow(): Promise<{ added: number; dripped: number; errors: string[] }> {
  const res = await fetch("/api/payout-job", { method: "POST" });
  if (!res.ok) throw new Error(`payout job failed: HTTP ${res.status}`);
  return res.json();
}
