# surfagent-tradingview

TradingView adapter for [SurfAgent](https://surfagent.app) — gives AI agents full chart control, Pine Script development, real-time data, alerts, drawings, and watchlist management via MCP.

## What it does

While the base `surfagent-mcp` gives you generic browser control (navigate, click, type, screenshot), this adapter adds **20+ TradingView-specific tools** so your AI agent doesn't need to figure out TradingView's internal DOM or API.

Instead of: *"Find the element with class chart-controls-bar, locate the button for 1H timeframe, click it"*

Just: **`tv_set_timeframe({ interval: "60" })`**

## Tools

### Health & Setup (2)
| Tool | Description |
|------|-------------|
| `tv_health_check` | Check if TradingView is open and chart widget is accessible |
| `tv_open` | Open TradingView in the browser, optionally with a specific symbol |

### Chart Control (4)
| Tool | Description |
|------|-------------|
| `tv_chart_state` | Get current symbol, timeframe, chart type, active indicators |
| `tv_set_symbol` | Change chart symbol (BTCUSD, AAPL, ETHBTC, etc.) |
| `tv_set_timeframe` | Change timeframe (1, 5, 15, 60, 240, D, W, M) |
| `tv_set_chart_type` | Change chart type (candles, line, area, heikin_ashi, etc.) |

### Data Extraction (4)
| Tool | Description |
|------|-------------|
| `tv_quote` | Get real-time price, change, volume for current symbol |
| `tv_ohlcv` | Get OHLCV bar data (last N bars, full or summary format) |
| `tv_indicators` | List all active indicators with current values |
| `tv_study_values` | Get values for a specific indicator (RSI, MACD, etc.) |

### Screenshots (2)
| Tool | Description |
|------|-------------|
| `tv_screenshot` | Take a screenshot of the chart |
| `tv_export_image` | Trigger TradingView's native high-quality chart export |

### Alerts (2)
| Tool | Description |
|------|-------------|
| `tv_alert_list` | List all active alerts |
| `tv_alert_create` | Open alert creation dialog, optionally with price level |

### Drawings (3)
| Tool | Description |
|------|-------------|
| `tv_draw_horizontal` | Draw horizontal line at a price level (support/resistance) |
| `tv_drawings_list` | List all drawings on the chart |
| `tv_drawings_clear` | Remove all drawings |

### Pine Script (4)
| Tool | Description |
|------|-------------|
| `tv_pine_open_editor` | Open the Pine Script editor panel |
| `tv_pine_set_source` | Set Pine Script code in the editor |
| `tv_pine_compile` | Compile and add script to chart |
| `tv_pine_get_errors` | Get compilation errors |

### Watchlist (2)
| Tool | Description |
|------|-------------|
| `tv_watchlist` | Get watchlist symbols and quick stats |
| `tv_watchlist_add` | Add a symbol to the watchlist |

## Prerequisites

1. Install [SurfAgent](https://surfagent.app) — manages Chrome on port 9222
2. Launch SurfAgent and start the browser
3. Node.js 20+
4. A TradingView account (free tier works, Pro unlocks more indicators/alerts)

## Setup

### Claude Code

```bash
claude mcp add surfagent-tradingview -- npx -y surfagent-tradingview
```

### Claude Desktop

Add to config (`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "surfagent-tradingview": {
      "command": "npx",
      "args": ["-y", "surfagent-tradingview"]
    }
  }
}
```

### Cursor

Open **Cursor Settings → MCP** and add:

```json
{
  "mcpServers": {
    "surfagent-tradingview": {
      "command": "npx",
      "args": ["-y", "surfagent-tradingview"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "surfagent-tradingview": {
      "command": "npx",
      "args": ["-y", "surfagent-tradingview"]
    }
  }
}
```

## Use with base SurfAgent MCP

For maximum power, run both MCPs together:

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

The base MCP gives you generic browser tools (navigate, click, type, screenshot, cookies, evaluate). The TradingView adapter adds domain-specific chart intelligence on top.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SURFAGENT_DAEMON_URL` | `http://127.0.0.1:7201` | SurfAgent daemon URL |
| `SURFAGENT_AUTH_TOKEN` | *(auto-detected)* | Daemon auth token (usually auto-read from `~/.surfagent/daemon-token.txt`) |

## How It Works

This adapter connects to SurfAgent's daemon REST API (port 7201) which manages a real Chrome browser. It evaluates JavaScript in TradingView's web app to access the chart widget's internal API (`window._exposed_chartWidgetCollection`).

**Why SurfAgent instead of TradingView Desktop?**
- No need to install TradingView Desktop
- Works with TradingView web (tradingview.com) in any Chrome
- SurfAgent manages browser lifecycle, auth, and persistent sessions
- Lower barrier to entry — just install SurfAgent and go

## Inspired By

[tradingview-mcp](https://github.com/tradesdontlie/tradingview-mcp) by @Tradesdontlie — pioneered the TradingView-as-MCP pattern for TradingView Desktop. We took that concept and made it work with web TradingView via SurfAgent.

## Part of the SurfAgent Ecosystem

| Package | Description |
|---------|-------------|
| [surfagent-mcp](https://www.npmjs.com/package/surfagent-mcp) | Base browser control (21 tools) |
| **surfagent-tradingview** | TradingView chart adapter (21 tools) |
| surfagent-x *(coming soon)* | X/Twitter automation |
| surfagent-github *(coming soon)* | GitHub workflow tools |

## License

MIT
