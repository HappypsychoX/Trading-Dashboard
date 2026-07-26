# Trading-Agent

An autonomous Claude trading agent that manages a real Robinhood brokerage account ("Agentic Account") and publishes a live performance dashboard via GitHub Pages.

The system is built as two [Claude Code / Cowork skills](https://docs.claude.com/en/docs/claude-code) that share one account and one repo:

- **[Trading Agent](Trading%20Agent/SKILL.md)** ([`trading-skill-v3`](Trading%20Agent/SKILL.md)) — runs trading sessions: reads yesterday's reasoning, rebuilds live account state via the Robinhood MCP connector, decides whether to trade, executes within fixed risk guardrails, manages standing stop-loss/take-profit orders, and writes a note for the next session.
- **[Reporting Agent](Reporting%20Agent/SKILL.md)** ([`portfolio-daily-report`](Reporting%20Agent/SKILL.md)) — pulls the current state of the Agentic Account (read-only), assembles it into [`docs/data/data.json`](docs/data/data.json), and pushes it to this repo so the GitHub Pages dashboard picks it up.

> **This trades real money.** The agent has full discretion over strategy within the risk parameters below; there is no human in the loop approving individual trades. Nothing here is investment advice.

## Live dashboard

Portfolio state (equity, positions, today's trades, guardrail status, trade-quality stats, and equity/P&L charts) is published to `docs/` and served by GitHub Pages. Enable Pages on the `docs/` folder of this repo to view it, or run it locally:

```bash
python -m http.server 8080 --directory docs
```

The dashboard reads a single JSON file, [`docs/data/data.json`](docs/data/data.json), against the schema documented in [`Reporting Agent/references/schema_example.json`](Reporting%20Agent/references/schema_example.json) and at the top of [`docs/assets/js/dashboard.js`](docs/assets/js/dashboard.js). If `data.json` is missing or marked `_demo_data: true`, the page falls back to sample data and shows a banner saying so.

## Repo layout

```
Trading Agent/          trading-skill-v3 — executes trades, manages protective orders
Reporting Agent/        portfolio-daily-report — publishes account state to the dashboard
docs/                   static dashboard (GitHub Pages root)
  data/data.json         the one file the reporting skill writes and the dashboard reads
  assets/                dashboard CSS/JS
reporting/               scratch space for reporting-related work in progress
```

## How the two skills work together

1. A scheduled or manual **trading session** runs `trading-skill-v3`: it reads `position-notes.md` (its memory of prior reasoning), checks live account/position/order state, optionally trades, and rewrites the note for next time.
2. A separate **reporting session** runs `portfolio-daily-report`: strictly read-only against Robinhood, it reconstructs the day's activity from the API (never from the trading session's own narrative), builds `docs/data/data.json`, and commits/pushes it.
3. GitHub Pages serves the updated dashboard from the pushed `docs/` folder.

The two skills never write to each other's state — the trading agent's memory is `position-notes.md` in its notes folder; the reporting agent's memory is the history already committed in `data.json`.

## Default risk parameters (trading-skill-v3)

| Parameter | Default |
|---|---|
| Max new positions per session | 3 |
| Max position size | 30% of account equity |
| Max buying power deployed per session | 50% of available buying power |
| Cash reserve floor | 5% of account equity |
| Instruments | Equities only, unless overridden |
| Order type | Limit, day time-in-force |
| Protective orders | At most one per position (stop-loss *or* take-profit, never both) |

These are circuit breakers, not the strategy — see [`Trading Agent/SKILL.md`](Trading%20Agent/SKILL.md) for the full decision framework.

## Requirements

- [Claude Code](https://claude.com/claude-code) or Cowork with a Robinhood MCP connector authorized for the target account
- A persistent notes location the trading skill can read/write `position-notes.md` to, for cross-session continuity
- Git push access to this repo for the reporting skill to publish dashboard updates

## License

[MIT](LICENSE)
