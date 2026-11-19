import type { PortfolioPayload } from "../../shared/types";
import { money } from "../lib/format";

export function StagesView({ data }: { data: PortfolioPayload }) {
  return (
    <div>
      <div className="card">
        <h3>FARM STAGES</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          The farm levels up as your trailing-12-month dividend income crosses each milestone.
        </p>
        {data.farm.bands.map((band, i) => {
          const level = i + 1;
          const isCurrent = level === data.farm.level;
          const isDone = level < data.farm.level;
          return (
            <div key={band.name} className={`stage${isDone ? " done" : ""}${isCurrent ? " current" : ""}`}>
              <div className="badge">{isDone ? "✓" : isCurrent ? "▶" : level}</div>
              <div>
                <div className="s-name">
                  {band.name} · {money(data, band.min)}+/yr
                </div>
                <div className="s-perk">{band.perk}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3>PROGRESS TO NEXT MILESTONE</h3>
        <div className="row">
          <span className="hint">{money(data, data.totals.annualDividend)} / yr earned</span>
          {data.farm.next && (
            <span className="hint">
              {money(data, data.farm.next.gap)} to {data.farm.next.name}
            </span>
          )}
        </div>
        <div className="progress">
          <div style={{ width: `${data.farm.progressPct}%` }} />
          <div className="p-label">{data.farm.progressPct}%</div>
        </div>
      </div>
    </div>
  );
}
