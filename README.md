# surfagent-tradingview

TradingView adapter for [SurfAgent](https://surfagent.app).

This adapter gives AI agents TradingView-focused chart tools so they can work with symbols, timeframes, indicators, drawings, alerts, watchlists, and Pine Script from the SurfAgent browser.

## What this adapter is for

Use `surfagent-tradingview` when you need workflows like:
- opening TradingView in the managed browser
- checking chart state
- changing symbol or timeframe
- changing chart type
- reading quotes and OHLCV data
- inspecting indicators and study values
- exporting screenshots
- creating alerts
- managing drawings
- editing and compiling Pine Script
- reading and updating the watchlist

## Why this exists

The base `surfagent-mcp` gives generic browser control.

This adapter adds TradingView-specific verbs so an agent can say:
- `tv_set_timeframe`
- `tv_set_symbol`
- `tv_quote`
- `tv_alert_create`
- `tv_pine_compile`

instead of doing everything through raw browser clicks.

Some tools are stronger than others:
- API-backed / stronger: chart state, symbol or timeframe changes, data reads, drawings
- UI-backed / best-effort: alerts, Pine editor workflows, watchlist workflows

That distinction matters. TradingView still exposes some surfaces only through the live web UI, so this adapter stays honest about best-effort operations instead of pretending every tool is equally native.

## Default operating mode

TradingView should be treated as a **state-first** surface.

That means:
- trust adapter chart state, quote, OHLCV, indicator, drawing, and Pine outputs before screenshots
- use screenshots or perception mainly for rendered-chart proof, modal confirmation, or premium-gate diagnosis
- avoid turning structured chart tasks into screenshot-only guesswork

If the question is “what does the chart look like?”, visual proof matters. If the question is “what symbol, timeframe, or study state is active?”, adapter state should usually win.

## Tool groups

### Health and setup
- `tv_health_check`
- `tv_open`

### Chart control
- `tv_chart_state`
- `tv_set_symbol`
- `tv_set_timeframe`
- `tv_set_chart_type`

### Data extraction
- `tv_quote`
- `tv_ohlcv`
- `tv_indicators`
- `tv_study_values`

### Screenshots
- `tv_screenshot`
- `tv_export_image`

### Alerts
- `tv_alert_list`
- `tv_alert_create`

These are best-effort UI helpers. They inspect or open the visible alerts UI, but they are not a guaranteed hidden-alert inventory or full alert-creation API.

### Drawings
- `tv_draw_horizontal`
- `tv_drawings_list`
- `tv_drawings_clear`

### Pine Script
- `tv_pine_open_editor`
- `tv_pine_set_source`
- `tv_pine_compile`
- `tv_pine_get_errors`

These operate through TradingView's visible Pine editor UI. They do not use a native Pine API.

### Watchlist
- `tv_watchlist`
- `tv_watchlist_add`

These are UI-backed and depend on the currently visible TradingView watchlist surface.

## Prerequisites

1. install the SurfAgent app
2. start the SurfAgent browser
3. have Node.js 20+
4. have a TradingView account if your workflow needs logged-in features

If you are new to SurfAgent, start here first:
- <https://github.com/surfagentapp/surfagent-docs/blob/main/docs/start-here.md>
- <https://github.com/surfagentapp/surfagent-docs/blob/main/docs/mcp-server.md>
- <https://github.com/surfagentapp/surfagent-docs/blob/main/docs/skills-and-adapters.md>

## How to use it

Run this adapter alongside the base SurfAgent MCP.

```json
{
  "mcpServers": {
    "surfagent": {
      "command": "npx",
      "args": ["-y", "surfagent-mcp"]
    },
    "surfagent-tradingview": {
      "command": "npx",
      "args": ["-y", "surfagent-tradingview"]
    }
  }
}
```

## Environment variables

- `SURFAGENT_DAEMON_URL` default: `http://127.0.0.1:7201`
- `SURFAGENT_AUTH_TOKEN` optional override, otherwise auto-detected

## When to use this vs skills vs raw MCP

- use `surfagent-mcp` for raw browser control
- use `surfagent-skills` for execution discipline and workflow rules
- use `surfagent-tradingview` when you want TradingView-aware tools instead of rebuilding the workflow from raw browser actions each time

Practical rule:
- chart/data problem -> adapter first
- rendered visual proof problem -> adapter plus screenshot/perception
- one-off unsupported UI probe -> targeted browser control

## Why SurfAgent instead of TradingView Desktop-only automation

- works with TradingView web in real Chrome
- keeps sessions and auth in the SurfAgent browser profile
- avoids forcing users into a separate desktop-only automation target
- pairs cleanly with the wider SurfAgent toolchain

## Related repos

- [surfagent](https://github.com/surfagentapp/surfagent)
- [surfagent-mcp](https://github.com/surfagentapp/surfagent/tree/main/surfagent-mcp)
- [surfagent-docs](https://github.com/surfagentapp/surfagent-docs)
- [surfagent-skills](https://github.com/surfagentapp/surfagent-skills)

## License

MIT
