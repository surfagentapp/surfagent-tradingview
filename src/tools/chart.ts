/**
 * chart.ts — TradingView chart control tools.
 *
 * These tools manipulate the TradingView chart: symbol, timeframe, chart type,
 * and read current chart state.
 */

import type { ToolDefinition } from "../types.js";
import { asObject, asString, asOptionalString, textResult } from "../types.js";
import { evaluate, findTradingViewTab } from "../connection.js";

async function requireTvTab(): Promise<string> {
  const tab = await findTradingViewTab();
  if (!tab) {
    throw new Error("TradingView is not open. Use tv_open first.");
  }
  return tab.id;
}

/**
 * Internal: Get the active chart object via TradingView's internal API.
 * TradingView web stores the chart widget collection on window.
 */
const GET_CHART_STATE = `(() => {
  const w = window;
  let symbol = null, interval = null, chartType = null, exchange = null;
  let indicators = [], drawings = [];

  // Try internal widget API first
  try {
    const collection = w._exposed_chartWidgetCollection;
    const widget = collection?.getActive?.();
    const chart = widget?.activeChart?.();
    if (chart) {
      symbol = chart.symbol?.() || null;
      interval = chart.resolution?.() || null;
      chartType = String(chart.chartType?.() || '');

      // Get studies/indicators
      try {
        const studies = chart.getAllStudies?.() || [];
        indicators = studies.map(s => ({
          id: s.id,
          name: s.name || s.title || '',
          type: s.type || ''
        }));
      } catch {}

      // Get exchange from symbol info
      try {
        const info = chart.symbolExt?.() || {};
        exchange = info.exchange || info.listed_exchange || null;
      } catch {}
    }
  } catch {}

  // DOM fallback for symbol
  if (!symbol) {
    try {
      const el = document.querySelector('[data-symbol-short]');
      symbol = el?.getAttribute('data-symbol-short') || el?.textContent?.trim() || null;
    } catch {}
  }

  // DOM fallback for interval
  if (!interval) {
    try {
      const el = document.querySelector('[data-value][class*="isActive"]');
      interval = el?.getAttribute('data-value') || el?.textContent?.trim() || null;
    } catch {}
  }

  return {
    symbol,
    exchange,
    interval,
    chartType,
    indicators,
    drawingCount: drawings.length,
    url: window.location.href,
    ready: !!(symbol && interval)
  };
})();`;

export const chartTools: ToolDefinition[] = [
  {
    name: "tv_chart_state",
    description:
      "Get the current TradingView chart state: symbol, timeframe, chart type, active indicators, and drawing count.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();
      const state = await evaluate(GET_CHART_STATE, tabId);
      return textResult(JSON.stringify(state, null, 2));
    },
  },

  {
    name: "tv_set_symbol",
    description:
      "Change the chart symbol (e.g. BTCUSD, AAPL, ETHBTC). Optionally specify exchange.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Symbol to display (e.g. BTCUSD, AAPL)" },
        exchange: { type: "string", description: "Exchange (e.g. BINANCE, NASDAQ). Auto-detected if omitted." },
      },
      required: ["symbol"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const input = asObject(args, "tv_set_symbol arguments");
      const symbol = asString(input.symbol, "symbol");
      const exchange = asOptionalString(input.exchange);
      const tabId = await requireTvTab();

      const fullSymbol = exchange ? `${exchange}:${symbol}` : symbol;

      const result = await evaluate(`(() => {
        const fullSymbol = ${JSON.stringify(fullSymbol)};

        // Method 1: Widget API
        try {
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (chart && chart.setSymbol) {
            chart.setSymbol(fullSymbol);
            return { method: 'api', symbol: fullSymbol, success: true };
          }
        } catch {}

        // Method 2: Search box interaction
        try {
          // Open symbol search
          const searchBtn = document.querySelector('[data-name="legend-source-item"] button, [aria-label="Symbol Search"]');
          if (searchBtn) {
            searchBtn.click();
            return { method: 'search_opened', symbol: fullSymbol, success: false, hint: 'Search opened but symbol not set programmatically. Type the symbol name.' };
          }
        } catch {}

        // Method 3: URL navigation
        return { method: 'url', symbol: fullSymbol, success: false, hint: 'Will navigate via URL' };
      })();`, tabId);

      const res = result as { method: string; success: boolean; symbol: string; hint?: string };

      if (!res.success && res.method === "url") {
        // Fall back to URL navigation
        const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(fullSymbol)}`;
        const { navigateTab } = await import("../connection.js");
        await navigateTab(url, tabId);
        await new Promise((r) => setTimeout(r, 2000));
        return textResult(JSON.stringify({ success: true, symbol: fullSymbol, method: "url_navigate" }, null, 2));
      }

      return textResult(JSON.stringify(res, null, 2));
    },
  },

  {
    name: "tv_set_timeframe",
    description:
      "Change the chart timeframe/interval. Common values: 1, 5, 15, 30, 60, 240, D, W, M (minutes for numbers, D=daily, W=weekly, M=monthly).",
    inputSchema: {
      type: "object",
      properties: {
        interval: { type: "string", description: "Timeframe: 1, 5, 15, 30, 60, 240, D, W, M" },
      },
      required: ["interval"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const input = asObject(args, "tv_set_timeframe arguments");
      const interval = asString(input.interval, "interval");
      if (!/^(?:[1-9]\d{0,3}|D|W|M)$/.test(interval)) {
        throw new Error("interval must be a TradingView resolution like 1, 5, 15, 60, 240, D, W, or M.");
      }
      const tabId = await requireTvTab();

      const result = await evaluate(`(() => {
        const interval = ${JSON.stringify(interval)};

        // Method 1: Widget API
        try {
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (chart && chart.setResolution) {
            chart.setResolution(interval);
            return { success: true, interval, method: 'api' };
          }
        } catch {}

        // Method 2: Click the timeframe button in the toolbar
        try {
          const buttons = Array.from(document.querySelectorAll('[data-value]'));
          const match = buttons.find(b => b.getAttribute('data-value') === interval);
          if (match) {
            match.click();
            return { success: true, interval, method: 'click' };
          }
        } catch {}

        // Method 3: Keyboard shortcut — numbers set timeframe in TV
        return { success: false, interval, hint: 'Could not set timeframe via API or DOM' };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },

  {
    name: "tv_set_chart_type",
    description:
      "Change the chart type. Options: bars, candles, hollow_candles, heikin_ashi, line, area, baseline, renko, kagi, point_figure, line_break, range",
    inputSchema: {
      type: "object",
      properties: {
        chartType: {
          type: "string",
          description: "Chart type: bars, candles, hollow_candles, heikin_ashi, line, area, baseline",
        },
      },
      required: ["chartType"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const input = asObject(args, "tv_set_chart_type arguments");
      const chartType = asString(input.chartType, "chartType");
      const tabId = await requireTvTab();

      const CHART_TYPE_MAP: Record<string, number> = {
        bars: 0, candles: 1, hollow_candles: 9, heikin_ashi: 8,
        line: 2, area: 3, baseline: 10, renko: 4, kagi: 5,
        point_figure: 6, line_break: 7, range: 12,
      };

      const typeNum = CHART_TYPE_MAP[chartType.toLowerCase()];
      if (typeNum === undefined) {
        throw new Error(`Unknown chart type: ${chartType}. Valid: ${Object.keys(CHART_TYPE_MAP).join(", ")}`);
      }

      const result = await evaluate(`(() => {
        try {
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (chart && chart.setChartType) {
            chart.setChartType(${typeNum});
            return { success: true, chartType: ${JSON.stringify(chartType)}, method: 'api' };
          }
        } catch {}
        return { success: false, chartType: ${JSON.stringify(chartType)}, hint: 'Widget API not available' };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },
];
