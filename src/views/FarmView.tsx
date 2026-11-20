import { useEffect, useRef, useState } from "react";
import type { PortfolioPayload } from "../../shared/types";
import { drawScene, plotRects, critterPositions, petCritter, sceneSize } from "../lib/farm";
import { loadAssets } from "../lib/assets";
import { money } from "../lib/format";
import { worldState, startAmbience, stopAmbience, type World, type Settings, type Season, type Weather, type Particle, loadSettings, saveSettings } from "../lib/world";

interface Props {
  data: PortfolioPayload;
  onRefresh: () => void;
  refreshing: boolean;
}

export function FarmView({ data }: { data: PortfolioPayload }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const settingsRef = useRef<Settings>(loadSettings());
  const [settings, setSettings] = useState<Settings>(settingsRef.current);
  const [assetsReady, setAssetsReady] = useState(false);
  const [frame, setFrame] = useState(0);
  const [selected, setSelected] = useState<{ symbol: string; name: string; x: number; y: number; pct: number; daysTo: number; payingNow: boolean } | null>(null);

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
    // keep ticking even in hidden tabs; visibility change forces an instant redraw
    const id = setInterval(() => setFrame((f) => (f + 1) % 4), 700);
    const onVis = () => {
      if (!document.hidden) setFrame((f) => f + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const world = worldRef.current ?? {
      daylight: 1, nightDepth: 0, duskWarm: 0, dawnPink: 0, night: false, hour: 12,
      season: "summer" as Season, weather: "sunny" as Weather, windT: 0, wind: 0, particles: [] as Particle[], rainJustEnded: false,
    };
    worldRef.current = worldState(world, settingsRef.current);
    startAmbience(worldRef.current, settingsRef.current.sound);
    return () => {
      stopAmbience();
    };
  }, [settings.sound]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!assetsReady) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // advance the world one tick per redraw (clock, weather, particles)
    worldRef.current = worldState(worldRef.current, settingsRef.current);
    const last = data.calendar[data.calendar.length - 1];
    const avgMonthly = data.totals.annualDividend / 12;
    drawScene(
      ctx,
      {
        holdings: data.holdings,
        level: data.farm.level,
        monthlyBeat: last.total > avgMonthly,
        settings: settingsRef.current,
        world: worldRef.current!,
        farmNext: data.farm.next ? { progressPct: data.farm.progressPct } : undefined,
      },
      1,
    );
  }, [data, assetsReady, selected, settings, frame]);

  const toggle = (key: keyof Settings) => {
    const next = { ...settingsRef.current, [key]: !settingsRef.current[key] };
    settingsRef.current = next;
    saveSettings(next);
    setSettings(next);
    if (key === "sound" && worldRef.current) startAmbience(worldRef.current, next.sound);
  };

  // cinematic slow pan/zoom on the canvas element itself
  useEffect(() => {
    if (!settings.cinematic) {
      if (canvasRef.current) canvasRef.current.style.transform = "";
      return;
    }
    let t = 0;
    const id = setInterval(() => {
      t += 0.05;
      if (canvasRef.current) {
        canvasRef.current.style.transform = `scale(1.04) translate(${Math.sin(t) * 8}px, ${Math.cos(t * 0.8) * 5}px)`;
      }
    }, 120);
    return () => clearInterval(id);
  }, [settings.cinematic]);

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) * canvas.width) / rect.width;
    const sy = ((e.clientY - rect.top) * canvas.height) / rect.height;
    // critter reactions first
    for (const c of critterPositions()) {
      if (Math.hypot(c.x - sx, c.y - sy) < 30) {
        petCritter(c.kind, sx, sy);
        return;
      }
    }
    // plot details
    const rectHit = plotRects(data.holdings).find((r) => sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h);
    if (rectHit) {
      const h = data.holdings.find((x) => x.symbol === rectHit.symbol);
      if (h) {
        setSelected({
          symbol: h.symbol,
          name: h.name,
          x: rectHit.x + rectHit.w / 2,
          y: rectHit.y,
          pct: h.yieldPct,
          daysTo: h.growth
            ? Math.max(0, Math.round((Date.parse(`${h.growth.nextPayout}T12:00:00Z`) - Date.now()) / 86400000))
            : 0,
          payingNow: h.growth?.ready ?? false,
        });
        return;
      }
    }
    setSelected(null);
  };

  const nextPayout = data.holdings
    .map((h) => h.growth?.nextPayout)
    .filter(Boolean)
    .sort()[0];

  return (
    <div>
      <div className="farm-wrap" style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          role="img"
          aria-label={`Farm plots: ${data.holdings.map((h) => `${h.symbol} ${money(data, h.t12mDividend)} per year`).join(", ")}`}
        />
        {selected && (
          <div
            className="plot-panel"
            style={{
              left: `${(selected.x / sceneSize(data.holdings).width) * 100}%`,
              top: `${(selected.y / sceneSize(data.holdings).height) * 100}%`,
            }}
          >
            <b>{selected.symbol}</b> · {selected.name}
            <br />
            yield {selected.pct.toFixed(1)}% ·{" "}
            {selected.payingNow
              ? "paying now"
              : `pays in ${selected.daysTo}d`}
            <br />
            <button className="btn tiny" onClick={() => setSelected(null)}>CLOSE</button>
          </div>
        )}
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
        <div className="stat">
          <div className="v">{nextPayout ?? "—"}</div>
          <div className="k">next harvest</div>
        </div>
      </div>

      <div className="quick-toggles">
        <button className={`qt ${settings.dayNight ? "on" : ""}`} onClick={() => toggle("dayNight")}>{settings.dayNight ? "☾ DAY/NIGHT" : "☀ ALWAYS DAY"}</button>
        <button className={`qt ${settings.weather ? "on" : ""}`} onClick={() => toggle("weather")}>{settings.weather ? "☂ WEATHER" : "☂ NO WEATHER"}</button>
        <button className={`qt ${settings.sound ? "on" : ""}`} onClick={() => toggle("sound")}>{settings.sound ? "♪ SOUND ON" : "♪ SOUND OFF"}</button>
        <button className={`qt ${settings.cinematic ? "on" : ""}`} onClick={() => toggle("cinematic")}>CINEMATIC</button>
      </div>
      <p className="hint">
        Each plot is one stock on its own dividend cycle — seeds after a payout, ripe when the next
        one is due. The farmer waters and harvests on schedule; click a plot for details.
      </p>
    </div>
  );
}
