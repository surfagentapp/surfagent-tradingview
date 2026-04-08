/**
 * health.ts — TradingView health check & connection verification tools.
 */

import type { ToolDefinition } from "../types.js";
import { asObject, asOptionalString, textResult } from "../types.js";
import { findTradingViewTab, navigateTab } from "../connection.js";
import { getLivePageState } from "./live-page.js";

export const healthTools: ToolDefinition[] = [
  {
    name: "tv_health_check",
    description:
      "Check if TradingView is open in the SurfAgent browser and whether the live chart page is actually readable. Returns status, URL, symbol info, readiness, and lightweight diagnostics.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tab = await findTradingViewTab();

      if (!tab) {
        return textResult(
          JSON.stringify({
            status: "not_found",
            message: "TradingView is not open in any browser tab.",
            hint: "Use tv_open to open TradingView, or navigate to tradingview.com/chart manually.",
          }, null, 2)
        );
      }

      const state = await getLivePageState(tab.id);
      return textResult(
        JSON.stringify({
          status: state.ready ? "connected" : "degraded",
          tabId: tab.id,
          url: state.url,
          title: state.title,
          symbol: state.symbol,
          interval: state.interval,
          chartType: state.chartType,
          hasWidget: state.hasWidget,
          hasApi: state.hasApi,
          ready: state.ready,
          pathUsed: state.pathUsed,
          warnings: state.warnings,
          diagnostics: state.diagnostics,
        }, null, 2)
      );
    },
  },

  {
    name: "tv_open",
    description:
      "Open TradingView in the SurfAgent browser. Optionally specify a symbol to open directly.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Symbol to open (e.g. BTCUSD, AAPL, ETHBTC). Opens default chart if omitted.",
        },
        exchange: {
          type: "string",
          description: "Exchange prefix (e.g. BINANCE, NASDAQ, COINBASE). Auto-detected if omitted.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const input = asObject(args, "tv_open arguments");
      const symbol = (asOptionalString(input.symbol) ?? "").trim();
      const exchange = (asOptionalString(input.exchange) ?? "").trim();

      let url = "https://www.tradingview.com/chart/";
      if (symbol) {
        const fullSymbol = exchange ? `${exchange}:${symbol}` : symbol;
        url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(fullSymbol)}`;
      }

      const existing = await findTradingViewTab();
      if (existing) {
        await navigateTab(url, existing.id);
        return textResult(
          JSON.stringify({
            status: "navigated",
            tabId: existing.id,
            url,
            message: "Navigated existing TradingView tab.",
          }, null, 2)
        );
      }

      const tab = await navigateTab(url);
      await new Promise((r) => setTimeout(r, 3000));

      return textResult(
        JSON.stringify({
          status: "opened",
          tabId: tab.id,
          url,
          message: "TradingView opened. Chart may take a few seconds to fully load.",
        }, null, 2)
      );
    },
  },
];
