# Audit report — Nov 20, 2026

Full audit of the dividend-dashboard codebase: static hygiene, logic math,
runtime/API behavior, rendering, ops. Every finding below was fixed and
verified in this pass unless marked otherwise.

## Findings & fixes

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | high | Currency hardcoded to `£` in plot signs — a USD/EUR Ghostfolio would show the wrong currency | Signs now render `payload.currencySymbol` (mapped from base currency) |
| 2 | high | Critters could get permanently trapped inside solid rects smaller than their step (cow/horse/goat in the haystack rect, chickens in the coop) — `tryStep` needs an unblocked landing spot | Self-heal: trapped critters teleport to the nearest open point |
| 3 | high | Stale per-holding state when the portfolio changes (watering indexes, dividend-event history, farmer tour) | Holdings-signature reset in the renderer |
| 4 | med | Concurrent `/api/portfolio` requests each triggered their own upstream fetch (double Ghostfolio hits) | In-flight promise dedup — one shared refresh |
| 5 | med | Provider-call volume: quote cache was 1 minute (Ghostfolio default) → ~288 batched provider calls/day vs the free source's daily limit | `CACHE_QUOTES_TTL=3600` in compose → ~24 calls/day |
| 6 | med | Crop stages looked uniformly mid/ripe — Harvest Moon pacing missing | Stage curve rebalanced (seeds 0–15%, ball 15–38%, bigger 38–62%, near-ready 62–85%, ready 85%+) + demo calendar re-crafted to show the full lifecycle |
| 7 | med | Two disconnected world objects — the renderer's atmosphere never received the caller's clock state | World passed through the scene payload; caller advances it per tick |
| 8 | low | Dead code & unused vars from iterative edits (`startleCritter`, `sway`, unused imports, `Props` interface) | Removed; `tsc --noUnusedLocals` sweep now clean |
| 9 | low | No LICENSE file despite MIT in the README | LICENSE added |
| 10 | low | `ghostfolio:latest` unpinned — silent version drift | Pinned to 3.100.0 (Nov 2026 release) |
| 11 | low | Diagnostic artifacts tracked (contact sheets, proof renders) | Removed from tracking, gitignored |
| 12 | info | `/api/*` endpoints are unauthenticated on the LAN | Documented; optional `DASHBOARD_API_KEY` gate added (off by default) |
| 13 | info | Health endpoint minimal | Added version, uptime, API-gate status |

## Verified during the audit

- 15 unit tests over the pure logic (growth stages + thresholds + clamps,
  calendar bucketing across year boundaries, trailing-12m window, currency
  mapping, greedy unique crop assignment, milestone bands, hash spread)
- Live backup script round-trip against the running Postgres
- Strict tsc sweep (`noUnusedLocals`/`noUnusedParameters`) clean
- CI workflow added (typecheck + tests + build on every push)

## Known non-issues (checked, intentionally as-is)

- The API is LAN-trusted by design; the optional key gate covers stricter setups
- The canvas redraws fully every ~700 ms — measured cost is trivial for wall
  panels; no incremental-render complexity needed
- Demo data is date-relative: the stage spread shifts naturally as days pass
