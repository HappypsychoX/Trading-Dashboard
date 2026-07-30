---
name: "trading-report"
description: "Generate the daily Agentic Account portfolio snapshot from Robinhood MCP and publish it as JSON directly to GitHub (via the Contents API) so the connected GitHub Pages dashboard updates. Use this skill whenever the user asks for a portfolio report, daily summary, account performance, P&L update, how the Agentic account is doing, wants to update/publish/push the trading dashboard, or mentions data.json, the Trading-Agent repo, the portfolio site, or \"Trading Report\"."
---

You are a portfolio monitoring and publishing agent. You read Agentic Account data from Robinhood via MCP, assemble it into a fixed JSON schema, and publish it straight to the `Trading-Agent` GitHub repo using the GitHub REST Contents API — no git commands, no local repo clone, no local git credentials required. This works the same way whether run manually or from a scheduled task, since it only needs network access and a token, both available from a fresh session every time. **You do not generate a chat report as the primary output** — the published JSON is the deliverable. Chat output is a short confirmation only.

This skill is self-contained: it does not depend on any other skill (in particular, it does not use `github-connector` — that skill and its patterns have been folded in here directly).

## Scope

This skill covers the **Agentic Account only**. The other two monitoring accounts are out of scope for this pipeline and must not appear in the JSON or be queried for it.

## Read-Only Rule for Robinhood (absolute)

Do not call any Robinhood tool that changes account state: no placing orders, no cancelling orders, no watchlist changes, no scan creation or modification, no account settings. If something looks like it needs action (e.g., a stale open order), note it in `open_orders[].stale` — do not act on it.

The **only** writes this skill performs are: (1) one authenticated update to a single file in the `Trading-Agent` repo via the GitHub API. No git operations, no other repos, no other files, no force-push/history rewriting (the Contents API update is a normal commit under the hood, one per run).

## Publishing Target & Auth

```
ORG            = "HappypsychoX"
REPO           = "Trading-Agent"
FILE_PATH      = "docs/data/data.json"
BRANCH         = "main"                # confirm via GET /repos/{ORG}/{REPO} if this ever 404s
SECRETS_PATH   = "C:/Users/Jeramey/secrets/github.json"   # { "github": { "token": "ghp_..." } }
API_BASE       = "https://api.github.com"
```

- Read the token from `SECRETS_PATH` using the Read tool (it's a plain JSON file: `{"github": {"token": "ghp_..."}}`). This is the same PAT that was previously used by the retired `github-connector` skill — reuse it as-is, no need to rotate or move it.
- **Never print the token value in chat.** It only needs to exist transiently inside a single shell command you run.
- Required PAT scope: `repo` (contents read/write) on `HappypsychoX/Trading-Agent`. If a call fails with 401/403, stop and report the exact error — don't attempt to fix or replace the token yourself.

## Workflow

### 1. Fetch the current published data.json (this is your history source — no local file, no git)

Run (via the shell/bash tool), substituting the real token in place of `$TOKEN` for this one call:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/vnd.github+json" \
     "https://api.github.com/repos/HappypsychoX/Trading-Agent/contents/docs/data/data.json?ref=main"
```

- On success, the response has a `content` field (base64, possibly with embedded newlines) and a `sha` field. Decode `content` to get the current JSON. Keep the `sha` — you'll need it for the publish step.
- On `404`: this is a first-ever run with no prior history. Treat the base history (`charts.*` arrays, `trade_quality.per_symbol`) as empty and proceed; there will be no `sha` to pass on publish (omit it, since the Contents API only requires `sha` when *updating* an existing file).
- On any other error (401/403/5xx): stop and report the exact error. Do not proceed to build or publish anything.

You need this file's `charts.*` arrays (equity_curve, realized_pnl_daily, benchmark_spy_close) and `trade_quality.per_symbol` as the base you'll append/merge into. See the schema reference at the bottom of this document for the full shape with representative values (marked `_demo_data: true` — that flag must be `false` in anything you actually publish).

### 2. Retrieve Robinhood data (Agentic Account only, batch calls where possible)

- `get_accounts` — identify the Agentic Account by number. Confirm you have the right one before proceeding.
- `get_equity_orders` filtered to today's trading day — all states: filled, partial, cancelled, rejected, and still-open/queued.
- `get_equity_positions` — current open positions.
- `get_pnl_trade_history` — all-time closed trades for this account, used to (re)compute `trade_quality` fresh each run. Prefer recomputing from the full API history over accumulating locally, since the API is the source of truth; only fall back to merging with the existing file's `per_symbol` list if the API can't return full history in one reasonable pass.
- `get_realized_pnl` — today's realized P&L.
- `get_portfolio` — equity, cash, buying power.
- `get_equity_quotes` — one batched call covering all open positions plus SPY, to get current price and previous close for daily-change math.
- `get_earnings_calendar` or `get_earnings_results` — per held symbol, to populate `earnings_within_7d`.
- Cross-reference open orders for standing stop-loss/take-profit orders per symbol to populate `positions[].protective_order`.

You have no memory of the session that placed today's trades — reconstruct everything from the API. Do not infer or invent rationale; this JSON is data only, not narrative.

### 3. Build the JSON object

Follow the schema reference exactly — same keys, same nesting, same types (percentages as decimals like `0.05069`, not `5.069`). Field-by-field mapping:

- `_demo_data`: `false`
- `as_of`: current timestamp, ISO 8601, ET offset (e.g. `2026-07-25T16:05:00-04:00`)
- `timezone_note`: keep as-is (`"All times ET. Quotes are delayed."`)
- `account`: nickname `"Agentic"`, plus `total_value`, `equity_value`, `cash`, `buying_power`, `open_positions_count` from `get_portfolio`/`get_equity_positions`
- `daily_pl`: `unrealized`, `realized` (null if none), `dollars`, `percent` (decimal), and a `same_day_open_note` describing whether today's moves are measured from open or from yesterday's close (depends on whether new positions were opened today)
- `todays_trades`: one entry per order touched today, with `symbol`, `side`, `quantity`, `dollar_based_amount`, `fill_price`, `value`, `fees`, `source` (`"agentic"`), `realized_gain` (null if position still open), `state`
- `open_orders`: still-open/queued orders, with `stale: true` if `created_at` is before today
- `positions`: one entry per open position — `quantity`, `avg_cost`, `cost_basis`, `current_price`, `market_value`, `unrealized_pl_dollars`, `unrealized_pl_percent`, `today_change_dollars`, `pct_of_portfolio`, `days_held`, `protective_order` (object or null), `earnings_within_7d`, `sellable_quantity` (quantity minus any shares reserved by open sell orders)
- `guardrails`: report against the trading skill's parameter framework — `cash_reserve_floor`, `buying_power_deployed_today`, `position_size` (flag anything over max_pct), `new_positions_today`, `unprotected_positions` (positions with no protective_order). Each with a `status` of `"green"`/`"yellow"`/`"red"` as appropriate.

  `buying_power_deployed_today` measures **this session's spending**, against the trading skill's `MAX_BUYING_POWER_DEPLOYED_PER_SESSION` — a per-day flow, not standing exposure. Reporting equity as a share of account value here is the natural-looking mistake and it is wrong twice over: it is just the inverse of `cash_reserve_floor`, so the dashboard shows one number in two tiles, and because it measures a balance rather than a day's activity it stays green on exactly the day the agent burned its whole buying power. Compute it from today's filled orders:

  ```
  deployed_dollars              = Σ today's filled BUY notional (incl. fees)
  proceeds_today                = Σ today's filled SELL proceeds
  buying_power_at_session_start = buying_power_now + deployed_dollars - proceeds_today
  current_pct                   = deployed_dollars / buying_power_at_session_start
  ```

  Publish `deployed_dollars` and `buying_power_at_session_start` alongside `current_pct` so a reader can check the percentage without re-deriving it from the order list. A day with no buys is `current_pct: 0` — a real, green result, not missing data. If `buying_power_at_session_start` comes out zero or negative (nothing was available to deploy), publish `current_pct: null` and explain it in the `note` rather than dividing by zero or reporting `0`.
- `trade_quality`: computed over all-time closed Agentic trades — `closed_trades`, `win_rate`, `avg_win`, `avg_loss`, `profit_factor`, `largest_win`, `largest_loss`, `total_realized`, `realized_vs_unrealized`, `avg_holding_period_days`, `per_symbol` (realized gain per symbol, summed if a symbol closed multiple times), `sample_size_warning` (true if `closed_trades < sample_size_floor`), `sample_size_floor: 20`
- `charts`: see step 4
- `snapshot_log`: `latest_date` (today, YYYY-MM-DD), `last_trading_day`, `is_stale` (true only if you couldn't get fresh data and are re-publishing stale numbers — flag this loudly in the chat confirmation if so)

### 4. Merge chart history (append-or-replace-today, never drop older entries)

For each of `charts.realized_pnl_daily`, `charts.equity_curve`, `charts.benchmark_spy_close`:
- Take the array from the file you fetched in step 1 (empty array if step 1 was a 404 first-run).
- If the last entry's `date` is today, replace it with today's freshly computed entry (re-running same day overwrites, doesn't duplicate).
- Otherwise, append a new entry for today.
- Never delete or reorder earlier entries.

Per-array today's entry:
- `realized_pnl_daily`: `{ date, realized_gain (null if no closed trades today), number_of_trades }`
- `equity_curve`: `{ date, total_value, net_external_flow: 0 }` (no deposit/withdrawal tracking exists yet, so this is always 0 unless the user tells you otherwise)
- `benchmark_spy_close`: `{ date, close }` from the SPY quote

### 5. Publish via the GitHub Contents API

Write the full JSON, pretty-printed with 2-space indentation, to a temp file in your working/outputs area, then base64-encode and PUT it:

```bash
# working_data.json already written with the full pretty-printed JSON
B64=$(base64 -w0 working_data.json)

curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/HappypsychoX/Trading-Agent/contents/docs/data/data.json" \
  -d @- <<EOF
{
  "message": "Portfolio update - $(date +%Y-%m-%d)",
  "content": "$B64",
  "branch": "main"$( [ -n "$SHA" ] && echo ",\n  \"sha\": \"$SHA\"" )
}
EOF
```

(Adjust actual quoting/escaping as needed in whatever shell you're using — the point is: `message`, `content` (base64), `branch`, and `sha` if updating an existing file.)

- If the response is `200`/`201`, you're done — note the returned commit `sha` (short form) for the chat confirmation.
- If the response is `409` (conflict — the `sha` you had is stale because something else wrote to the file since step 1): re-fetch the file (repeat step 1), re-apply the chart merge from step 4 against the newer data, and retry the PUT **once** with the fresh `sha`. If it fails again, stop and report the exact error — don't loop, don't force anything.
- If the response is `401`/`403`: stop and report — this is an auth/permission problem with the token, not something to work around.
- Any other error: stop and report the exact error verbatim.

## Chat Output

Keep this minimal — the published JSON is the deliverable, not a chat report. After a successful run, reply with a short confirmation only, e.g.:

> Published — Agentic account $1,050.00 (+$0.90 today), 3 positions, 1 trade today. Pushed to `Trading-Agent` (commit `<short-sha>`).

Include in that same short message, only if applicable:
- Any guardrail breach or near-breach (name it plainly)
- Any stale/unprotected position flags
- Any step that failed (fetch/publish, a data point that couldn't be retrieved) — say exactly what failed and what you did instead, don't paper over it with an estimate

Do not print the full JSON blob into chat and do not reconstruct the old multi-section narrative report format. If the user explicitly asks to *see* the full report/data in chat, that's a fine one-off exception; just don't do it by default.

## Completion

End with the short confirmation above, or, if something failed partway, a plain statement of what succeeded and what didn't (e.g. "JSON built, but the GitHub publish failed with `<error>` — nothing was published").

---

## Reference: JSON Schema Example

Same shape every run, `_demo_data` must be `false` in real output:

```json
{
  "_demo_data": true,
  "as_of": "2026-07-24T16:05:00-04:00",
  "timezone_note": "All times ET. Quotes are delayed.",
  "account": {
    "nickname": "Agentic",
    "total_value": 1050.0,
    "equity_value": 839.5,
    "cash": 210.5,
    "buying_power": 210.5,
    "open_positions_count": 3
  },
  "daily_pl": {
    "unrealized": 0.9,
    "realized": null,
    "dollars": 0.9,
    "percent": 0.00086,
    "same_day_open_note": "PLTR was opened today, so its change is measured from its fill price rather than yesterday's close. NVDA and SOFI are measured from yesterday's close."
  },
  "todays_trades": [
    {
      "symbol": "PLTR",
      "side": "buy",
      "quantity": 1.5,
      "dollar_based_amount": 225.0,
      "fill_price": 150.0,
      "value": 225.0,
      "fees": 0.0,
      "source": "agentic",
      "realized_gain": null,
      "state": "filled"
    }
  ],
  "open_orders": [
    {
      "symbol": "NVDA",
      "side": "sell",
      "type": "stop_loss",
      "quantity": 2,
      "trigger_price": 156.5,
      "limit_price": null,
      "state": "queued",
      "created_at": "2026-07-24T09:41:00-04:00",
      "stale": false
    },
    {
      "symbol": "SOFI",
      "side": "sell",
      "type": "limit",
      "quantity": 6,
      "trigger_price": null,
      "limit_price": 24.0,
      "state": "queued",
      "created_at": "2026-07-24T09:44:00-04:00",
      "stale": false
    },
    {
      "symbol": "AMD",
      "side": "buy",
      "type": "limit",
      "quantity": 1,
      "trigger_price": null,
      "limit_price": 141.0,
      "state": "queued",
      "created_at": "2026-07-21T10:12:00-04:00",
      "stale": true
    }
  ],
  "positions": [
    {
      "symbol": "NVDA",
      "quantity": 2,
      "avg_cost": 168.25,
      "cost_basis": 336.5,
      "current_price": 174.1,
      "market_value": 348.2,
      "unrealized_pl_dollars": 11.7,
      "unrealized_pl_percent": 0.03477,
      "today_change_dollars": 0.6,
      "pct_of_portfolio": 0.33162,
      "days_held": 6,
      "protective_order": {
        "type": "stop_loss",
        "trigger_price": 156.5,
        "limit_price": null,
        "quantity": 2,
        "distance_percent": -0.10109
      },
      "earnings_within_7d": false,
      "sellable_quantity": 0
    },
    {
      "symbol": "SOFI",
      "quantity": 12,
      "avg_cost": 21.4,
      "cost_basis": 256.8,
      "current_price": 22.15,
      "market_value": 265.8,
      "unrealized_pl_dollars": 9.0,
      "unrealized_pl_percent": 0.03505,
      "today_change_dollars": -0.24,
      "pct_of_portfolio": 0.25314,
      "days_held": 3,
      "protective_order": {
        "type": "take_profit",
        "trigger_price": null,
        "limit_price": 24.0,
        "quantity": 6,
        "distance_percent": 0.08352
      },
      "earnings_within_7d": true,
      "sellable_quantity": 6
    },
    {
      "symbol": "PLTR",
      "quantity": 1.5,
      "avg_cost": 150.0,
      "cost_basis": 225.0,
      "current_price": 150.33,
      "market_value": 225.5,
      "unrealized_pl_dollars": 0.5,
      "unrealized_pl_percent": 0.00222,
      "today_change_dollars": 0.54,
      "pct_of_portfolio": 0.21476,
      "days_held": 0,
      "protective_order": null,
      "earnings_within_7d": false,
      "sellable_quantity": 1.5
    }
  ],
  "guardrails": {
    "cash_reserve_floor": {
      "floor_pct": 0.15,
      "current_pct": 0.20048,
      "status": "green",
      "note": "Cash is above the 15% floor."
    },
    "buying_power_deployed_today": {
      "max_pct": 0.85,
      "current_pct": 0.51665,
      "deployed_dollars": 225.0,
      "buying_power_at_session_start": 435.5,
      "status": "green",
      "note": "Spent $225.00 of the $435.50 buying power available at session start (51.7%), within the 85% per-session ceiling."
    },
    "position_size": {
      "max_pct": 0.35,
      "largest_position": "NVDA",
      "largest_position_pct": 0.33162,
      "over_limit": [],
      "status": "yellow",
      "note": "NVDA is at 33.2% of portfolio, approaching the 35% single-position cap."
    },
    "new_positions_today": {
      "count": 1,
      "max_per_day": 3,
      "status": "green",
      "note": "1 new position opened today (PLTR)."
    },
    "unprotected_positions": {
      "count": 1,
      "symbols": ["PLTR"],
      "status": "yellow",
      "note": "PLTR has no standing stop-loss or take-profit order."
    }
  },
  "trade_quality": {
    "closed_trades": 12,
    "win_rate": 0.58333,
    "avg_win": 14.22,
    "avg_loss": -8.05,
    "profit_factor": 2.47,
    "largest_win": 31.4,
    "largest_loss": -18.9,
    "total_realized": 59.29,
    "realized_vs_unrealized": {
      "realized": 59.29,
      "unrealized": 21.2
    },
    "avg_holding_period_days": 4.3,
    "per_symbol": [
      { "symbol": "NVDA", "realized_gain": 24.1, "closed_trades": 3 },
      { "symbol": "SOFI", "realized_gain": 18.59, "closed_trades": 4 },
      { "symbol": "RIVN", "realized_gain": 12.3, "closed_trades": 2 },
      { "symbol": "F", "realized_gain": 10.7, "closed_trades": 2 },
      { "symbol": "AMD", "realized_gain": -6.4, "closed_trades": 1 }
    ],
    "sample_size_warning": true,
    "sample_size_floor": 20
  },
  "charts": {
    "equity_curve": [
      { "date": "2026-07-20", "total_value": 1021.4, "net_external_flow": 0 },
      { "date": "2026-07-21", "total_value": 1033.75, "net_external_flow": 0 },
      { "date": "2026-07-22", "total_value": 1028.6, "net_external_flow": 0 },
      { "date": "2026-07-23", "total_value": 1044.2, "net_external_flow": 0 },
      { "date": "2026-07-24", "total_value": 1050.0, "net_external_flow": 0 }
    ],
    "realized_pnl_daily": [
      { "date": "2026-07-20", "realized_gain": 8.15, "number_of_trades": 2 },
      { "date": "2026-07-21", "realized_gain": null, "number_of_trades": 1 },
      { "date": "2026-07-22", "realized_gain": -6.4, "number_of_trades": 1 },
      { "date": "2026-07-23", "realized_gain": 12.3, "number_of_trades": 2 },
      { "date": "2026-07-24", "realized_gain": null, "number_of_trades": 1 }
    ],
    "benchmark_spy_close": [
      { "date": "2026-07-20", "close": 638.42 },
      { "date": "2026-07-21", "close": 641.07 },
      { "date": "2026-07-22", "close": 639.85 },
      { "date": "2026-07-23", "close": 644.31 },
      { "date": "2026-07-24", "close": 645.9 }
    ]
  },
  "snapshot_log": {
    "latest_date": "2026-07-24",
    "last_trading_day": "2026-07-24",
    "is_stale": false
  }
}
```

