# surfagent-tradingview

TradingView adapter for [SurfAgent](https://surfagent.app).

This adapter gives AI agents TradingView-native chart tools so they can work with symbols, timeframes, indicators, alerts, drawings, watchlists, and Pine Script without reverse-engineering the UI every run.

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

This adapter adds TradingView-native verbs so an agent can say:
- `tv_set_timeframe`
- `tv_set_symbol`
- `tv_quote`
- `tv_alert_create`
- `tv_pine_compile`

instead of fumbling around with brittle UI selectors.

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

### Drawings
- `tv_draw_horizontal`
- `tv_drawings_list`
- `tv_drawings_clear`

### Pine Script
- `tv_pine_open_editor`
- `tv_pine_set_source`
- `tv_pine_compile`
- `tv_pine_get_errors`

### Watchlist
- `tv_watchlist`
- `tv_watchlist_add`

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
- use `surfagent-tradingview` when you want chart-native tools instead of brittle click choreography

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
