# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is **not** a conventional software project — there's no build, lint, or test suite. It's the shared state for an autonomous trading system: two Claude Code/Cowork skills that trade a real Robinhood account and a static dashboard that reports on it. Everything here is either a skill definition (Markdown consumed by an agent), a JSON data file, or a static HTML/CSS/JS site.

**This trades real money.** Treat `config/risk-parameters.json` and the skill files as governing real financial risk, not sample config.

## Repo layout

```
Trading Agent/SKILL.md          trading-skill-v3 — executes trades, manages protective orders
Reporting Agent/SKILL.md        trading-report — publishes account state to the dashboard
config/risk-parameters.json     live default risk parameters, fetched by trading-skill-v4 each session
docs/                            static dashboard (GitHub Pages root)
  data/data.json                   the one file the reporting skill writes and the dashboard reads
  data/equity-log.csv              supplementary equity history
  assets/js/dashboard.js           renders data.json; has the authoritative data-contract comment at the top
  assets/css/                      nocturne.css (design system) + dashboard.css
  assets/images/                   dashboard logo and favicons
reporting/agent/                 scratch space for reporting-related work in progress (not the skill itself)
```

There is no `Trading Agent/SKILL.md` v4 in this repo yet — v4 is a newer skill (see below) that reads its risk defaults from `config/risk-parameters.json` in this repo over the network, falling back to hardcoded values if the fetch fails. The in-repo skill file is still v3.

## Running the dashboard locally

```bash
python -m http.server 8080 --directory docs
```

Equivalent to the `docs-static` launch config in `.claude/launch.json` — use the Browser preview tool with `{name: "docs-static"}` rather than starting a server manually via Bash.

The dashboard is pure static HTML/CSS/JS with no build step — edit `docs/assets/js/dashboard.js` or `docs/assets/css/*.css` directly and reload.

## The two skills

- **`Trading Agent/SKILL.md`** (`trading-skill-v3`, superseded operationally by `trading-skill-v4`, a skill that lives outside this repo but reads `config/risk-parameters.json` from it) — has full discretion to trade the "Agentic Account" within fixed risk guardrails, manages standing stop-loss/take-profit orders (never both on one position), and writes `position-notes.md` in a connected notes folder as memory for the next session.
- **`Reporting Agent/SKILL.md`** (`trading-report`) — strictly **read-only** against Robinhood. Reconstructs the day's activity from the API (never from the trading session's own narrative), rebuilds `docs/data/data.json` per the schema reference inlined at the bottom of its own SKILL.md, and publishes it through the GitHub REST Contents API so GitHub Pages picks it up. It runs no git commands and needs no local clone — only network access and a PAT read from disk.

The two skills never share state directly: the trading agent's memory is `position-notes.md`; the reporting agent's memory is the history already published in `data.json`. Don't have one skill write the other's file.

## Working with `docs/data/data.json`

- The schema is documented in two places — keep both in sync if you change it: the header comment in `docs/assets/js/dashboard.js` (authoritative), and the "Reference: JSON Schema Example" section at the bottom of `Reporting Agent/SKILL.md` (kept inline so that skill is a self-contained single file).
- `charts.*` arrays (`equity_curve`, `realized_pnl_daily`, `benchmark_spy_close`) are append-or-replace-today, never truncate or reorder older entries — they're the only persistent history.
- Percentages are stored as decimals (`0.05069`, not `5.069`).
- Never render or write account numbers, instrument IDs, or order UUIDs into this file's consumer-facing output — nickname (`"Agentic"`) only.
- A null `realized`/`realized_gain` means "no data," and the dashboard renders it as `—`, not `$0.00` — preserve that distinction when editing either the data or the renderer.
- `_demo_data: true` makes the dashboard show a "sample data" banner while still rendering the file normally — for local UI iteration without real account data, point `data.json` at a copy of the schema example from `Reporting Agent/SKILL.md` and leave that flag set. There is no automatic fallback: if `data.json` is missing or unparseable, `boot()` in `dashboard.js` replaces the page with a "Could not load data/data.json" error.

## Risk parameters

`config/risk-parameters.json` is fetched live by trading-skill-v4 at the start of every session (hardcoded values in the skill are only the fallback). Current defaults: max 3 new positions/session, max 30% of equity per position, max 50% of buying power deployed per session, 5% cash reserve floor, equities only, limit/day orders, order size capped at 1% of average daily volume, `HORIZON_BIAS` 2 (the dial between short-term trading and longer-term holding), leveraged/inverse ETFs blocked. Changing this file changes real trading behavior on the next live session — treat edits here with the same care as changing the skill logic itself.

The in-repo `Trading Agent/SKILL.md` is v3, whose risk table is fixed in the skill file and is *not* read from `config/`. Don't assume an edit to `config/risk-parameters.json` changes v3's behavior, or that editing the v3 table changes what actually runs.

## Git conventions in this repo

- Reporting commits follow the pattern `Portfolio update - <YYYY-MM-DD>` and touch only `docs/data/data.json`. They are created by the GitHub Contents API (one commit per run), not by a local `git push`.
- The reporting skill's write scope is intentionally narrow: one authenticated `PUT` to `docs/data/data.json` on `main` in this one repo — no other files, no other repos, no force-push, no history rewriting. On a `409` stale-`sha` conflict it re-fetches, re-merges, and retries exactly once.
- Because reporting sessions push to `main` out of band, `git push` from a local checkout can be rejected as non-fast-forward. Rebase onto `origin/main` — the incoming commit touches only `data.json` and will not conflict with skill, config, or dashboard edits.
