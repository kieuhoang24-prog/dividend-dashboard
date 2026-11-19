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
