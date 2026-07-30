# Trading-Agent

An autonomous Claude trading agent that manages a real Robinhood brokerage account ("Agentic Account") and publishes a live performance dashboard via GitHub Pages.

The system is built as two [Claude Code / Cowork skills](https://docs.claude.com/en/docs/claude-code) that share one account and one repo:

- **[Trading Agent](Trading%20Agent/SKILL.md)** ([`trading-skill-v3`](Trading%20Agent/SKILL.md)) — runs trading sessions: reads yesterday's reasoning, rebuilds live account state via the Robinhood MCP connector, decides whether to trade, executes within fixed risk guardrails, manages standing stop-loss/take-profit orders, and writes a note for the next session. Superseded operationally by `trading-skill-v4` — see [Skill versions](#skill-versions).
- **[Reporting Agent](Reporting%20Agent/SKILL.md)** ([`trading-report`](Reporting%20Agent/SKILL.md)) — pulls the current state of the Agentic Account (read-only), assembles it into [`docs/data/data.json`](docs/data/data.json), and publishes it to this repo through the GitHub REST Contents API so the GitHub Pages dashboard picks it up.

> **This trades real money.** The agent has full discretion over strategy within the risk parameters below; there is no human in the loop approving individual trades. Nothing here is investment advice.

## Live dashboard

Portfolio state (equity, positions, today's trades, guardrail status, trade-quality stats, and equity/P&L charts) is published to `docs/` and served by GitHub Pages. Enable Pages on the `docs/` folder of this repo to view it, or run it locally:

```bash
python -m http.server 8080 --directory docs
```

The dashboard reads a single JSON file, [`docs/data/data.json`](docs/data/data.json). Its schema is documented in two places that must be kept in sync:

| Where | What it is |
|---|---|
| [`docs/assets/js/dashboard.js`](docs/assets/js/dashboard.js) (header comment) | the authoritative data contract |
| [`Reporting Agent/SKILL.md`](Reporting%20Agent/SKILL.md) (§ Reference: JSON Schema Example) | a full example with representative values, kept inline so the skill is a self-contained single file |

If `data.json` is marked `_demo_data: true`, the page renders it normally but shows a banner saying the numbers are sample data. If `data.json` is missing or unparseable, the page shows a "Could not load data/data.json" error — it does **not** silently fall back to sample data.

## Repo layout

```
Trading Agent/SKILL.md          trading-skill-v3 — executes trades, manages protective orders
Reporting Agent/SKILL.md        trading-report — publishes account state to the dashboard
config/risk-parameters.json     live default risk parameters, fetched by trading-skill-v4 each session
docs/                           static dashboard (GitHub Pages root)
  index.html
  data/data.json                  the one file the reporting skill writes and the dashboard reads
  data/equity-log.csv             supplementary equity history
  assets/css/                     nocturne.css (design system) + dashboard.css
  assets/js/dashboard.js          renders data.json; holds the authoritative data contract
  assets/images/                  dashboard logo and favicons
reporting/agent/                scratch space for reporting work in progress (not the skill itself)
```

## How the two skills work together

1. A scheduled or manual **trading session** runs the trading skill: it reads `position-notes.md` (its memory of prior reasoning), checks live account/position/order state, optionally trades, and rewrites the note for next time.
2. A separate **reporting session** runs `trading-report`: strictly read-only against Robinhood, it reconstructs the day's activity from the API (never from the trading session's own narrative), builds `docs/data/data.json`, and writes it back through the GitHub Contents API as a single commit.
3. GitHub Pages serves the updated dashboard from the published `docs/` folder.

The two skills never write to each other's state — the trading agent's memory is `position-notes.md` in its notes folder; the reporting agent's memory is the history already published in `data.json`.

## Skill versions

The trading skill checked into this repo is **v3**. The version actually running sessions is **`trading-skill-v4`**, which lives outside this repo but depends on it. V4 adds:

- **Live risk parameters.** V4 fetches [`config/risk-parameters.json`](config/risk-parameters.json) from this repo at the start of every session. Its own hardcoded values are only a fallback for when that fetch fails. **Editing that file changes real trading behaviour on the next live session** — treat it with the same care as changing skill logic.
- **`HORIZON_BIAS`** — a tunable dial between short-term trading and longer-term holding.
- **A leveraged/inverse ETF screen** — blocks new positions in instruments such as TQQQ, SQQQ, and SOXL.

V3's risk parameters are fixed in [`Trading Agent/SKILL.md`](Trading%20Agent/SKILL.md) and are not read from `config/`.

## Default risk parameters

Current contents of [`config/risk-parameters.json`](config/risk-parameters.json), as consumed by `trading-skill-v4`:

| Key | Value | Meaning |
|---|---|---|
| `MAX_NEW_POSITIONS_PER_SESSION` | 3 | new positions opened per session |
| `MAX_POSITION_SIZE_PCT` | 30 | max share of account equity in one position |
| `MAX_BUYING_POWER_DEPLOYED_PER_SESSION_PCT` | 50 | max share of buying power deployed per session |
| `CASH_RESERVE_FLOOR_PCT` | 5 | share of equity that must stay in cash |
| `INSTRUMENTS` | `equities_only` | no options |
| `DEFAULT_ORDER_TYPE` | `limit_day` | limit order, day time-in-force |
| `LIQUIDITY_RULE_MAX_PCT_ADV` | 1 | max order size as a share of average daily volume |
| `HORIZON_BIAS` | 2 | tilt between short-term trading and longer-term holding |
| `LEVERAGED_INSTRUMENTS_BLOCKED` | `true` | no new leveraged or inverse ETF positions |

Separately, both v3 and v4 allow **at most one standing protective order per position** — a stop-loss *or* a take-profit, never both at once.

These are circuit breakers, not the strategy — see [`Trading Agent/SKILL.md`](Trading%20Agent/SKILL.md) for the full decision framework.

## Requirements

- [Claude Code](https://claude.com/claude-code) or Cowork with a Robinhood MCP connector authorized for the target account
- A persistent notes location the trading skill can read/write `position-notes.md` to, for cross-session continuity
- A GitHub personal access token with `repo` (contents read/write) scope on this repository, stored as JSON on the machine running the reporting skill. The skill reads the token from disk and calls the GitHub API directly — it does not need a local clone of this repo or configured git credentials.

## License

[MIT](LICENSE)
