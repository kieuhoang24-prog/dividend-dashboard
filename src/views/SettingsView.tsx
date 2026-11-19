import { useEffect, useState } from "react";
import { getHealth, type HealthInfo } from "../data/api";
import type { PortfolioPayload } from "../../shared/types";
import { ageLabel } from "../lib/format";

interface Props {
  data: PortfolioPayload;
  onRefresh: () => void;
  refreshing: boolean;
}

export function SettingsView({ data, onRefresh, refreshing }: Props) {
  const [health, setHealth] = useState<HealthInfo | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  const kioskUrl = `${window.location.origin}/?kiosk=1`;

  return (
    <div>
      <div className="card">
        <h3>CONNECTION</h3>
        {health ? (
          <div className="kv">
            <span className="k">mode</span>
            <span className={`v ${health.mode === "live" ? "ok" : ""}`}>
              {health.mode === "live" ? "live (Ghostfolio)" : "demo data"}
            </span>
            <span className="k">Ghostfolio URL</span>
            <span className="v">{health.ghostfolioUrl}</span>
            <span className="k">security token</span>
            <span className={`v ${health.tokenConfigured ? "ok" : "bad"}`}>
              {health.tokenConfigured ? "configured" : "missing → demo mode"}
            </span>
            <span className="k">base currency</span>
            <span className="v">{health.baseCurrency}</span>
            <span className="k">refresh every</span>
            <span className="v">{health.refreshSeconds}s</span>
            <span className="k">cache age</span>
            <span className="v">{health.cacheAgeMs == null ? "—" : `${Math.round(health.cacheAgeMs / 1000)}s`}</span>
            <span className="k">last upstream error</span>
            <span className={`v ${health.lastError ? "bad" : ""}`}>{health.lastError ?? "none"}</span>
          </div>
        ) : (
          <p className="hint">API health unavailable — is the server running?</p>
        )}
        <p style={{ marginTop: 14 }}>
          <button className="btn" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "REFRESHING…" : "REFRESH NOW"}
          </button>
        </p>
        <p className="hint">
          The token lives in <b>.env</b> next to docker-compose.yml (My Ghostfolio → Account →
          Security). The browser never sees it — the server holds it.
        </p>
      </div>

      <div className="card">
        <h3>DATA</h3>
        <div className="kv">
          <span className="k">holdings</span>
          <span className="v">{data.holdings.length}</span>
          <span className="k">dividend events (24m)</span>
          <span className="v">{data.dividends.length}</span>
          <span className="k">source</span>
          <span className="v">{data.meta.source}</span>
          <span className="k">fetched</span>
          <span className="v">{ageLabel(data.meta)}</span>
        </div>
      </div>

      <div className="card">
        <h3>HOME ASSISTANT</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Paste this into a Lovelace manual card (or use it as an iframe panel URL):
        </p>
        <code className="snip">{`type: iframe
title: Dividend Farm
icon: mdi:flower
url: ${kioskUrl}`}</code>
      </div>
    </div>
  );
}
