/**
 * health.ts — TradingView health check & connection verification tools.
 */

import type { ToolDefinition } from "../types.js";
import { asObject, asOptionalString, textResult } from "../types.js";
import { findTradingViewTab, evaluate, listTabs, navigateTab } from "../connection.js";

export const healthTools: ToolDefinition[] = [
  {
    name: "tv_health_check",
    description:
      "Check if TradingView is open in the SurfAgent browser and the chart widget is accessible. Returns status, URL, symbol info, and chart readiness.",
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

      // Check if the TradingView chart widget is loaded
      const state = await evaluate(`(() => {
        const w = window;
        const hasWidget = !!(w.TradingView || w.tvWidget || document.querySelector('.chart-container, .layout__area--center'));
        const hasApi = !!(w._exposed_chartWidgetCollection || w.TradingView?.activeChart);

        // Try to get current symbol from various TradingView internal paths
        let symbol = null;
        let interval = null;
        let chartType = null;

        try {
          // Path 1: Widget API
          const chart = w._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (chart) {
            symbol = chart.symbol?.() || null;
            interval = chart.resolution?.() || null;
            chartType = String(chart.chartType?.() || '');
          }
        } catch {}

        if (!symbol) {
          try {
            // Path 2: DOM scraping
            const symbolEl = document.querySelector('[data-symbol-short], .chart-controls-bar .apply-common-tooltip');
            symbol = symbolEl?.textContent?.trim() || null;

            const intervalEl = document.querySelector('[data-value][class*="isActive"], .chart-controls-bar button[class*="isActive"]');
            interval = intervalEl?.getAttribute('data-value') || intervalEl?.textContent?.trim() || null;
          } catch {}
        }

        return {
          hasWidget,
          hasApi,
          symbol,
          interval,
          chartType,
          url: window.location.href,
          title: document.title,
        };
      })();`, tab.id);

      return textResult(
        JSON.stringify({
          status: "connected",
          tabId: tab.id,
          ...(state as Record<string, unknown>),
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

      // Check if TV is already open
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
      // Wait for chart to load
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
