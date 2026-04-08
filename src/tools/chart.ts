/**
 * chart.ts — TradingView chart control tools.
 *
 * These tools manipulate the TradingView chart: symbol, timeframe, chart type,
 * and read current chart state.
 */

import type { ToolDefinition } from "../types.js";
import { asObject, asOptionalString, asString, textResult } from "../types.js";
import { evaluate } from "../connection.js";
import { getLivePageState, requireTradingViewTab } from "./live-page.js";

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
      const tabId = await requireTradingViewTab();
      const state = await getLivePageState(tabId);
      return textResult(JSON.stringify({
        symbol: state.symbol,
        exchange: state.exchange,
        interval: state.interval,
        chartType: state.chartType,
        indicators: state.indicators,
        drawingCount: null,
        lastBar: state.lastBar,
        url: state.url,
        ready: state.ready,
        pathUsed: state.pathUsed,
        warnings: state.warnings,
        diagnostics: state.diagnostics,
      }, null, 2));
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
      const tabId = await requireTradingViewTab();

      const fullSymbol = exchange ? `${exchange}:${symbol}` : symbol;

      const result = await evaluate(`(() => {
        const fullSymbol = ${JSON.stringify(fullSymbol)};

        try {
          const api = window.TradingViewApi;
          const chart = api?.activeChart?.();
          if (chart?.setSymbol) {
            chart.setSymbol(fullSymbol);
            return { method: 'tradingview_api', symbol: fullSymbol, success: true };
          }
        } catch {}

        try {
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (chart?.setSymbol) {
            chart.setSymbol(fullSymbol);
            return { method: 'widget_collection', symbol: fullSymbol, success: true };
          }
        } catch {}

        try {
          const searchBtn = document.querySelector('[data-name="legend-source-item"] button, [aria-label="Symbol Search"]');
          if (searchBtn) {
            searchBtn.click();
            return { method: 'search_opened', symbol: fullSymbol, success: false, hint: 'Search opened but symbol not set programmatically. Type the symbol name.' };
          }
        } catch {}

        return { method: 'url', symbol: fullSymbol, success: false, hint: 'Will navigate via URL' };
      })();`, tabId);

      const res = result as { method: string; success: boolean; symbol: string; hint?: string };

      if (!res.success && res.method === "url") {
        const { navigateTab } = await import("../connection.js");
        const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(fullSymbol)}`;
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
      "Change the chart timeframe/interval. Common values: 1, 5, 15, 30, 60, 240, D, W, M (minutes for numbers, D=daily, W=weekly, M=monthly). Returns whether the requested interval was actually observed after the change.",
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
      const tabId = await requireTradingViewTab();

      const attempt = await evaluate(`(() => {
        const targetInterval = ${JSON.stringify(interval)};
        const warnings = [];
        let pathUsed = 'none';

        try {
          const api = window.TradingViewApi;
          const chart = api?.activeChart?.();
          if (chart?.setResolution) {
            chart.setResolution(targetInterval);
            pathUsed = 'tradingview_api';
            return { accepted: true, requestedInterval: targetInterval, pathUsed, warnings };
          }
        } catch (error) {
          warnings.push('TradingViewApi setResolution failed: ' + (error?.message || String(error)));
        }

        try {
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (chart?.setResolution) {
            chart.setResolution(targetInterval);
            pathUsed = 'widget_collection';
            return { accepted: true, requestedInterval: targetInterval, pathUsed, warnings };
          }
        } catch (error) {
          warnings.push('Widget collection setResolution failed: ' + (error?.message || String(error)));
        }

        try {
          const buttons = Array.from(document.querySelectorAll('[data-value], button[data-value]'));
          const match = buttons.find((button) => button.getAttribute('data-value') === targetInterval || button.textContent?.trim() === targetInterval);
          if (match instanceof HTMLElement) {
            match.click();
            pathUsed = 'dom';
            return { accepted: true, requestedInterval: targetInterval, pathUsed, warnings };
          }
        } catch (error) {
          warnings.push('DOM timeframe click failed: ' + (error?.message || String(error)));
        }

        warnings.push('Could not find a live TradingView timeframe control.');
        return { accepted: false, requestedInterval: targetInterval, pathUsed, warnings };
      })();`, tabId) as { accepted: boolean; requestedInterval: string; pathUsed: string; warnings: string[] };

      await new Promise((r) => setTimeout(r, 500));
      const state = await getLivePageState(tabId);
      const success = !!attempt.accepted && state.interval === interval;

      return textResult(JSON.stringify({
        success,
        requestedInterval: interval,
        actualInterval: state.interval,
        symbol: state.symbol,
        pathUsed: attempt.pathUsed,
        verificationPath: state.pathUsed === 'tradingview_api' && state.diagnostics.getSymbolInterval ? 'getSymbolInterval' : state.pathUsed,
        warnings: success ? attempt.warnings : [...attempt.warnings, `Requested ${interval} but observed ${state.interval ?? 'unknown'}.`],
      }, null, 2));
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
      const tabId = await requireTradingViewTab();

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
          const api = window.TradingViewApi;
          const chart = api?.activeChart?.();
          if (chart?.setChartType) {
            chart.setChartType(${typeNum});
            return { success: true, chartType: ${JSON.stringify(chartType)}, pathUsed: 'tradingview_api' };
          }
        } catch {}
        try {
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (chart?.setChartType) {
            chart.setChartType(${typeNum});
            return { success: true, chartType: ${JSON.stringify(chartType)}, pathUsed: 'widget_collection' };
          }
        } catch {}
        return { success: false, chartType: ${JSON.stringify(chartType)}, pathUsed: 'none', hint: 'Chart type API not available' };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },
];
