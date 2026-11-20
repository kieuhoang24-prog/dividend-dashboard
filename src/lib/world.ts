// World state: real-clock time of day, date-seeded weather, seasons, wind,
// a capped particle engine, and synthesized ambient sound (no audio assets).

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Weather = "sunny" | "cloudy" | "rain";
export type ParticleKind = "drop" | "sparkle" | "seed" | "rain" | "splash" | "firefly" | "leaf" | "firework" | "confetti";

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  text?: string;
  g?: number; // gravity
}

export interface Settings {
  weather: boolean;
  dayNight: boolean;
  sound: boolean;
  cinematic: boolean;
}

const SETTINGS_KEY = "dd_settings";

export function loadSettings(): Settings {
  try {
    return { weather: true, dayNight: true, sound: false, cinematic: false, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return { weather: true, dayNight: true, sound: false, cinematic: false };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function hashDate(d: Date): number {
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export interface World {
  /** continuous daylight 0 (deep night) .. 1 (noon) */
  daylight: number;
  /** how deep into night phase (for fireflies/windows) */
  nightDepth: number;
  /** warm orange dusk tint 0..1 */
  duskWarm: number;
  /** pink dawn tint 0..1 */
  dawnPink: number;
  night: boolean;
  season: Season;
  weather: Weather;
  /** accumulated wind phase; advances every tick */
  windT: number;
  /** current wind strength -1..1 */
  wind: number;
  /** particles */
  particles: Particle[];
  /** days it has rained in a row (for the rainbow trigger) */
  rainJustEnded: boolean;
}

export function worldState(prev: World | null, settings: Settings): World {
  const now = new Date();
  const month = now.getMonth();
  const season: Season = month <= 1 || month === 11 ? "winter" : month <= 4 ? "spring" : month <= 7 ? "summer" : "autumn";
  const seed = hashDate(now);
  const roll = seed % 100;
  let weather: Weather = roll < (season === "winter" ? 55 : season === "spring" ? 30 : 18) ? "rain" : roll < 55 ? "cloudy" : "sunny";
  if (!settings.weather) weather = "sunny";

  // continuous day/night curve from the real clock (fractional hours).
  // sunrise 06:00, sunset 20:00 — light follows a half-sine between them.
  const h = now.getHours() + now.getMinutes() / 60;
  let daylight = 0;
  if (h >= 6 && h <= 20) {
    daylight = Math.sin(((h - 6) / 14) * Math.PI);
    daylight = Math.max(0.15, daylight); // never pitch black mid-day
  }
  // dusk warm peak ~19:30, dawn pink peak ~06:45 (gaussians, in hours)
  const duskWarm = Math.exp(-((h - 19.5) ** 2) / 1.6) + Math.exp(-((h - 20.2) ** 2) / 2.4);
  const dawnPink = Math.exp(-((h - 6.8) ** 2) / 1.4);
  const nightDepth = settings.dayNight ? Math.max(0, Math.min(1, 1 - daylight * 1.9)) : 0;
  const night = settings.dayNight && nightDepth > 0.45;
  if (!settings.dayNight) daylight = 1;

  const world: World = prev ?? {
    daylight: 1, nightDepth: 0, duskWarm: 0, dawnPink: 0, night: false,
    season, weather, windT: 0, wind: 0, particles: [], rainJustEnded: false,
  };
  world.daylight = settings.dayNight ? daylight : 1;
  world.nightDepth = nightDepth;
  world.duskWarm = settings.dayNight ? Math.min(1, duskWarm) : 0;
  world.dawnPink = settings.dayNight ? Math.min(1, dawnPink) : 0;
  world.night = night;
  world.season = season;
  world.rainJustEnded = world.weather === "rain" && weather !== "rain";
  world.weather = weather;
  world.windT += 0.07;
  world.wind = Math.sin(world.windT * 0.35) * (weather === "rain" ? 1 : 0.6);
  return world;
}

/** Ambient particles spawned by the world itself: rain, fireflies, leaves, snow. */
export function spawnAmbient(world: World, width: number, height: number, tick: number): void {
  const cap = 200;
  if (world.particles.length > cap) return;
  if (world.weather === "rain") {
    for (let i = 0; i < 10; i++) {
      world.particles.push({
        kind: "rain",
        x: Math.random() * width,
        y: -8,
        vx: world.wind * 1.6,
        vy: 7 + Math.random() * 3,
        life: 1,
        maxLife: 1,
        color: "#7fb2d9",
      });
    }
  }
  if (world.season === "winter" && tick % 2 === 0) {
    world.particles.push({
      kind: "rain", // snow reuses the streak draw with white slow flakes
      x: Math.random() * width,
      y: -6,
      vx: Math.sin(tick * 0.3) * 0.8,
      vy: 1.4,
      life: 1,
      maxLife: 1,
      color: "#ffffff",
    });
  }
  if (world.night && tick % 3 === 0) {
    world.particles.push({
      kind: "firefly",
      x: 40 + Math.random() * (width - 80),
      y: height * 0.35 + Math.random() * (height * 0.5),
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 0.8,
      life: 14,
      maxLife: 14,
      color: "#d9e86a",
    });
  }
  if (world.season === "autumn" && tick % 4 === 0) {
    world.particles.push({
      kind: "leaf",
      x: 30 + Math.random() * (width - 60),
      y: 30 + Math.random() * 80,
      vx: world.wind * 1.5 + (Math.random() - 0.5),
      vy: 0.8,
      life: 40,
      maxLife: 40,
      color: ["#d97b3b", "#c9a233", "#b8543a"][Math.floor(Math.random() * 3)],
    });
  }
}

export function updateParticles(world: World, width: number, height: number): void {
  for (const p of world.particles) {
    if (p.kind === "firefly") {
      p.vx += (Math.random() - 0.5) * 0.3;
      p.vy += (Math.random() - 0.5) * 0.2;
      p.vx = Math.max(-1, Math.min(1, p.vx));
      p.vy = Math.max(-0.7, Math.min(0.7, p.vy));
    }
    p.x += p.vx;
    p.y += p.vy;
    if (p.g) p.vy += p.g;
    p.life--;
  }
  world.particles = world.particles.filter(
    (p) => p.life > 0 && p.x > -20 && p.x < width + 20 && p.y < height + 24,
  );
}

export function drawParticles(ctx: CanvasRenderingContext2D, world: World): void {
  for (const p of world.particles) {
    ctx.save();
    if (p.kind === "rain") {
      const snow = p.color === "#ffffff";
      if (snow) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
      } else {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 1.5, p.y - p.vy * 1.5);
        ctx.stroke();
        if (p.y > 150 && Math.random() < 0.05) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = "#a8d8ec";
          ctx.fillRect(p.x, 150 + Math.random() * 40, 2, 1);
        }
      }
    } else if (p.kind === "firefly") {
      const blink = Math.sin(p.life * 1.7) > 0 ? 1 : 0.25;
      ctx.globalAlpha = 0.9 * blink * Math.min(1, p.life / 4);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 2, 2);
      ctx.globalAlpha = 0.25 * blink;
      ctx.fillRect(p.x - 1, p.y - 1, 4, 4);
    } else if (p.kind === "leaf") {
      ctx.globalAlpha = Math.min(1, p.life / 8);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 2);
    } else if (p.kind === "sparkle") {
      ctx.globalAlpha = Math.min(1, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      const s = p.life % 2 === 0 ? 2 : 1;
      ctx.fillRect(p.x, p.y, s, s);
      ctx.globalAlpha *= 0.4;
      ctx.fillRect(p.x - 1, p.y - 1, s + 2, s + 2);
    } else if (p.kind === "drop") {
      ctx.globalAlpha = Math.min(1, p.life / p.maxLife);
      ctx.fillStyle = "#8fd3df";
      ctx.fillRect(p.x, p.y, 2, 3);
    } else if (p.kind === "seed") {
      ctx.globalAlpha = Math.min(1, p.life / p.maxLife);
      ctx.fillStyle = "#d9b35c";
      ctx.fillRect(p.x, p.y, 2, 2);
    } else if (p.kind === "firework") {
      ctx.globalAlpha = Math.min(1, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 2, 2);
    } else if (p.kind === "confetti") {
      ctx.globalAlpha = Math.min(1, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 2);
    }
    ctx.restore();
  }
}

/* ── bursts ───────────────────────────────────────────────── */
export function burst(
  world: World,
  kind: ParticleKind,
  x: number,
  y: number,
  n: number,
  colors: string[],
  speed = 1.6,
): void {
  for (let i = 0; i < n && world.particles.length < 220; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.5 + Math.random());
    world.particles.push({
      kind,
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - speed * 0.4,
      life: 8 + Math.floor(Math.random() * 8),
      maxLife: 14,
      color: colors[i % colors.length],
      g: kind === "sparkle" || kind === "confetti" ? 0.06 : 0,
    });
  }
}

/** Floating text particle (rendered with the pixel font by the caller). */
export function floatText(world: World, x: number, y: number, text: string): void {
  world.particles.push({
    kind: "sparkle",
    x,
    y,
    vx: 0,
    vy: -0.35,
    life: 22,
    maxLife: 22,
    color: "#f2a63b",
    text,
  });
}

/** Firework show above a point: launch + radial burst. */
export function firework(world: World, x: number, y: number): void {
  const colors = ["#e8c547", "#d9483b", "#7bb661", "#5fb3c4", "#c8589e"];
  burst(world, "firework", x, y, 26, colors, 2.4);
}

/* ── ambient sound (synthesized, no assets) ────────────────── */
let audioCtx: AudioContext | null = null;
let windGain: GainNode | null = null;
let chirpTimer: number | null = null;

export function startAmbience(world: World, enabled: boolean): void {
  if (!enabled) {
    stopAmbience();
    return;
  }
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
      // wind: looped noise through a low-pass
      const len = audioCtx.sampleRate * 2;
      const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const lp = audioCtx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 400;
      windGain = audioCtx.createGain();
      windGain.gain.value = 0.015;
      src.connect(lp).connect(windGain).connect(audioCtx.destination);
      src.start();
      // birds: occasional synthesized chirps
      const chirp = () => {
        if (document.hidden || world.night || world.weather === "rain") return;
        const t0 = audioCtx!.currentTime;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
          const osc = audioCtx!.createOscillator();
          const g = audioCtx!.createGain();
          osc.type = "sine";
          const f = 2200 + Math.random() * 1800;
          const t = t0 + i * 0.12;
          osc.frequency.setValueAtTime(f, t);
          osc.frequency.exponentialRampToValueAtTime(f * 1.4, t + 0.05);
          osc.frequency.exponentialRampToValueAtTime(f * 0.9, t + 0.1);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.035, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
          osc.connect(g).connect(audioCtx!.destination);
          osc.start(t);
          osc.stop(t + 0.12);
        }
      };
      chirpTimer = window.setInterval(chirp, 5000 + Math.floor(Math.random() * 4000));
    }
    void audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

export function stopAmbience(): void {
  if (chirpTimer !== null) {
    clearInterval(chirpTimer);
    chirpTimer = null;
  }
  if (audioCtx) {
    void audioCtx.suspend();
  }
}
