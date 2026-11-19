import { useEffect, useMemo, useRef } from "react";
import type { PortfolioPayload } from "../../shared/types";
import { PLOT_PX, drawScene, sceneLayout } from "../lib/farm";
import { money } from "../lib/format";

export function FarmView({ data }: { data: PortfolioPayload }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layout = useMemo(() => sceneLayout(data.holdings), [data]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawScene(ctx, data.holdings, data.farm.level, 3);
  }, [data]);

  const nextPct = data.farm.next ? data.farm.progressPct : 100;

  return (
    <div>
      <div className="farm-wrap">
        <canvas ref={canvasRef} />
        {layout.plots.map((p, i) => {
          const h = data.holdings[i];
          return (
            <div
              key={p.symbol + p.y}
              className="plot-label"
              style={{
                left: `${((p.x + PLOT_PX / 2) / layout.width) * 100}%`,
                top: `${((p.y + PLOT_PX + 2) / layout.height) * 100}%`,
              }}
            >
              {h.symbol} <span className="amt">{money(data, h.t12mDividend)}/yr</span>
            </div>
          );
        })}
      </div>

      <div className="farm-stats">
        <div className="stat">
          <div className="v">{money(data, data.totals.totalValue)}</div>
          <div className="k">portfolio value</div>
        </div>
        <div className="stat">
          <div className="v">{data.holdings.length}</div>
          <div className="k">plots (holdings)</div>
        </div>
        <div className="stat">
          <div className="v">{data.farm.name}</div>
          <div className="k">
            {data.farm.next
              ? `next: ${data.farm.next.name} · ${money(data, data.farm.next.gap)} to go`
              : "max level reached"}
          </div>
        </div>
      </div>

      {data.farm.next && (
        <div className="progress" title={`${nextPct}% to ${data.farm.next.name}`}>
          <div style={{ width: `${nextPct}%` }} />
          <div className="p-label">
            {nextPct}% → {data.farm.next.name}
          </div>
        </div>
      )}

      <p className="hint">
        Each plot is one holding. The better it pays, the riper its crop grows; hit the annual
        dividend milestones and the whole farm levels up.
      </p>
    </div>
  );
}
