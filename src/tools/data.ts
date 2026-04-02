/**
 * data.ts — TradingView data extraction tools.
 *
 * Get real-time quotes, OHLCV data, and indicator/study values from the chart.
 */

import type { ToolDefinition } from "../types.js";
import { asObject, asOptionalNumber, textResult } from "../types.js";
import { evaluate, findTradingViewTab } from "../connection.js";

async function requireTvTab(): Promise<string> {
  const tab = await findTradingViewTab();
  if (!tab) throw new Error("TradingView is not open. Use tv_open first.");
  return tab.id;
}

export const dataTools: ToolDefinition[] = [
  {
    name: "tv_quote",
    description:
      "Get the current real-time quote for the active chart symbol: price, change, volume, bid/ask, high/low.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();

      const quote = await evaluate(`(() => {
        // Try widget API
        try {
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (chart) {
            const symbol = chart.symbol?.() || '';
            const resolution = chart.resolution?.() || '';

            // Get last bar data
            const series = chart.getSeries?.();
            if (series) {
              const bars = series.bars?.();
              const lastBar = bars?.last?.();
              if (lastBar) {
                return {
                  symbol,
                  resolution,
                  open: lastBar.open,
                  high: lastBar.high,
                  low: lastBar.low,
                  close: lastBar.close,
                  volume: lastBar.volume,
                  time: lastBar.time,
                  source: 'series_api'
                };
              }
            }
          }
        } catch {}

        // DOM scraping fallback — get price from the legend/header
        try {
          // Price from the chart header
          const priceEl = document.querySelector('[class*="lastPrice"], [class*="quote-last"]');
          const changeEl = document.querySelector('[class*="change"], [class*="quoteChange"]');
          const symbolEl = document.querySelector('[data-symbol-short]');

          const price = priceEl?.textContent?.trim() || null;
          const change = changeEl?.textContent?.trim() || null;
          const symbol = symbolEl?.textContent?.trim() || symbolEl?.getAttribute('data-symbol-short') || null;

          if (price) {
            return { symbol, price, change, source: 'dom' };
          }
        } catch {}

        // Last resort: scrape the legend values
        try {
          const legendValues = Array.from(document.querySelectorAll('[class*="valuesAdditionalWrapper"] span, [class*="legendValues"] span'));
          const values = legendValues.map(el => el.textContent?.trim()).filter(Boolean);
          if (values.length >= 4) {
            return {
              open: values[0],
              high: values[1],
              low: values[2],
              close: values[3],
              volume: values[4] || null,
              source: 'legend_dom'
            };
          }
        } catch {}

        return { error: 'Could not extract quote data', source: 'none' };
      })();`, tabId);

      return textResult(JSON.stringify(quote, null, 2));
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
      const tabId = await requireTvTab();

      const data = await evaluate(`(() => {
        const numBars = ${numBars};
        const format = ${JSON.stringify(format)};

        try {
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (!chart) return { error: 'Chart API not available' };

          const series = chart.getSeries?.();
          if (!series) return { error: 'Series not available' };

          const allBars = series.bars?.();
          if (!allBars) return { error: 'Bars not available' };

          // Get the last N bars
          const barCount = allBars.size?.() || 0;
          const startIdx = Math.max(0, barCount - numBars);
          const bars = [];

          for (let i = startIdx; i < barCount; i++) {
            const bar = allBars.valueAt?.(i);
            if (bar) {
              bars.push({
                time: bar.time,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume
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
      const tabId = await requireTvTab();

      const indicators = await evaluate(`(() => {
        try {
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (!chart) return { error: 'Chart API not available' };

          const studies = chart.getAllStudies?.() || [];
          const result = studies.map(study => {
            const info = {
              id: study.id,
              name: study.name || study.title || '',
              type: study.type || '',
              visible: true
            };

            // Try to get current values
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

        // DOM fallback
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
      const tabId = await requireTvTab();

      const result = await evaluate(`(() => {
        const needle = ${JSON.stringify(studyName)}.toLowerCase();

        try {
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
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

        // DOM fallback
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
