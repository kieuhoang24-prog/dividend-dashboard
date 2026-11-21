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
const VIEW_IDS: readonly string[] = TABS.map((t) => t.id);

export function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const kiosk = params.has("kiosk");
  // ?view=holdings|schedule|stages|settings deep-links a tab (handy for HA panels)
  const [tab, setTab] = useState<TabId>(() => {
    const v = params.get("view");
    return VIEW_IDS.includes(v ?? "") ? (v as TabId) : "farm";
  });
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

  const tabs = TABS;

  return (
    <div className={`app${kiosk ? " kiosk" : ""}`}>
      <div className="income-head head-cols">
        {(() => {
          const hs = (data.holdings || []).filter((h) => h && h.growth && h.growth.nextPayout);
          let next = null, est = 0, when = "";
          if (hs.length) {
            const sorted = hs.slice().sort((a, b) => String(a.growth!.nextPayout).localeCompare(String(b.growth!.nextPayout)));
            next = sorted[0];
            const g = next.growth!;
            const dayMs = 24 * 60 * 60 * 1000;
            const today = new Date(new Date().toDateString());
            const due = new Date(g.nextPayout + "T00:00:00");
            const days = Math.round((due.getTime() - today.getTime()) / dayMs);
            // per-payout estimate: trailing-12m income spread over the payout cycle
            est = next.t12mDividend && g.cycleDays ? (next.t12mDividend * g.cycleDays) / 365 : 0;
            when = days <= 0 ? "due now" : `in ${days} day${days === 1 ? "" : "s"}`;
          }
          return (
            <div className="head-col">
              <div className="label">NEXT DIVIDEND</div>
              <div className="big">
                {next ? (
                  <>
                    {money(data, est)}
                    <span className="next-sym"> {next.symbol}</span>
                  </>
                ) : (
                  "—"
                )}
              </div>
              <div className="sub">{next ? <>on {next.growth!.nextPayout} · {when}</> : "no upcoming payouts"}</div>
            </div>
          );
        })()}
        <div className="head-col">
          <div className="label">ESTIMATED ANNUAL INCOME</div>
          <div className="big">{money(data, data.totals.annualDividend)}</div>
          <div className="sub">
            {money(data, data.totals.monthlyDividend)} / month · <b>{data.farm.name}</b>
          </div>
        </div>
      </div>

      {data.mode === "demo" && (
        <div className="banner">
          DEMO DATA — set GHOSTFOLIO_TOKEN in .env and restart to see your real portfolio.
        </div>
      )}
      {data.meta.warning && <div className="banner warn">⚠ {data.meta.warning}</div>}

      {(
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
