# Dividend Dashboard 🌾

A self-hosted, **pixel-art dividend farm** for your portfolio. Instead of staring at
red/green price charts, watch your holdings grow as crops — and level up the whole
farm as your annual dividend income crosses milestones.

Inspired by [the Trading 212 pixel-art farm on Reddit](https://www.reddit.com/r/trading212/comments/1y0hzt2/) —
but wired to your own **Ghostfolio** instance, fully local, and designed to sit in a
Home Assistant dashboard.

## What you get

| View | What it shows |
|---|---|
| **Farm** | Each holding is a tilled plot growing crops (wheat, carrots, pumpkins…). Bigger dividend payer → riper crop. The scene expands (trees, pond, bigger farmhouse) as you level up. |
| **Holdings** | Harvest log: value, yield, trailing-12-month dividends per position. |
| **Schedule** | Harvest calendar: the last 12 months of real payout history from Ghostfolio activities. |
| **Stages** | Milestone ladder (Seedling plot → Sprout garden → Growing farm → Thriving estate → Golden harvest) with progress to the next. |
| **Settings** | Connection health, refresh, and a ready-to-paste Home Assistant card. |

Headline stat everywhere: **estimated annual income** (trailing 12 months of received
dividends) — the number that matters for a dividend pie, not today's P&L.

## Farm stages

Annual dividend income (in your base currency) decides the farm level:

| Level | Milestone | Name | Perk |
|---|---|---|---|
| 1 | £0 | Seedling plot | A tiny patch of hope |
| 2 | £500 | Sprout garden | Trees appear on the field |
| 3 | £1,000 | Growing farm | Bigger farmhouse, more land |
| 4 | £2,500 | Thriving estate | Fences, flowers, a pond |
| 5 | £5,000 | Golden harvest | Golden roofs over the barns |

(£ = whatever `BASE_CURRENCY` you set; bands are plain numbers, not FX-converted.)

## Quick start (Docker Compose)

Everything runs locally: the dashboard, a **Ghostfolio** instance, Postgres and Redis —
one container each, one shared network.

```bash
cp .env.example .env
# edit .env: change the secrets (ACCESS_TOKEN_SALT, JWT_SECRET_KEY, POSTGRES_PASSWORD, REDIS_PASSWORD)
docker compose up -d --build
```

1. Open **http://localhost:3333** → create your Ghostfolio account (first user = admin).
2. Import your activities (buys + `DIVIDEND` activities — Ghostfolio has CSV import under
   *Portfolio → Activities → Import*). The farm runs on whatever you've recorded.
3. In Ghostfolio: **My Ghostfolio → Account → Security → Security token → copy**.
4. Paste it into `.env` as `GHOSTFOLIO_TOKEN=…` and restart the dashboard:
   `docker compose up -d dashboard`
5. Open **http://localhost:8090** — your real farm.

No token? No problem: the dashboard serves a deterministic **demo farm** (~£1,200/yr
across 10 classic dividend payers) so you can see everything working first.

## Configuration

Set in `.env` (compose interpolates it; the dashboard reads it from the environment):

| Variable | Default | Meaning |
|---|---|---|
| `GHOSTFOLIO_URL` | `http://ghostfolio:3333` | Where the dashboard container reaches Ghostfolio. Use `http://localhost:3333` when running the server outside Docker. |
| `GHOSTFOLIO_TOKEN` | *(empty → demo mode)* | Your Ghostfolio security token. Exchanged server-side for a JWT — it never reaches the browser. |
| `BASE_CURRENCY` | `GBP` | Currency for display; amounts from Ghostfolio already arrive in your base currency. |
| `REFRESH_SECONDS` | `300` | Upstream fetch cadence; the browser reuses the server cache. |
| `PORT` | `8090` | Host port mapping for the dashboard (8080 is taken here by RethinkDB, so we default to 8090). |

## Home Assistant

Kiosk mode hides tabs and chrome for wall panels: `/?kiosk=1`.

Lovelace **Webpage card** (or a native `panel: iframe` view):

```yaml
type: iframe
title: Dividend Farm
icon: mdi:flower
url: http://YOUR_MAC_OR_SERVER:8090/?kiosk=1
```

The dashboard auto-refreshes from the server cache, so a wall panel stays current
without extra automation. (Dark theme is the default — it matches HA.)

## Data & privacy

- The Ghostfolio **security token lives only in `.env`** on your machine; the tiny Node
  server holds it and exchanges it for a short-lived JWT.
- Portfolio data is fetched server-side on demand and cached in memory — nothing is
  stored by this app, nothing leaves your network except Ghostfolio's own market data calls.
- If Ghostfolio is unreachable, the dashboard keeps serving its last cache (or the demo farm).

## Development

```bash
npm install
npm run dev        # server :8787 (tsx watch) + Vite client :5173 with /api proxy
npm run build      # tsc + vite build (dist/) + esbuild server bundle (dist-server/)
npm start          # serve production build on :8090
```

Layout:

```
server/          Hono API + static server, Ghostfolio client, dividend aggregation
shared/types.ts  payload contract (farm bands, holdings, calendar) — one source of truth
src/lib/sprites  8×8 pixel crop grids + palette (all art is code, no image assets)
src/lib/farm.ts  canvas scene layout: grass, soil plots, house levels, pond
src/views/       Farm / Holdings / Schedule / Stages / Settings
docker-compose   dashboard + ghostfolio + postgres + redis
```

## Troubleshooting

- **Stuck in demo mode** → `GHOSTFOLIO_TOKEN` empty in `.env`, or the server can't reach
  Ghostfolio (check Settings view: *last upstream error*).
- **Auth fails (401/403)** → the token in `.env` must be the account's *security token*
  (Settings → Security), not a JWT.
- **Empty holdings** → you have activities but the positions endpoint is new to your
  Ghostfolio version: the dashboard falls back to deriving positions from BUY/SELL
  activities (cost-basis, not market value) and says so in the payload source.
- **Port 8090 busy** → change `PORT` in `.env` and restart.

## Roadmap

- [ ] Per-holding dividend *projection* (schedule-aware next payout estimates)
- [ ] Seasonal crop rotation animation (plot harvest flash on payout)
- [ ] HA custom card (instead of iframe) that renders the farm natively in Lovelace
- [ ] The AI farm-dog chat (Town Hall) — later, with an opt-in LLM key

## License

MIT (do keep the pixel farmers company).
