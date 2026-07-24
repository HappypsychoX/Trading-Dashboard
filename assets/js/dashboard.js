/**
 * Trading Dashboard — Agentic Account
 * Styled with the Nocturne design system (assets/css/nocturne.css + dashboard.css).
 *
 * DATA CONTRACT
 * -------------
 * This page renders whatever is in ./data/data.json. It never calls the
 * Robinhood MCP directly (GitHub Pages is static). A trading/report session
 * with MCP access is responsible for regenerating data.json in this shape,
 * then committing + pushing it:
 *
 * {
 *   as_of: ISO8601 string (ET offset),
 *   account: { nickname, total_value, equity_value, cash, buying_power, open_positions_count },
 *   daily_pl: { unrealized, realized (nullable), dollars, percent, same_day_open_note },
 *   todays_trades: [{ symbol, side, quantity, dollar_based_amount, fill_price, value, fees, source, realized_gain (nullable), state }],
 *   open_orders: [{ symbol, side, quantity, state, created_at, stale }],
 *   positions: [{ symbol, quantity, avg_cost, cost_basis, current_price, market_value,
 *                 unrealized_pl_dollars, unrealized_pl_percent, today_change_dollars,
 *                 pct_of_portfolio, days_held, protective_order ({type, trigger_price} | null),
 *                 earnings_within_7d, sellable_quantity }],
 *   guardrails: { cash_reserve_floor, buying_power_deployed, position_size, new_positions_today, unprotected_positions },
 *   trade_quality: { scope, closed_trades, win_rate, avg_win, avg_loss, profit_factor, largest_win,
 *                    largest_loss, total_realized, realized_vs_unrealized, avg_holding_period_days,
 *                    per_symbol, sample_size_warning, sample_size_floor },
 *   charts: { realized_pnl_daily: [{date, realized_gain (nullable), number_of_trades}],
 *             equity_curve: [{date, total_value, net_external_flow}],
 *             benchmark_spy_close: [{date, close}] },
 *   snapshot_log: { latest_date, last_trading_day, is_stale }
 * }
 *
 * Never render account numbers, instrument ids, or order UUIDs — nickname only.
 * A null realized/realized_gain renders as "—", never $0.00.
 */

const DATA_URL = "data/data.json";

/* ---------------- Phosphor icons (regular weight, currentColor) ---------------- */

const ICON_PATH = {
  warningCircle: "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z",
  trendUp: "M240,56v64a8,8,0,0,1-16,0V75.31l-82.34,82.35a8,8,0,0,1-11.32,0L96,123.31,29.66,189.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0L136,140.69,212.69,64H168a8,8,0,0,1,0-16h64A8,8,0,0,1,240,56Z",
  trendDown: "M240,128v64a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h44.69L136,107.31l-34.34,34.35a8,8,0,0,1-11.32,0l-72-72A8,8,0,0,1,29.66,58.34L96,124.69l34.34-34.35a8,8,0,0,1,11.32,0L224,172.69V128a8,8,0,0,1,16,0Z",
  shieldCheck: "M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z",
  shieldWarning: "M120,136V96a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,48a12,12,0,1,0-12-12A12,12,0,0,0,128,184ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z",
  checkCircle: "M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z",
  xCircle: "M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z",
  minusCircle: "M176,128a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,128Zm56,0A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z",
  calendar: "M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-96-88v64a8,8,0,0,1-16,0V132.94l-4.42,2.22a8,8,0,0,1-7.16-14.32l16-8A8,8,0,0,1,112,120Zm59.16,30.45L152,176h16a8,8,0,0,1,0,16H136a8,8,0,0,1-6.4-12.8l28.78-38.37A8,8,0,1,0,145.07,132a8,8,0,1,1-13.85-8A24,24,0,0,1,176,136,23.76,23.76,0,0,1,171.16,150.45Z",
};

function iconSvg(name, { size = 14, color } = {}) {
  const style = color ? ` style="color:${color}"` : "";
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"${style}><path d="${ICON_PATH[name]}"/></svg>`;
}

/* ---------------- Formatting ---------------- */

const fmtMoney = (v, opts = {}) => {
  if (v === null || v === undefined) return "—";
  const sign = v < 0 ? "-" : (opts.forceSign && v > 0 ? "+" : "");
  const abs = Math.abs(v);
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtPercent = (v, opts = {}) => {
  if (v === null || v === undefined) return "—";
  const sign = v < 0 ? "-" : (opts.forceSign && v > 0 ? "+" : "");
  return `${sign}${Math.abs(v * 100).toFixed(2)}%`;
};

const fmtDate = (iso) => {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const signClass = (v) => (v > 0 ? "gain" : v < 0 ? "loss" : "null-val");

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v; // only used with trusted static strings (icons), never user data
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

/* ---------------- Header + stat grid ---------------- */

function renderHeader(data) {
  document.getElementById("account-label").textContent = data.account.nickname;
  const asOf = new Date(data.as_of);
  document.getElementById("as-of").textContent =
    `As of ${asOf.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · quotes delayed`;

  document.getElementById("demo-banner").style.display = data._demo_data ? "flex" : "none";

  const staleBanner = document.getElementById("stale-banner");
  const isStale = data.snapshot_log && data.snapshot_log.is_stale;
  staleBanner.style.display = isStale ? "flex" : "none";
  if (isStale) {
    document.getElementById("stale-banner-text").textContent =
      `Snapshot log is stale — newest row is ${data.snapshot_log.latest_date}, last trading day was ${data.snapshot_log.last_trading_day}. Equity curve below may be out of date.`;
  }

  const grid = document.getElementById("stat-grid");
  grid.innerHTML = "";

  const dp = data.daily_pl;
  const dpClass = signClass(dp.dollars);
  const trendIcon = dp.dollars > 0 ? "trendUp" : dp.dollars < 0 ? "trendDown" : "minusCircle";
  const tiles = [
    { label: "Total value", value: fmtMoney(data.account.total_value), hero: true },
    {
      label: "Daily P/L",
      value: fmtMoney(dp.dollars, { forceSign: true }),
      delta: `${iconSvg(trendIcon, { size: 12 })}<span>${escapeHtml(fmtPercent(dp.percent, { forceSign: true }))} today</span>`,
      deltaClass: dpClass,
    },
    { label: "Cash", value: fmtMoney(data.account.cash) },
    { label: "Buying power", value: fmtMoney(data.account.buying_power) },
    { label: "Open positions", value: String(data.account.open_positions_count) },
  ];

  for (const t of tiles) {
    grid.appendChild(
      el("div", { class: "stat-tile" + (t.hero ? " hero" : "") }, [
        el("div", { class: "label" }, t.label),
        el("div", { class: "value" }, t.value),
        t.delta ? el("div", { class: "delta " + (t.deltaClass || ""), html: t.delta }) : null,
      ])
    );
  }
}

/* ---------------- Today's trades / open orders ---------------- */

function renderTradesTables(data) {
  const tbody = document.getElementById("trades-body");
  tbody.innerHTML = "";
  if (!data.todays_trades.length) {
    tbody.appendChild(el("tr", {}, el("td", { colspan: "8", class: "empty-state" }, "No trades today.")));
  }
  for (const t of data.todays_trades) {
    const qty = t.dollar_based_amount != null ? `${fmtMoney(t.dollar_based_amount)}` : t.quantity;
    tbody.appendChild(
      el("tr", {}, [
        el("td", {}, t.symbol),
        el("td", {}, t.side),
        el("td", {}, String(qty)),
        el("td", {}, fmtMoney(t.fill_price)),
        el("td", {}, fmtMoney(t.value)),
        el("td", {}, fmtMoney(t.fees)),
        el("td", {}, el("span", { class: "tag " + (t.source === "agentic" ? "tag-accent" : "tag-neutral") }, t.source)),
        el("td", { class: signClass(t.realized_gain) },
          t.realized_gain == null ? "—" : fmtMoney(t.realized_gain, { forceSign: true })),
      ])
    );
  }

  const openBody = document.getElementById("open-orders-body");
  const openSection = document.getElementById("open-orders-section");
  openBody.innerHTML = "";
  if (!data.open_orders.length) {
    openSection.style.display = "none";
    return;
  }
  openSection.style.display = "block";
  for (const o of data.open_orders) {
    const row = el("tr", { class: o.stale ? "stale-row" : "" }, [
      el("td", {}, o.symbol),
      el("td", {}, o.side),
      el("td", {}, String(o.quantity)),
      el("td", {}, o.state),
      el("td", {}, fmtDate(o.created_at)),
      el("td", { class: "loss", html: o.stale ? iconSvg("warningCircle", { size: 14 }) + " needs attention" : "" }),
    ]);
    openBody.appendChild(row);
  }
}

/* ---------------- Positions ---------------- */

function renderPositions(data) {
  const tbody = document.getElementById("positions-body");
  tbody.innerHTML = "";
  if (!data.positions.length) {
    tbody.appendChild(el("tr", {}, el("td", { colspan: "11", class: "empty-state" }, "No open positions.")));
    return;
  }
  for (const p of data.positions) {
    const protectiveText = p.protective_order
      ? `${p.protective_order.type === "stop_loss" ? "Stop" : "Take-profit"} @ ${fmtMoney(p.protective_order.trigger_price)}`
      : "Unprotected";
    tbody.appendChild(
      el("tr", {}, [
        el("td", {}, p.symbol),
        el("td", {}, String(p.sellable_quantity < p.quantity ? `${p.quantity} (${p.sellable_quantity} sellable)` : p.quantity)),
        el("td", {}, fmtMoney(p.avg_cost)),
        el("td", {}, fmtMoney(p.cost_basis)),
        el("td", {}, fmtMoney(p.current_price)),
        el("td", {}, fmtMoney(p.market_value)),
        el("td", { class: signClass(p.unrealized_pl_dollars) },
          `${fmtMoney(p.unrealized_pl_dollars, { forceSign: true })} (${fmtPercent(p.unrealized_pl_percent, { forceSign: true })})`),
        el("td", { class: signClass(p.today_change_dollars) }, fmtMoney(p.today_change_dollars, { forceSign: true })),
        el("td", {}, fmtPercent(p.pct_of_portfolio)),
        el("td", {}, String(p.days_held)),
        el("td", {}, [
          el("span", {
            class: p.protective_order ? "gain" : "loss",
            html: iconSvg(p.protective_order ? "shieldCheck" : "shieldWarning", { size: 13 }) + " " + escapeHtml(protectiveText),
          }),
          p.earnings_within_7d
            ? el("span", { class: "tag tag-outline", style: "margin-left:6px;", html: iconSvg("calendar", { size: 11 }) + " earnings ≤7d" })
            : null,
        ]),
      ])
    );
  }
}

/* ---------------- Guardrails ---------------- */

function statusFromRatio(ratio) {
  if (ratio >= 1) return "critical";
  if (ratio >= 0.9) return "warning";
  return "green";
}

function renderGuardrails(data) {
  const g = data.guardrails;
  const list = document.getElementById("guardrail-list");
  list.innerHTML = "";

  const cashPct = Math.min(1, g.cash_reserve_floor.floor / Math.max(g.cash_reserve_floor.value, 1));
  list.appendChild(
    guardrailRow(
      "Cash reserve floor",
      `${fmtMoney(g.cash_reserve_floor.value)} / ${fmtMoney(g.cash_reserve_floor.floor)} floor · ${fmtMoney(g.cash_reserve_floor.headroom)} headroom`,
      1 - cashPct,
      g.cash_reserve_floor.status
    )
  );

  list.appendChild(
    guardrailRow(
      "Buying power deployed",
      `${fmtPercent(g.buying_power_deployed.value_pct)} of ${fmtPercent(g.buying_power_deployed.max_pct)} max`,
      g.buying_power_deployed.value_pct / g.buying_power_deployed.max_pct,
      g.buying_power_deployed.status
    )
  );

  const posFlags = g.position_size.flags;
  list.appendChild(
    guardrailRow(
      "Position size",
      posFlags.length ? `${posFlags.length} position(s) over ${fmtPercent(g.position_size.max_pct)} max` : `All positions under ${fmtPercent(g.position_size.max_pct)} max`,
      posFlags.length ? 1 : 0.3,
      posFlags.length ? "critical" : "green",
      posFlags.length ? posFlags.map((f) => `${f.symbol} at ${fmtPercent(f.pct_of_portfolio)}`).join(", ") : null
    )
  );

  list.appendChild(
    guardrailRow(
      "New positions today",
      `${g.new_positions_today.count} of ${g.new_positions_today.max} max`,
      g.new_positions_today.count / Math.max(g.new_positions_today.max, 1),
      statusFromRatio(g.new_positions_today.count / Math.max(g.new_positions_today.max, 1))
    )
  );

  list.appendChild(
    guardrailRow(
      "Unprotected positions",
      g.unprotected_positions.count ? `${g.unprotected_positions.count}: ${g.unprotected_positions.symbols.join(", ")}` : "None",
      g.unprotected_positions.count ? 1 : 0,
      g.unprotected_positions.count ? "warning" : "green"
    )
  );
}

function guardrailRow(label, valueText, fillRatio, status, flagText) {
  const fillClass = status === "critical" ? "loss" : status === "warning" ? "warn" : "";
  const iconName = status === "critical" ? "xCircle" : status === "warning" ? "warningCircle" : "checkCircle";
  const iconColorVar = status === "critical" ? "var(--color-loss)" : status === "warning" ? "var(--color-warn)" : "var(--color-gain)";
  return el("div", { class: "guardrail-row" }, [
    el("div", { class: "g-top" }, [
      el("span", { class: "g-label", html: iconSvg(iconName, { size: 14, color: iconColorVar }) + " " + escapeHtml(label) }),
      el("span", { class: "g-value" }, valueText),
    ]),
    el("div", { class: "meter-track" }, el("div", {
      class: "meter-fill " + fillClass,
      style: `width:${Math.max(0, Math.min(1, fillRatio)) * 100}%`,
    })),
    flagText ? el("div", { class: "flag-list" }, flagText) : null,
  ]);
}

/* ---------------- Trade quality ---------------- */

function renderTradeQuality(data) {
  const tq = data.trade_quality;
  const wrap = document.getElementById("trade-quality-grid");
  wrap.innerHTML = "";
  wrap.setAttribute("data-grey-below-sample", tq.sample_size_warning ? "true" : "false");

  document.getElementById("trade-quality-note").textContent = tq.sample_size_warning
    ? `Based on ${tq.closed_trades} closed trades (agent-only) — below the ${tq.sample_size_floor}-trade floor for a stable win rate. Treat these as noise, not signal.`
    : `Based on ${tq.closed_trades} closed trades (agent-only).`;

  const items = [
    { label: "Closed trades", value: String(tq.closed_trades) },
    { label: "Win rate", value: fmtPercent(tq.win_rate) },
    { label: "Avg win / avg loss", value: `${fmtMoney(tq.avg_win, { forceSign: true })} / ${fmtMoney(tq.avg_loss, { forceSign: true })}` },
    { label: "Profit factor", value: tq.profit_factor.toFixed(2) },
    { label: "Largest win / loss", value: `${fmtMoney(tq.largest_win, { forceSign: true })} / ${fmtMoney(tq.largest_loss, { forceSign: true })}` },
    { label: "Total realized", value: fmtMoney(tq.total_realized, { forceSign: true }) },
    { label: "Realized vs unrealized", value: `${fmtMoney(tq.realized_vs_unrealized.realized, { forceSign: true })} vs ${fmtMoney(tq.realized_vs_unrealized.unrealized, { forceSign: true })}` },
    { label: "Avg holding period", value: `${tq.avg_holding_period_days}d` },
  ];
  for (const it of items) {
    wrap.appendChild(el("div", { class: "stat-tile" }, [el("div", { class: "label" }, it.label), el("div", { class: "value" }, it.value)]));
  }

  const perSymbolBody = document.getElementById("per-symbol-body");
  perSymbolBody.innerHTML = "";
  const sorted = [...tq.per_symbol].sort((a, b) => b.realized_gain - a.realized_gain);
  for (const row of sorted) {
    perSymbolBody.appendChild(
      el("tr", {}, [
        el("td", {}, row.symbol),
        el("td", { class: signClass(row.realized_gain) }, fmtMoney(row.realized_gain, { forceSign: true })),
      ])
    );
  }
}

/* ---------------- Charts (SVG line, crosshair tooltip) ---------------- */

class LineChart {
  constructor(container, { series, width = 640, height = 260, valueFormatter = fmtMoney, indexed = false }) {
    this.container = container;
    this.series = series; // [{ name, color, points: [{date, value}] }]
    this.width = width;
    this.height = height;
    this.padding = { top: 16, right: 16, bottom: 28, left: 56 };
    this.valueFormatter = valueFormatter;
    this.indexed = indexed;
    this.render();
  }

  allDates() {
    return this.series[0].points.map((p) => p.date);
  }

  scales() {
    const dates = this.allDates();
    const values = this.series.flatMap((s) => s.points.map((p) => p.value).filter((v) => v !== null && v !== undefined));
    const zeroFloor = this.indexed ? [] : [0];
    let min = Math.min(...values, ...zeroFloor);
    let max = Math.max(...values, ...zeroFloor);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.1 || 1;
    min -= pad;
    max += pad;
    const innerW = this.width - this.padding.left - this.padding.right;
    const innerH = this.height - this.padding.top - this.padding.bottom;
    const x = (i) => this.padding.left + (dates.length <= 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW);
    const y = (v) => this.padding.top + innerH - ((v - min) / (max - min)) * innerH;
    return { dates, min, max, x, y, innerW, innerH };
  }

  render() {
    const { dates, min, max, x, y, innerH } = this.scales();
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
    svg.setAttribute("role", "img");

    const gridColor = cssVar("--color-neutral-800");
    const mutedColor = cssVar("--color-neutral-500");
    const dividerColor = cssVar("--color-divider");

    // gridlines (4 steps) + y labels
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const v = min + ((max - min) * i) / steps;
      const gy = y(v);
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", this.padding.left);
      line.setAttribute("x2", this.width - this.padding.right);
      line.setAttribute("y1", gy);
      line.setAttribute("y2", gy);
      line.setAttribute("stroke", gridColor);
      line.setAttribute("stroke-width", "1");
      svg.appendChild(line);

      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", this.padding.left - 8);
      label.setAttribute("y", gy + 4);
      label.setAttribute("text-anchor", "end");
      label.setAttribute("font-size", "11");
      label.setAttribute("fill", mutedColor);
      label.textContent = this.indexed ? v.toFixed(1) : fmtMoney(v);
      svg.appendChild(label);
    }

    // baseline zero
    if (!this.indexed && min < 0 && max > 0) {
      const zy = y(0);
      const zline = document.createElementNS(svgNS, "line");
      zline.setAttribute("x1", this.padding.left);
      zline.setAttribute("x2", this.width - this.padding.right);
      zline.setAttribute("y1", zy);
      zline.setAttribute("y2", zy);
      zline.setAttribute("stroke", dividerColor);
      zline.setAttribute("stroke-width", "1");
      svg.appendChild(zline);
    }

    // x labels: first, middle, last
    [0, Math.floor((dates.length - 1) / 2), dates.length - 1].forEach((i) => {
      if (i < 0 || i >= dates.length) return;
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", x(i));
      label.setAttribute("y", this.height - 8);
      label.setAttribute("text-anchor", i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle");
      label.setAttribute("font-size", "11");
      label.setAttribute("fill", mutedColor);
      label.textContent = fmtDate(dates[i]);
      svg.appendChild(label);
    });

    // series lines
    for (const s of this.series) {
      const pts = s.points.filter((p) => p.value !== null && p.value !== undefined);
      if (pts.length < 2) continue;
      const d = pts
        .map((p, idx) => {
          const i = s.points.indexOf(p);
          return `${idx === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`;
        })
        .join(" ");
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", s.color);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("stroke-linecap", "round");
      if (s.dashed) path.setAttribute("stroke-dasharray", "4 3");
      svg.appendChild(path);

      // end dot
      const last = pts[pts.length - 1];
      const li = s.points.indexOf(last);
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("cx", x(li));
      dot.setAttribute("cy", y(last.value));
      dot.setAttribute("r", "4");
      dot.setAttribute("fill", s.color);
      dot.setAttribute("stroke", cssVar("--color-bg"));
      dot.setAttribute("stroke-width", "2");
      svg.appendChild(dot);
    }

    // crosshair
    const crosshair = document.createElementNS(svgNS, "line");
    crosshair.setAttribute("y1", this.padding.top);
    crosshair.setAttribute("y2", this.padding.top + innerH);
    crosshair.setAttribute("stroke", dividerColor);
    crosshair.setAttribute("stroke-width", "1");
    crosshair.setAttribute("opacity", "0");
    svg.appendChild(crosshair);

    // hit layer
    const hit = document.createElementNS(svgNS, "rect");
    hit.setAttribute("x", this.padding.left);
    hit.setAttribute("y", this.padding.top);
    hit.setAttribute("width", this.width - this.padding.left - this.padding.right);
    hit.setAttribute("height", innerH);
    hit.setAttribute("fill", "transparent");
    svg.appendChild(hit);

    this.container.innerHTML = "";
    this.container.appendChild(svg);

    let tooltip = this.container.parentElement.querySelector(".chart-tooltip");
    if (!tooltip) {
      tooltip = el("div", { class: "chart-tooltip" });
      this.container.parentElement.appendChild(tooltip);
    }

    const nearestIndex = (clientX) => {
      const rect = svg.getBoundingClientRect();
      const relX = ((clientX - rect.left) / rect.width) * this.width;
      let best = 0;
      let bestDist = Infinity;
      dates.forEach((_, i) => {
        const dist = Math.abs(x(i) - relX);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      return best;
    };

    const showTooltip = (i) => {
      crosshair.setAttribute("x1", x(i));
      crosshair.setAttribute("x2", x(i));
      crosshair.setAttribute("opacity", "1");

      const rows = this.series
        .map((s) => {
          const v = s.points[i] ? s.points[i].value : null;
          return `<div class="tt-row"><span class="tt-name"><span class="tt-key" style="background:${s.color}"></span>${escapeHtml(s.name)}</span><span class="tt-value">${escapeHtml(v == null ? "—" : this.valueFormatter(v))}</span></div>`;
        })
        .join("");
      tooltip.innerHTML = `<div class="tt-date">${escapeHtml(fmtDate(dates[i]))}</div>${rows}`;
      tooltip.classList.add("visible");

      const wrapRect = this.container.parentElement.getBoundingClientRect();
      const px = (x(i) / this.width) * wrapRect.width;
      tooltip.style.left = Math.min(Math.max(px + 12, 4), wrapRect.width - 170) + "px";
      tooltip.style.top = "8px";
    };

    hit.addEventListener("pointermove", (e) => showTooltip(nearestIndex(e.clientX)));
    hit.addEventListener("pointerleave", () => {
      crosshair.setAttribute("opacity", "0");
      tooltip.classList.remove("visible");
    });
  }
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
}

function buildCumulative(dailyPoints, field) {
  let running = 0;
  return dailyPoints.map((p) => {
    const v = p[field];
    if (v !== null && v !== undefined) running += v;
    return { date: p.date, value: running };
  });
}

function equityDelta(equityCurve) {
  if (!equityCurve.length) return [];
  const start = equityCurve[0].total_value;
  return equityCurve.map((p) => ({ date: p.date, value: p.total_value - start - (p.net_external_flow || 0) }));
}

function indexTo100(points, field) {
  if (!points.length) return [];
  const start = points[0][field];
  return points.map((p) => ({ date: p.date, value: (p[field] / start) * 100 }));
}

function padSeries(referenceDated, points) {
  const byDate = Object.fromEntries(points.map((p) => [p.date, p.value]));
  return referenceDated.map((r) => ({ date: r.date, value: byDate[r.date] ?? null }));
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function renderLegend(containerId, items) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  for (const it of items) {
    const row = document.createElement("span");
    row.className = "key";
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = it.color;
    if (it.dashed) swatch.style.backgroundImage = `linear-gradient(to right, ${it.color} 60%, transparent 60%)`;
    row.appendChild(swatch);
    row.appendChild(document.createTextNode(it.name));
    container.appendChild(row);
  }
}

let chartRangeDays = 30;
let currentData = null;

function renderCharts() {
  const data = currentData;
  const daily = data.charts.realized_pnl_daily.slice(-chartRangeDays);
  const equityFull = data.charts.equity_curve;
  const spyFull = data.charts.benchmark_spy_close;

  const accentColor = cssVar("--color-accent");
  const compareColor = cssVar("--color-chart-compare");

  // Chart A: cumulative realized P/L ($) vs total equity change ($) — one axis, dollars.
  // The account's own line takes the accent; the comparison line takes a neutral
  // grey, per Nocturne's mono scheme (one accent voice, not a second hue).
  const cumRealized = buildCumulative(daily, "realized_gain");
  const eqDelta = equityDelta(equityFull);
  const eqDeltaWindowed = eqDelta.filter((p) => daily.some((d) => d.date === p.date));

  const chartAWrap = document.getElementById("chart-a-wrap");
  new LineChart(chartAWrap, {
    series: [
      { name: "Cumulative realized P/L", color: accentColor, points: cumRealized },
      { name: "Total equity (Δ, flow-adjusted)", color: compareColor, dashed: true, points: eqDeltaWindowed.length ? padSeries(cumRealized, eqDeltaWindowed) : [] },
    ],
    valueFormatter: fmtMoney,
  });
  renderLegend("chart-a-legend", [
    { name: "Cumulative realized P/L", color: accentColor },
    { name: "Total equity (Δ)", color: compareColor, dashed: true },
  ]);
  document.getElementById("chart-a-note").textContent = eqDeltaWindowed.length
    ? ""
    : "Equity curve has no data in this range yet — the daily snapshot log started recently and cannot be backfilled.";

  // Chart B: account (indexed) vs SPY (indexed) — one axis, index value
  const eqIndexed = indexTo100(equityFull, "total_value");
  const spyIndexed = indexTo100(spyFull, "close");
  const chartBWrap = document.getElementById("chart-b-wrap");
  if (eqIndexed.length >= 2) {
    new LineChart(chartBWrap, {
      series: [
        { name: "Account", color: accentColor, points: eqIndexed },
        { name: "SPY", color: compareColor, dashed: true, points: spyIndexed },
      ],
      valueFormatter: (v) => v.toFixed(2),
      indexed: true,
    });
    document.getElementById("chart-b-note").textContent = `Indexed to 100 at ${fmtDate(eqIndexed[0].date)} (start of the snapshot log).`;
  } else {
    chartBWrap.innerHTML = '<div class="empty-state">Not enough snapshot-log history yet to compare against SPY.</div>';
    document.getElementById("chart-b-note").textContent = "";
  }
  renderLegend("chart-b-legend", [
    { name: "Account", color: accentColor },
    { name: "SPY", color: compareColor, dashed: true },
  ]);
}

/* ---------------- Range filter ---------------- */

function initRangeFilter() {
  const inputs = document.querySelectorAll('#chart-range-filter input[name="range"]');
  inputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        chartRangeDays = Number(input.value);
        renderCharts();
      }
    });
  });
}

/* ---------------- Boot ---------------- */

async function boot() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    const data = await res.json();
    currentData = data;
    renderHeader(data);
    renderTradesTables(data);
    renderPositions(data);
    renderGuardrails(data);
    renderTradeQuality(data);
    initRangeFilter();
    renderCharts();
  } catch (err) {
    document.body.innerHTML = `<div class="empty-state">Could not load data/data.json: ${escapeHtml(err.message)}</div>`;
  }
}

document.addEventListener("DOMContentLoaded", boot);
