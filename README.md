# Trading-Agent

Shared state and live dashboard for an autonomous Claude trading agent that manages a real Robinhood brokerage account ("Agentic Account").

The agent itself is built as two [Claude Code / Cowork skills](https://docs.claude.com/en/docs/claude-code) — a **trading** skill that runs live sessions and a **reporting** skill that publishes account state. **Those skills now live in their own repository**; this repo holds only the pieces they read from and write to over the network:

- **[`config/risk-parameters.json`](config/risk-parameters.json)** — the live default risk guardrails the trading skill fetches at the start of every session.
- **[`docs/`](docs/)** — the static performance dashboard served by GitHub Pages, driven by a single JSON file the reporting skill publishes here.

> **This trades real money.** The agent has full discretion over strategy within the risk parameters below; there is no human in the loop approving individual trades. Nothing here is investment advice.

## Live dashboard

Portfolio state (equity, positions, today's trades, guardrail status, trade-quality stats, and equity/P&L charts) is published to `docs/` and served by GitHub Pages. Enable Pages on the `docs/` folder of this repo to view it, or run it locally:

```bash
python -m http.server 8080 --directory docs
```

The dashboard reads a single JSON file, [`docs/data/data.json`](docs/data/data.json). Its schema is defined by the authoritative data-contract comment at the top of [`docs/assets/js/dashboard.js`](docs/assets/js/dashboard.js).

If `data.json` is marked `_demo_data: true`, the page renders it normally but shows a banner saying the numbers are sample data. If `data.json` is missing or unparseable, the page shows a "Could not load data/data.json" error — it does **not** silently fall back to sample data.

## Repo layout

```
config/risk-parameters.json     live default risk parameters, fetched by the trading skill each session
docs/                           static dashboard (GitHub Pages root)
  index.html
  data/data.json                  the one file the reporting skill writes and the dashboard reads
  data/equity-log.csv             supplementary equity history
  assets/css/                     nocturne.css (design system) + dashboard.css
  assets/js/dashboard.js          renders data.json; holds the authoritative data contract
  assets/images/                  dashboard logo and favicons
```

## How the agent uses this repo

The trading and reporting skills live in a separate repository and run in the Claude Code / Cowork skills environment. They touch this repo over the network only:

1. A scheduled or manual **trading session** fetches [`config/risk-parameters.json`](config/risk-parameters.json) from this repo, checks live account/position/order state, optionally trades within those guardrails, and keeps its own cross-session memory outside this repo.
2. A separate **reporting session**, strictly read-only against Robinhood, reconstructs the day's activity from the API, builds `docs/data/data.json`, and writes it back through the GitHub REST Contents API as a single commit (`Portfolio update - <YYYY-MM-DD>`).
3. GitHub Pages serves the updated dashboard from the published `docs/` folder.

## Default risk parameters

Current contents of [`config/risk-parameters.json`](config/risk-parameters.json), fetched live by the trading skill at the start of each session. Its own hardcoded values are only a fallback for when that fetch fails — **editing this file changes real trading behaviour on the next live session**, so treat it with the same care as changing skill logic.

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

The trading skill also allows **at most one standing protective order per position** — a stop-loss *or* a take-profit, never both at once. These are circuit breakers, not the strategy.

## Requirements

- [Claude Code](https://claude.com/claude-code) or Cowork with the trading and reporting skills installed, plus a Robinhood MCP connector authorized for the target account.
- A GitHub personal access token with `repo` (contents read/write) scope on this repository, stored where the reporting skill can read it. The skill calls the GitHub API directly — it does not need a local clone of this repo or configured git credentials.

## License

[MIT](LICENSE)
