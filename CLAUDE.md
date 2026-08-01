# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is **not** a conventional software project — there's no build, lint, or test suite. It's the shared state for an autonomous trading system: the risk config and the static dashboard that reports on a real Robinhood account. The two skills that actually trade the account and publish the dashboard **live in a separate repository** — this repo only holds what they read from and write to over the network.

**This trades real money.** Treat `config/risk-parameters.json` as governing real financial risk, not sample config.

## Repo layout

```
config/risk-parameters.json     live default risk parameters, fetched by the trading skill each session
docs/                            static dashboard (GitHub Pages root)
  data/data.json                   the one file the reporting skill writes and the dashboard reads
  data/equity-log.csv              supplementary equity history
  assets/js/dashboard.js           renders data.json; has the authoritative data-contract comment at the top
  assets/css/                      nocturne.css (design system) + dashboard.css
  assets/images/                   dashboard logo and favicons
```

## Running the dashboard locally

```bash
python -m http.server 8080 --directory docs
```

Equivalent to the `docs-static` launch config in `.claude/launch.json` — use the Browser preview tool with `{name: "docs-static"}` rather than starting a server manually via Bash.

The dashboard is pure static HTML/CSS/JS with no build step — edit `docs/assets/js/dashboard.js` or `docs/assets/css/*.css` directly and reload.

## The two skills (external)

The trading and reporting skills are installed and executed in the Claude Code / Cowork skills environment, in their own repository — not here. This repo is just the config they fetch and the dashboard they publish to, so nothing you edit here changes skill logic. What matters for work in this repo:

- **Trading skill** — has full discretion to trade the "Agentic Account" within risk guardrails and manages standing stop-loss/take-profit orders (never both on one position). It fetches `config/risk-parameters.json` from this repo at session start, falling back to its own hardcoded values if the fetch fails. Editing that file changes real trading behaviour on the next live session.
- **Reporting skill** — strictly **read-only** against Robinhood. Reconstructs the day's activity from the API (never from a trading session's narrative), rebuilds `docs/data/data.json`, and publishes it through the GitHub REST Contents API so GitHub Pages picks it up. It runs no git commands and needs no local clone — only network access and a PAT read from disk.

## Working with `docs/data/data.json`

- The schema is documented in the header comment of `docs/assets/js/dashboard.js` (authoritative). If you change the contract, update that comment.
- `charts.*` arrays (`equity_curve`, `realized_pnl_daily`, `benchmark_spy_close`) are append-or-replace-today, never truncate or reorder older entries — they're the only persistent history.
- Percentages are stored as decimals (`0.05069`, not `5.069`).
- Never render or write account numbers, instrument IDs, or order UUIDs into this file's consumer-facing output — nickname (`"Agentic"`) only.
- A null `realized`/`realized_gain` means "no data," and the dashboard renders it as `—`, not `$0.00` — preserve that distinction when editing either the data or the renderer.
- `_demo_data: true` makes the dashboard show a "sample data" banner while still rendering the file normally — for local UI iteration without real account data, point `data.json` at a copy of the schema example and leave that flag set. There is no automatic fallback: if `data.json` is missing or unparseable, `boot()` in `dashboard.js` replaces the page with a "Could not load data/data.json" error.

## Risk parameters

`config/risk-parameters.json` is fetched live by the trading skill at the start of every session (hardcoded values in the skill are only the fallback). Current defaults: max 3 new positions/session, max 30% of equity per position, max 50% of buying power deployed per session, 5% cash reserve floor, equities only, limit/day orders, order size capped at 1% of average daily volume, `HORIZON_BIAS` 2 (the dial between short-term trading and longer-term holding), leveraged/inverse ETFs blocked. Changing this file changes real trading behavior on the next live session — treat edits here with the same care as changing the skill logic itself.

## Git conventions in this repo

- Reporting commits follow the pattern `Portfolio update - <YYYY-MM-DD>` and touch only `docs/data/data.json`. They are created by the GitHub Contents API (one commit per run), not by a local `git push`.
- The reporting skill's write scope is intentionally narrow: one authenticated `PUT` to `docs/data/data.json` on `main` in this one repo — no other files, no other repos, no force-push, no history rewriting. On a `409` stale-`sha` conflict it re-fetches, re-merges, and retries exactly once.
- Because reporting sessions push to `main` out of band, `git push` from a local checkout can be rejected as non-fast-forward. Rebase onto `origin/main` — the incoming commit touches only `data.json` and will not conflict with config or dashboard edits.
