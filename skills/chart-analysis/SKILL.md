# Skill: TradingView Chart Analysis

Use the surfagent-tradingview MCP tools to perform technical analysis on any chart.

## Workflow

### 1. Setup
```
tv_health_check → verify TradingView is open
tv_open({ symbol: "BTCUSD", exchange: "BINANCE" }) → open if not
```

### 2. Read Chart State
```
tv_chart_state → get current symbol, timeframe, indicators
tv_quote → get real-time price
tv_ohlcv({ bars: 100, format: "summary" }) → get price action summary
```

### 3. Check Indicators
```
tv_indicators → list what's active
tv_study_values({ studyName: "RSI" }) → read RSI value
tv_study_values({ studyName: "MACD" }) → read MACD
```

### 4. Multi-Timeframe Analysis
```
tv_set_timeframe({ interval: "D" }) → daily view
tv_ohlcv({ bars: 50, format: "summary" }) → daily summary
tv_screenshot → capture daily chart

tv_set_timeframe({ interval: "240" }) → 4H view
tv_ohlcv({ bars: 50, format: "summary" }) → 4H summary
tv_screenshot → capture 4H chart

tv_set_timeframe({ interval: "60" }) → 1H view
tv_ohlcv({ bars: 50, format: "summary" }) → 1H summary
```

### 5. Mark Key Levels
```
tv_draw_horizontal({ price: 65000, color: "#4CAF50", label: "Support" })
tv_draw_horizontal({ price: 72000, color: "#F44336", label: "Resistance" })
```

### 6. Set Alerts
```
tv_alert_create({ price: 65000, condition: "crossing_down" })
tv_alert_create({ price: 72000, condition: "crossing_up" })
```

## Analysis Template

When asked to analyze a chart:

1. **Read current state** — symbol, price, timeframe
2. **Get OHLCV summary** — trend direction, range, volume
3. **Check key indicators** — RSI (overbought/oversold), MACD (momentum), moving averages
4. **Multi-timeframe** — daily for trend, 4H for structure, 1H for entries
5. **Identify levels** — support/resistance from price data
6. **Screenshot** — visual confirmation
7. **Summarize** — trend, key levels, indicator confluence, potential setups

## Tips

- Use `format: "summary"` for OHLCV when you need stats, not raw bars
- Always check `tv_health_check` first — TradingView may not be loaded
- Use `tv_screenshot` between analysis steps for visual records
- DOM-based data extraction works even without TradingView Pro features
