import { useCallback, useEffect, useMemo, useState } from "react";
import { getPortfolio } from "./data/api";
import type { PortfolioPayload } from "../shared/types";
import { ageLabel, money } from "./lib/format";
import { FarmView } from "./views/FarmView";
import { HoldingsView } from "./views/HoldingsView";
import { ScheduleView } from "./views/ScheduleView";
import { StagesView } from "./views/StagesView";
import { SettingsView } from "./views/SettingsView";

const TABS = [
  { id: "farm", label: "FARM" },
  { id: "holdings", label: "HOLDINGS" },
  { id: "schedule", label: "SCHEDULE" },
  { id: "stages", label: "STAGES" },
  { id: "settings", label: "SETTINGS" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function App() {
  const kiosk = useMemo(() => new URLSearchParams(window.location.search).has("kiosk"), []);
  const [tab, setTab] = useState<TabId>("farm");
  const [data, setData] = useState<PortfolioPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    try {
      setRefreshing(true);
      const payload = await getPortfolio(force);
      setData(payload);
      setError(null);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pollSeconds = data?.meta.refreshSeconds ?? 300;
  useEffect(() => {
    const id = setInterval(() => load(false), Math.max(15, Math.min(3600, pollSeconds)) * 1000);
    return () => clearInterval(id);
  }, [pollSeconds, load]);

  if (!data) {
    return (
      <div className="app">
        <div className="income-head">
          <div className="pix big">…</div>
          <div className="hint">{error ? `API unreachable: ${error}` : "growing the farm…"}</div>
        </div>
      </div>
    );
  }

  const tabs = kiosk ? TABS.filter((t) => t.id !== "settings") : TABS;

  return (
    <div className={`app${kiosk ? " kiosk" : ""}`}>
      <div className="income-head">
        <div className="label">ESTIMATED ANNUAL INCOME</div>
        <div className="big">{money(data, data.totals.annualDividend)}</div>
        <div className="sub">
          {money(data, data.totals.monthlyDividend)} / month · <b>{data.farm.name}</b>
        </div>
      </div>

      {data.mode === "demo" && (
        <div className="banner">
          DEMO DATA — set GHOSTFOLIO_TOKEN in .env and restart to see your real portfolio.
        </div>
      )}
      {data.meta.warning && <div className="banner warn">⚠ {data.meta.warning}</div>}

      {!kiosk && (
        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "farm" && <FarmView data={data} />}
      {tab === "holdings" && <HoldingsView data={data} />}
      {tab === "schedule" && <ScheduleView data={data} />}
      {tab === "stages" && <StagesView data={data} />}
      {tab === "settings" && <SettingsView data={data} onRefresh={() => load(true)} refreshing={refreshing} />}

      <div className="app-footer">
        {data.mode === "demo" ? "demo data" : `ghostfolio · ${data.meta.source}`} · fetched{" "}
        {ageLabel(data.meta)}
        {kiosk ? " · kiosk" : ""}
      </div>
    </div>
  );
}
