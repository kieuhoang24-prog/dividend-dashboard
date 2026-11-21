import { useEffect, useRef, useState } from "react";
import type { PortfolioPayload } from "../../shared/types";
import { drawScene, plotRects, critterPositions, petCritter, sceneSize } from "../lib/farm";
import { loadAssets } from "../lib/assets";
import { money } from "../lib/format";
import { worldState, startAmbience, stopAmbience, type World, type Settings, type Season, type Weather, type Particle, loadSettings, saveSettings } from "../lib/world";

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
        currencySymbol: data.currencySymbol,
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


  // ── auto-size + pinch/pan/zoom ──
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const minZoomRef = useRef(1);
  const [stage, setStage] = useState({ w: 720, h: 850 });
  const [view, setView] = useState({ zoom: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const clampView = (v: { zoom: number; tx: number; ty: number }): { zoom: number; tx: number; ty: number } => {
    const wrap = wrapRef.current;
    const st = stageRef.current;
    if (!wrap || !st) return v;
    // zoom floor = contain scale ("whole farm visible"); ceiling 4x detail
    const z = Math.max(minZoomRef.current, Math.min(4, v.zoom));
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const axis = (size: number, viewSize: number, t: number): number => {
      if (size * z <= viewSize) return (viewSize - size * z) / 2; // letterboxed: center
      return Math.min(0, Math.max(viewSize - size * z, t)); // larger than view: clamp pan
    };
    return { zoom: z, tx: axis(st.offsetWidth, w, v.tx), ty: axis(st.offsetHeight, h, v.ty) };
  };

  // fit the scene to the device: fill the viewport (both axes), overflow pannable
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const scene = sceneSize(data.holdings);
    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      const availW = Math.max(280, rect.width);
      const availH = Math.max(300, window.innerHeight - rect.top - 150);
      // cover: fill the viewport on both axes (max use of space); overflow is
      // pannable, and the user can zoom OUT to contain to see the whole farm
      const scale = Math.max(availW / scene.width, availH / scene.height);
      minZoomRef.current = Math.max(0.25, Math.min(availW / scene.width, availH / scene.height) / scale);
      setStage({ w: Math.round(scene.width * scale), h: Math.round(scene.height * scale) });
      wrap.style.height = `${availH}px`;
      setView((v) => clampView(v));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    window.addEventListener("orientationchange", fit);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", fit);
      window.removeEventListener("resize", fit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.holdings.length]);

  // gestures: 1-finger pan, 2-finger pinch, double-tap zoom, wheel zoom
  useEffect(() => {
    const stage = stageRef.current;
    const wrap = wrapRef.current;
    if (!stage || !wrap) return;
    const ptrs = new Map<number, { x: number; y: number }>();
    let pinch: { dist: number; zoom: number; cx: number; cy: number; tx: number; ty: number } | null = null;
    let pan: { x: number; y: number; tx: number; ty: number } | null = null;
    let lastTap = 0;

    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

    const down = (e: PointerEvent) => {
      try { stage.setPointerCapture(e.pointerId); } catch { /* synthetic or unsupported pointer */ }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      movedRef.current = false;
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const v = viewRef.current;
        pinch = { dist: dist(a, b), zoom: v.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, tx: v.tx, ty: v.ty };
        pan = null;
      } else if (ptrs.size === 1) {
        const now = Date.now();
        const v = viewRef.current;
        if (now - lastTap < 320) {
          // double-tap: toggle zoom, keeping the tapped point stable
          const target = v.zoom > 1.6 ? 1 : 2.4;
          const z = Math.max(minZoomRef.current, Math.min(4, target));
          const sw = stage.offsetWidth, sh = stage.offsetHeight;
          const rect = stage.getBoundingClientRect();
          const cx = ((e.clientX - rect.left) * sw) / rect.width;
          const cy = ((e.clientY - rect.top) * sh) / rect.height;
          const nv = { zoom: z, tx: e.clientX - rect.left - z * cx + (rect.width - sw) / 2, ty: e.clientY - rect.top - z * cy + (rect.height - sh) / 2 };
          const c = clampView(nv);
          setView(c);
          lastTap = 0;
        } else {
          lastTap = now;
          pan = { x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty };
        }
        if (ptrs.size === 1 && viewRef.current.zoom <= 1) pan = null; // nothing to pan at fit
      }
    };

    const move = (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size >= 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        const z = Math.max(minZoomRef.current, Math.min(4, pinch.zoom * (dist(a, b) / pinch.dist)));
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const nv = { zoom: z, tx: mx - (z * (pinch.cx - pinch.tx)) / pinch.zoom, ty: my - (z * (pinch.cy - pinch.ty)) / pinch.zoom };
        setView(clampView(nv));
        movedRef.current = true;
      } else if (pan && ptrs.size === 1) {
        const z = viewRef.current.zoom;
        const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
        if (Math.hypot(dx, dy) > 6) movedRef.current = true;
        setView(clampView({ zoom: z, tx: pan.tx + dx, ty: pan.ty + dy }));
      }
    };

    const up = (e: PointerEvent) => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) pan = null;
    };

    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const w = wrap.clientWidth, h = wrap.clientHeight;
      const z = Math.max(minZoomRef.current, Math.min(4, v.zoom * (e.deltaY < 0 ? 1.15 : 0.87)));
      const cx = (w / 2 - v.tx) / v.zoom, cy = (h / 2 - v.ty) / v.zoom;
      setView(clampView({ zoom: z, tx: w / 2 - z * cx, ty: h / 2 - z * cy }));
      movedRef.current = true;
    };

    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("wheel", wheel, { passive: false });
    return () => {
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
      stage.removeEventListener("wheel", wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (movedRef.current) return; // gesture moved — not a tap
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
      <div className="farm-wrap" ref={wrapRef}>
        <div
          className="farm-stage"
          ref={stageRef}
          style={{
            width: `${stage.w}px`,
            height: `${stage.h}px`,
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.zoom})`,
          }}
        >
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
