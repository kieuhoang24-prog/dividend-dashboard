import { useEffect, useState } from "react";
import { getHealth, getDripSettings, saveDripSettings, runPayoutJobNow, type HealthInfo, type DripSettings } from "../data/api";
import type { PortfolioPayload } from "../../shared/types";
import { ageLabel } from "../lib/format";

interface Props {
  data: PortfolioPayload;
  onRefresh: () => void;
  refreshing: boolean;
}

export function SettingsView({ data, onRefresh, refreshing }: Props) {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [drip, setDrip] = useState<DripSettings | null>(null);
  const [jobMsg, setJobMsg] = useState<string>("");

  useEffect(() => {
    getDripSettings().then(setDrip).catch(() => setDrip(null));
  }, []);

  const symbols = [...new Set((data.holdings || []).map((h) => h.symbol))];
  const toggleGlobal = async () => {
    const next: DripSettings = { enabled: !(drip?.enabled ?? false), symbols: drip?.symbols ?? {} };
    setDrip(next);
    try { setDrip(await saveDripSettings(next)); } catch { /* keep optimistic value */ }
  };
  const toggleSymbol = async (sym: string) => {
    const next: DripSettings = {
      enabled: drip?.enabled ?? false,
      symbols: { ...(drip?.symbols ?? {}), [sym]: !(drip?.symbols?.[sym] ?? true) },
    };
    setDrip(next);
    try { setDrip(await saveDripSettings(next)); } catch { /* keep optimistic value */ }
  };
  const runJob = async () => {
    setJobMsg("RUNNING…");
    try {
      const r = await runPayoutJobNow();
      setJobMsg(`added ${r.added} payout(s), dripped ${r.dripped}${r.errors.length ? `, ${r.errors.length} error(s)` : ""}`);
      onRefresh();
    } catch (e: any) {
      setJobMsg(`failed: ${e.message ?? e}`);
    }
  };

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
        <h3>COMPOUNDING (DRIP)</h3>
        <div className="kv">
          <span className="k">reinvest dividends</span>
          <span className="v">
            <button className="btn" onClick={toggleGlobal}>
              {drip?.enabled ? "ON" : "OFF"}
            </button>
          </span>
          {symbols.map((sym) => (
            <span key={sym} style={{ display: "contents" }}>
              <span className="k">{sym}</span>
              <span className="v">
                <button className="btn" onClick={() => toggleSymbol(sym)}>
                  {drip?.enabled && drip?.symbols?.[sym] !== false ? "DRIP" : "CASH"}
                </button>
              </span>
            </span>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          When a payout lands and DRIP is ON, the payout automatically buys more shares of the
          same stock at that day's price — your plots fatten and income compounds.
        </p>
        <p style={{ marginTop: 10 }}>
          <button className="btn" onClick={runJob}>RUN PAYOUT JOB NOW</button>
        </p>
        {jobMsg && <p className="hint">{jobMsg}</p>}
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
