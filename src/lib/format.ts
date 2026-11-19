import type { PortfolioPayload } from "../../shared/types";

export function money(p: PortfolioPayload, n: number, digits = 0): string {
  const value = Math.round(n * 10 ** digits) / 10 ** digits;
  return `${p.currencySymbol}${value.toLocaleString("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })}`;
}

export function ageLabel(meta: PortfolioPayload["meta"]): string {
  const secs = Math.round((Date.now() - meta.fetchedAt) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  return `${Math.round(secs / 3600)}h ago`;
}
