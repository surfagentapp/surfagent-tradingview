/**
 * data.ts — TradingView data extraction tools.
 *
 * Get real-time quotes, OHLCV data, and indicator/study values from the chart.
 */

import type { ToolDefinition } from "../types.js";
import { asObject, asOptionalNumber, textResult } from "../types.js";
import { evaluate } from "../connection.js";
import { getLivePageState, requireTradingViewTab } from "./live-page.js";

export const dataTools: ToolDefinition[] = [
  {
    name: "tv_quote",
    description:
      "Get the current quote for the active chart symbol. Returns structured OHLCV data when the live chart API is available, otherwise a degraded DOM-derived quote with warnings.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTradingViewTab();
      const state = await getLivePageState(tabId);

      if (state.lastBar) {
        return textResult(JSON.stringify({
          symbol: state.symbol,
          interval: state.interval,
          exchange: state.exchange,
          ...state.lastBar,
          pathUsed: state.pathUsed,
          warnings: state.warnings,
        }, null, 2));
      }

      const quote = await evaluate(`(() => {
        const warnings = [];
        try {
          const priceEl = document.querySelector('[class*="lastPrice"], [class*="quote-last"], [data-name="legend-last-value"]');
          const changeEl = document.querySelector('[class*="change"], [class*="quoteChange"]');
          const symbolEl = document.querySelector('[data-symbol-short], [data-name="legend-source-item"]');

          const price = priceEl?.textContent?.trim() || null;
          const change = changeEl?.textContent?.trim() || null;
          const symbol = symbolEl?.getAttribute?.('data-symbol-short') || symbolEl?.textContent?.trim() || null;

          if (price) {
            warnings.push('Quote derived from DOM, not live chart API. Fields may be partial or formatted strings.');
            return { symbol, price, change, pathUsed: 'dom', warnings };
          }
        } catch (error) {
          warnings.push('DOM quote lookup failed: ' + (error?.message || String(error)));
        }

        warnings.push('Could not extract quote data.');
        return { error: 'Could not extract quote data', pathUsed: 'none', warnings };
      })();`, tabId);

      return textResult(JSON.stringify({
        symbol: state.symbol,
        interval: state.interval,
        exchange: state.exchange,
        diagnostics: state.diagnostics,
        ...((quote as Record<string, unknown>) ?? {}),
        warnings: [...state.warnings, ...((((quote as Record<string, unknown>)?.warnings as string[] | undefined) ?? []))],
      }, null, 2));
    },
  },

  {
    name: "tv_ohlcv",
    description:
      "Get OHLCV (Open, High, Low, Close, Volume) bar data from the current chart. Returns the last N bars.",
    inputSchema: {
      type: "object",
      properties: {
        bars: {
          type: "number",
          description: "Number of bars to return (default 50, max 500)",
        },
        format: {
          type: "string",
          description: "Output format: 'full' (all fields) or 'summary' (stats only). Default: full.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const input = asObject(args, "tv_ohlcv arguments");
      const requestedBars = asOptionalNumber(input.bars) ?? 50;
      if (!Number.isInteger(requestedBars) || requestedBars <= 0) {
        throw new Error("bars must be a positive integer.");
      }
      const numBars = Math.min(requestedBars, 500);
      const format = (typeof input.format === "string" ? input.format : "full").toLowerCase();
      if (!["full", "summary"].includes(format)) {
        throw new Error("format must be either 'full' or 'summary'.");
      }
      const tabId = await requireTradingViewTab();

      const data = await evaluate(`(() => {
        const numBars = ${numBars};
        const format = ${JSON.stringify(format)};

        try {
          const api = window.TradingViewApi;
          const chart = api?.activeChart?.() || window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (!chart) return { error: 'Chart API not available' };

          const series = chart.getSeries?.();
          if (!series) return { error: 'Series not available' };

          const data = series.data?.();
          if (!data) return { error: 'Series data not available' };

          const first = data.first?.();
          const barCount = series.barsCount?.() || 0;
          const firstIndex = typeof first?.index === 'number' ? first.index : null;
          if (firstIndex == null || barCount <= 0) return { error: 'No bar data available' };

          const startOffset = Math.max(0, barCount - numBars);
          const bars = [];

          for (let offset = startOffset; offset < barCount; offset++) {
            const tuple = data.valueAt?.(firstIndex + offset);
            if (Array.isArray(tuple)) {
              bars.push({
                time: tuple[0],
                open: tuple[1],
                high: tuple[2],
                low: tuple[3],
                close: tuple[4],
                volume: tuple[5] ?? null
              });
            }
          }

          if (format === 'summary') {
            const closes = bars.map(b => b.close).filter(v => typeof v === 'number');
            const highs = bars.map(b => b.high).filter(v => typeof v === 'number');
            const lows = bars.map(b => b.low).filter(v => typeof v === 'number');
            const volumes = bars.map(b => b.volume).filter(v => typeof v === 'number');
            return {
              symbol: chart.symbol?.(),
              interval: chart.resolution?.(),
              barCount: bars.length,
              firstTime: bars[0]?.time,
              lastTime: bars[bars.length - 1]?.time,
              lastClose: closes[closes.length - 1],
              high: highs.length ? Math.max(...highs) : null,
              low: lows.length ? Math.min(...lows) : null,
              avgVolume: volumes.length ? volumes.reduce((a, b) => a + b, 0) / volumes.length : null,
              changePercent: closes.length >= 2 && closes[0] !== 0
                ? ((closes[closes.length - 1] - closes[0]) / closes[0] * 100).toFixed(2) + '%'
                : null,
              source: 'series_api'
            };
          }

          return {
            symbol: chart.symbol?.(),
            interval: chart.resolution?.(),
            barCount: bars.length,
            bars,
            source: 'series_api'
          };
        } catch (e) {
          return {
            error: 'Failed to extract OHLCV: ' + (e instanceof Error ? e.message : String(e))
          };
        }
      })();`, tabId);

      return textResult(JSON.stringify(data, null, 2));
    },
  },

  {
    name: "tv_indicators",
    description:
      "List all active indicators/studies on the chart with their current values.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTradingViewTab();

      const indicators = await evaluate(`(() => {
        try {
          const api = window.TradingViewApi;
          const chart = api?.activeChart?.() || window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (!chart) return { error: 'Chart API not available' };

          const studies = chart.getAllStudies?.() || [];
          const result = studies.map(study => {
            const info = {
              id: study.id,
              name: study.name || study.title || '',
              type: study.type || '',
              visible: true
            };

            try {
              const source = chart.getStudyById?.(study.id);
              if (source) {
                const data = source.data?.();
                if (data) {
                  info.values = data;
                }
              }
            } catch {}

            return info;
          });

          return { indicators: result, count: result.length, source: 'api' };
        } catch {}

        try {
          const legends = Array.from(document.querySelectorAll('[class*="sourcesWrapper"] [class*="sources"]'));
          const result = legends.map((el, i) => ({
            index: i,
            name: el.querySelector('[class*="title"]')?.textContent?.trim() || '',
            values: Array.from(el.querySelectorAll('[class*="valuesWrapper"] span'))
              .map(s => s.textContent?.trim())
              .filter(Boolean)
          }));
          return { indicators: result, count: result.length, source: 'dom' };
        } catch {}

        return { error: 'Could not extract indicator data' };
      })();`, tabId);

      return textResult(JSON.stringify(indicators, null, 2));
    },
  },

  {
    name: "tv_study_values",
    description:
      "Get the current values of a specific indicator/study by name (e.g. 'RSI', 'MACD', 'EMA 20'). Returns computed values at the last bar.",
    inputSchema: {
      type: "object",
      properties: {
        studyName: {
          type: "string",
          description: "Name of the study/indicator (e.g. 'RSI', 'MACD', 'Bollinger Bands')",
        },
      },
      required: ["studyName"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const input = asObject(args, "tv_study_values arguments");
      const studyName = typeof input.studyName === "string" ? input.studyName.trim() : "";
      if (!studyName) {
        throw new Error("studyName must be a non-empty string.");
      }
      const tabId = await requireTradingViewTab();

      const result = await evaluate(`(() => {
        const needle = ${JSON.stringify(studyName)}.toLowerCase();

        try {
          const api = window.TradingViewApi;
          const chart = api?.activeChart?.() || window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (!chart) return { error: 'Chart API not available' };

          const studies = chart.getAllStudies?.() || [];
          const match = studies.find(s =>
            (s.name || s.title || '').toLowerCase().includes(needle) ||
            (s.type || '').toLowerCase().includes(needle)
          );

          if (!match) {
            return {
              error: 'Study not found: ' + ${JSON.stringify(studyName)},
              available: studies.map(s => s.name || s.title || s.type).filter(Boolean)
            };
          }

          const source = chart.getStudyById?.(match.id);
          let values = null;
          try {
            values = source?.data?.() || source?.lastValueData?.() || null;
          } catch {}

          return {
            id: match.id,
            name: match.name || match.title || '',
            type: match.type || '',
            values,
            source: 'api'
          };
        } catch {}

        try {
          const legends = Array.from(document.querySelectorAll('[class*="sourcesWrapper"] [class*="sources"]'));
          const match = legends.find(el => {
            const title = el.querySelector('[class*="title"]')?.textContent?.trim() || '';
            return title.toLowerCase().includes(needle);
          });

          if (match) {
            return {
              name: match.querySelector('[class*="title"]')?.textContent?.trim() || '',
              values: Array.from(match.querySelectorAll('[class*="valuesWrapper"] span'))
                .map(s => s.textContent?.trim())
                .filter(Boolean),
              source: 'dom'
            };
          }
        } catch {}

        return { error: 'Study not found: ' + ${JSON.stringify(studyName)} };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },
];
