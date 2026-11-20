import { useEffect, useRef, useState } from "react";
import type { PortfolioPayload } from "../../shared/types";
import { drawScene } from "../lib/farm";
import { loadAssets } from "../lib/assets";
import { money } from "../lib/format";

export function FarmView({ data }: { data: PortfolioPayload }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadAssets().finally(() => {
      if (alive) setAssetsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (document.hidden ? f : (f + 1) % 4)), 700);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!assetsReady) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, { holdings: data.holdings, level: data.farm.level }, 1, frame);
  }, [data, frame, assetsReady]);

  const nextPct = data.farm.next ? data.farm.progressPct : 100;
  const aria = data.holdings.map((h) => `${h.symbol} ${money(data, h.t12mDividend)} per year`).join(", ");

  return (
    <div>
      <div className="farm-wrap">
        <canvas ref={canvasRef} role="img" aria-label={`Farm plots: ${aria}`} />
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
