---
name: "trading-skill-v4"
description: "Execute profitable trades in your designated Agentic Account using Robinhood MCP, with standing protective orders (stop-loss or take-profit) on positions, a tunable HORIZON_BIAS scale between short-term trading and long-term holding, a screen that blocks new leveraged/inverse ETF positions (e.g. TQQQ, SQQQ, SOXL), a GitHub-backed default risk parameter config (config/risk-parameters.json in HappypsychoX/Trading-Agent, with hardcoded fallback), and a cross-session note that carries reasoning and goals forward to tomorrow. This is the V4 successor to trading-skill-v3 — use it whenever the user wants to run the trading agent, execute trades, let Claude trade autonomously, start an agentic trading session, asks Claude to buy/sell stocks in the Agentic Account, or specifically mentions \"V4\", \"trading skill v4\", protective/stop-loss/take-profit orders, horizon bias, leveraged ETF rules, risk parameters, or wants the agent to remember its reasoning between sessions."
---

## Division of Responsibility

This skill defines the trading framework and **default parameters**. The invoking prompt (e.g., a scheduled session) defines timing, session-specific limits, and output format. Where the invoking prompt sets a parameter explicitly, it overrides the default here. Where it is silent, the GitHub-sourced or hardcoded defaults below apply (see "Loading Default Risk Parameters").

## Loading Default Risk Parameters (do this first, before Step 0)

The table in "Default Risk Parameters" below is the **hardcoded fallback**. The authoritative source is `config/risk-parameters.json` in the `HappypsychoX/Trading-Agent` GitHub repo (branch `main`), published by the Default Risk Parameters dashboard artifact when the user tunes settings. Fetch it fresh every session — never reuse a value you fetched in a prior session, and never assume it hasn't changed since last time.

1. **Get a GitHub token.** Look for a `github.json` secrets file (shape `{"github": {"token": "ghp_..."}}`) in a connected folder — this is the same credential the `trading-report` skill uses. If you don't have a connected folder containing it yet, you may request one named `secrets` via folder-access request. If none exists or isn't reachable (e.g. running unattended with no one to grant access), skip straight to step 4 (hardcoded fallback) — do not block the session over this.
2. **Fetch the file** via the shell:
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
     "https://api.github.com/repos/HappypsychoX/Trading-Agent/contents/config/risk-parameters.json?ref=main"
   ```
   Decode the base64 `content` field to get the JSON.
3. **Validate and apply, field by field.** Expected keys and how they map to the parameters below:
   - `MAX_NEW_POSITIONS_PER_SESSION` (integer)
   - `MAX_POSITION_SIZE_PCT` (number, % of account equity)
   - `MAX_BUYING_POWER_DEPLOYED_PER_SESSION_PCT` (number, % of available buying power)
   - `CASH_RESERVE_FLOOR_PCT` (number, % of account equity)
   - `INSTRUMENTS` (`"equities_only"` or `"equities_and_options"`)
   - `DEFAULT_ORDER_TYPE` (`"limit_day"`, `"limit_gtc"`, or `"market"`)
   - `LIQUIDITY_RULE_MAX_PCT_ADV` (number — max order size as % of average daily volume)
   - `HORIZON_BIAS` (integer 1–5)
   - `LEVERAGED_INSTRUMENTS_BLOCKED` (boolean)

   If the file is present and a key is well-formed, it **replaces** the corresponding hardcoded default for this session only. If a key is missing or malformed, keep the hardcoded default for just that key — don't discard the whole file over one bad field.
4. **Fall back cleanly on any failure** — 404, network error, auth error, malformed JSON, or no reachable secrets file. Never let this block or fail the session: use the hardcoded table in full, and say so plainly in the Step 5 report.
5. **Record the source either way** in the Step 5 report — whether this session ran on GitHub-sourced parameters (with a fetch timestamp) or the hardcoded fallback (with the reason it fell back) — so the user can tell which was actually in effect.

This fetch is **read-only** against GitHub. This skill never writes to `risk-parameters.json` — publishing changes is the dashboard artifact's job, via the user asking Claude to push an update from the dashboard. A trading session only ever reads the file.

**Portability note:** this step never hardcodes a filesystem path or username — it only checks whatever folder happens to be connected in Cowork on the current machine. That's what lets the same skill text run correctly across PCs with different usernames.

## Default Risk Parameters (hardcoded fallback)

| Parameter | Default |
|---|---|
| MAX_NEW_POSITIONS_PER_SESSION | 3 |
| MAX_POSITION_SIZE | 30% of account equity |
| MAX_BUYING_POWER_DEPLOYED_PER_SESSION | 50% of available buying power |
| CASH_RESERVE_FLOOR | 5% of account equity — never spend below this |
| INSTRUMENTS | Equities only (no options) unless the invoking prompt says otherwise |
| DEFAULT_ORDER_TYPE | Limit order, day time-in-force |
| LIQUIDITY_RULE | Your order must be a trivial fraction of the symbol's average daily volume |
| PROTECTIVE_ORDER_POLICY | Agent judgment, per position. No fixed stop/target percentage — set levels from the actual setup (support/resistance, volatility, thesis invalidation point) and document why. At most **one** standing protective order per position at a time (see Step 3B). Not GitHub-configurable — this stays agent judgment by design. |
| HORIZON_BIAS | 3 on a 1–5 scale (1 = scalper, 5 = buy-and-hold). See "Horizon Bias" below. |
| LEVERAGED_INSTRUMENTS | Not permitted as **new** positions. See "Leveraged Instrument Screen" below. |

These are circuit breakers, not strategy. Strategy adapts and learns; these exist because a single session has no memory and cannot self-correct mid-flight. Precedence, highest to lowest: **invoking prompt override → GitHub `config/risk-parameters.json` → hardcoded table above.**

## Horizon Bias

HORIZON_BIAS (1–5, default 3) tunes where you sit between short-term trading and long-term holding. It's a single dial, not a formula — use it to inform judgment across sizing, protective orders, turnover, and which signals you weight most, per the table below.

| Level | Sizing | Protective orders | Turnover | Signal weighting |
|---|---|---|---|---|
| 1 — Scalper | Smaller size, high-liquidity names only | Tight stops; take profits quickly on strength | Days; frequent rotation is fine | Momentum, relative volume, technical breakouts |
| 2 | Leans toward level 1 | Leans tight | Days to ~1 week | Leans technical |
| 3 — Balanced (default) | Full range within existing caps | Judgment-based on the setup, no lean either way | Weeks | Mix of technical and fundamental |
| 4 | Leans toward level 5 | Leans wide | Weeks to a couple months | Leans fundamental |
| 5 — Buy-and-hold | Larger, conviction sizing within MAX_POSITION_SIZE | Wide stops off real support; reluctant to take profit early on a thesis still playing out | Months; avoid churn | Fundamentals, valuation, multi-quarter trend |

Treat the setting as static for the session — don't drift it mid-session based on what you're finding. If conditions argue for a different posture than the current setting, say so explicitly in your report (Step 5) rather than silently overriding it; the invoking prompt or the GitHub config can adjust it next session. Record each position's intended horizon in the note (Step 4) so "Watch for" can distinguish a dip worth exiting from expected noise at that horizon.

## Leveraged Instrument Screen

No **new** positions in leveraged or inverse products — 2x/3x daily-reset ETFs and ETNs such as TQQQ, SQQQ, SOXL, SOXS, UPRO, SPXU, SPXL, TNA, TZA, LABU, LABD, FAS, FAZ, UVXY, SVXY, TMF, TMV, and similar. These decay against you on anything but a straight directional move and don't fit either end of the HORIZON_BIAS scale honestly — they're structurally unsuited to holding, which is the opposite of what a screen like this is for.

Apply this before the tradability check in Step 2, for every candidate:

1. **Name/description check** (primary defense): if the symbol's name or description — from `search` or `get_equity_fundamentals` — contains markers like "2x", "3x", "Ultra", "UltraPro", "Daily Bull", "Daily Bear", "Inverse", or "Leveraged", reject it.
2. **Blocklist backstop**: cross-check against known leveraged/inverse tickers (see list above). Treat this as a floor, not exhaustive — new leveraged products launch regularly, so the name check does most of the work.
3. Log any rejection under SKIPPED/REJECTED with reason "leveraged/inverse product — excluded by policy."

This rule applies to **new entries only**. A leveraged position already held from before this rule existed is not force-closed — manage it to exit per its own thesis and protective order, and note in Step 4 that it's a legacy holding being wound down rather than a new addition. If you're ever unsure whether a symbol qualifies, treat it as leveraged and skip it — the cost of a missed trade is far lower than the cost of compounding decay in an autonomous account.

## Step 0 — Read Yesterday's Note (mandatory, before anything else)

You have no memory of prior sessions, but you have a **note your past self left you**. Read it before touching the account.

1. Look for `position-notes.md` in your connected notes folder. You need the exact filesystem path, not just a folder name — Cowork tells you this path directly when a folder is connected (e.g. "Folder connected: C:\Users\...\Trading Agent Notes"); if you're not sure it's connected or don't have the path, check your currently accessible directories first rather than guessing. In non-Cowork environments, check your working/outputs directory for the same filename. If you truly have no persistent location available, say so in your report — don't invent a path and write there silently.
2. If the file exists, read it in full. It contains, per open position: the thesis, the intended horizon, the plan, whether a protective order is active and why, and what would change your mind. It also has a short session log of recent decisions.
3. If the file does **not** exist, this is either the first session on this skill or notes aren't wired up yet — proceed, and create the file at the end of this session (Step 4).
4. If you have a connected notes location but genuinely cannot write to it, **say so explicitly in your report** rather than silently skipping Step 4 — a note that silently fails to save defeats the entire point of this skill.

Treat the note as informed context, not gospel — prices and conditions move. If the note's thesis for a position no longer holds given current data, say so and update it; don't just carry it forward unexamined.

## Step 1 — Establish Session State (mandatory)

Rebuild live account state — the note tells you what you were thinking, this tells you what's actually true right now:

1. Call `get_accounts` and identify the **Agentic Account**. Record its **account number** and pass it explicitly on every subsequent call — never rely on a default account.
2. Retrieve portfolio value, cash balance, and available buying power.
3. Retrieve all open positions in the Agentic Account.
4. Retrieve open (unfilled) orders — including any protective orders from prior sessions. For each:
   - If it filled since the last session (check `get_equity_orders` state), reconcile: update the position note, and if it was a protective order, note that the position is now unprotected (or closed) until you decide otherwise.
   - Cancel any that no longer make sense at current prices, and log each cancellation with a reason.
5. Retrieve orders from the last 2 trading days to avoid unknowingly doubling or re-entering a recent position.
6. If any account data looks wrong (unexpected account, inconsistent balances), **stop and report — do not trade through anomalies.**

## Step 2 — Analysis and Decision

- You have full autonomy over strategy: technical, fundamental, momentum, volatility, or combinations, informed by the current HORIZON_BIAS setting. Select any symbols within the liquidity rule and instrument scope.
- Run every candidate through the **Leveraged Instrument Screen** first — reject and move on if it matches, before spending time on tradability or sizing.
- Managing or exiting an **existing position** is as valid a use of a session as opening a new one — evaluate current holdings first, informed by both the note and current data.
- Check tradability (`get_equity_tradability`) for every remaining candidate before sizing.
- `get_earnings_calendar` can return more data than fits a response if called broadly — narrow it (short date window, relevant filters) rather than pulling the whole market's calendar when you just need to check one or two symbols.
- Document a one-line rationale for every decision, including decisions to skip.
- **"No trade today" is a valid, complete outcome.** Never force a trade to have something to report.

### Saved scanners as a candidate source

The account has saved market scanners (screeners) that surface symbols matching a filter set (e.g. relative-volume breakouts, oversold RSI bounces, momentum gainers). These are one input among many, not a required gate — you're free to source ideas from scans, from existing positions, from the earnings calendar, or from your own screening logic, and to weigh them however the evidence warrants.

When you do use scanners:

1. Call `get_scans` to see what's currently saved — titles and filters can change over time, so don't assume the set from a prior session still applies.
2. Call `run_scan` on whichever saved scans are relevant to the strategy you're pursuing this session. Treat the results as a first pass, not a verdict — a symbol appearing in a scan still needs the same leverage screen, tradability check, liquidity check, and rationale as any other candidate.
3. If an existing scan's filters look miscalibrated for current conditions (e.g. producing no results, or results that don't hold up under scrutiny), you can adjust it with `update_scan_filters`/`update_scan_config`, or build a new one with `create_scan` (use `get_scanner_filter_specs` first to see valid filter types). Note in your rationale if you changed a scan, so the user can see what shifted.
4. A scan match is a reason to look closer, not a reason to trade — weigh it alongside fundamentals, technicals, and position context like any other signal.

## Step 3A — Execution Discipline (entries and exits)

For each intended trade:

1. Size the position within the risk parameters, informed by HORIZON_BIAS.
2. Run `review_equity_order` (simulation) first. If the review reports any problem, do not place the order — log the rejection and reason.
3. Only after a clean review, call `place_equity_order` with the explicit Agentic Account number.
4. Record: timestamp (ET), symbol, side, quantity, order type, limit price, rationale.
5. Verify fill status. Note partial fills.

**Hard stops — end the session and report immediately if:**
- Cumulative deployment would exceed MAX_BUYING_POWER_DEPLOYED_PER_SESSION
- Any order call fails twice in a row (never retry a third time)
- Fills or balances returned by the API don't match what you placed

## Step 3B — Protective Orders (stop-loss or take-profit)

Robinhood's order types here are `stop_market`, `stop_limit`, and `limit` — there is no bracket/OCO order that links a stop and a target together. Placing both on the same position at once means two independent live orders; if one fills, the other is still sitting there until a future session notices and cancels it. To avoid that ambiguity, **place at most one standing protective order per position at a time.**

For each position you hold after this session (new or existing):

1. Only place protective orders on FULL (not fractional) shares. Decide whether a standing protective order is warranted right now, informed by HORIZON_BIAS — a low-horizon position more often warrants one; a high-horizon core holding you're actively watching may not. Not every position needs one every session.
2. If you decide it's warranted, choose **one**:
   - **Stop-loss** (`stop_market` or `stop_limit`, sell) — downside protection. Set the trigger from the actual setup: below a support level, below thesis-invalidation, or beyond normal volatility for the name — not an arbitrary round number.
   - **Take-profit** (`limit`, sell) — locks in a target if the thesis has largely played out or you want to bank gains ahead of a known catalyst (e.g. earnings). Set the level from resistance, a valuation target, or a risk/reward point you'd genuinely be satisfied exiting at.
   - Do not place both on the same position. If you already have one type active from a prior session and now want the other, **cancel the existing one first**, then place the new one — don't layer a second order on top.
3. Use `time_in_force: gtc` for protective orders so they survive between sessions (a `gfd` stop-loss expires at the close and leaves the position unprotected overnight, which defeats the purpose).
4. Fractional shares: `place_equity_order`'s fractional-share note ("only on type=market... no short sells") governs fractional *buys*. Selling a fractional quantity you already hold via `stop_market`/`stop_limit`/`limit` is a different case — `review_equity_order` will tell you definitively if a given order is rejected; don't assume a fractional position can't be protected without checking.
5. Run `review_equity_order` before placing, same as any other order.
6. Record in both the trade log and the note (Step 4): which type you chose, the level, and *why* — the reasoning matters more than the number, because it's what lets a future session judge whether the order is still appropriate as conditions change.
7. A position can also legitimately have **no** protective order — say so explicitly in the note rather than leaving it ambiguous whether that was a decision or an oversight.

## Step 4 — Leave a Note for Tomorrow (mandatory, before ending the session)

Write (create or overwrite) `position-notes.md` in the connected notes folder. This is what turns a stateless session into a system with continuity — the next session's Step 0 depends on it.

Use this structure:

```markdown
# Position Notes — Last updated: YYYY-MM-DD HH:MM ET

## Current positions & plan

### SYMBOL — N shares @ $AVG_COST avg cost
- Thesis: why this position exists
- Horizon: intended holding horizon per HORIZON_BIAS (e.g. "3 — balanced, expect multi-week") — note "legacy leveraged holding, winding down" if it predates the Leveraged Instrument Screen
- Plan: what would make you add, hold, or exit; any known upcoming catalyst (earnings date, etc.)
- Protective order: [Stop-loss @ $X (order id) | Take-profit @ $X (order id) | None — reason]
- Watch for: the specific thing that would change your mind

(repeat per open position — remove sections for positions fully closed this session)

## Session log
### YYYY-MM-DD HH:MM ET
- What you did this session and why, in a few lines. Include protective-order changes, HORIZON_BIAS if it differed from default, any leveraged-instrument rejections, and any note updates from Step 0 reconciliation.

(keep the most recent ~10 entries; trim older ones so the file doesn't grow unbounded)
```

If the notes folder isn't accessible, do not fail silently — flag it clearly in your session report (Step 5) so the user knows continuity is broken and can fix the connection before the next session.

## Step 5 — Reporting

Use the output format specified by the invoking prompt if one is given. Otherwise, end with:

```
=== TRADING SESSION SUMMARY ===
Date/time: YYYY-MM-DD HH:MM ET
Account: Agentic Account (#XXXX)
Risk parameters source: [GitHub config/risk-parameters.json, fetched HH:MM ET | hardcoded fallback — reason]
HORIZON_BIAS: N (source: GitHub config | hardcoded default | overridden by invoking prompt)
Trades executed: N
TRADES: [BUY|SELL] SYMBOL x QTY @ $PRICE (status) — rationale
PROTECTIVE ORDERS: [PLACED|CANCELLED] SYMBOL — type @ $price — reason
SKIPPED/REJECTED: SYMBOL — reason (include leveraged/inverse rejections)
Account after: equity $X | cash $X | buying power $X
Note: [saved to position-notes.md | FAILED TO SAVE — see below]
Errors: none | description
===============================
```

## Important Notes

- **Agentic Account only** — verified by account number, not name, on every order
- **Real money** — every order is a real financial action, including protective orders
- **Simulate before placing** — `review_equity_order` precedes every `place_equity_order`, no exceptions
- **One protective order per position, never two** — a stop-loss and a take-profit sitting on the same position simultaneously is not a bracket order here; it's just two orders, and the un-triggered one becomes stale and misleading
- **No new leveraged/inverse positions** — screened before tradability check in Step 2; existing legacy holdings are wound down per their own thesis, not force-closed
- **HORIZON_BIAS is a static session setting** — it informs judgment, it doesn't override the hard risk parameters (MAX_POSITION_SIZE, cash floor, etc.)
- **Risk parameters are GitHub-backed with a hardcoded fallback** — fetched read-only from `config/risk-parameters.json` at the very start of every session; a fetch failure never blocks the session, it just falls back and says so in the report
- **The note is a working document, not a ledger** — it should always reflect current reality; update or remove stale entries rather than letting it accumulate contradictions with the live account state
