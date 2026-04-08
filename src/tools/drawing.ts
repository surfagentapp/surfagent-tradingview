/**
 * drawing.ts — TradingView drawing tools: trend lines, horizontals, shapes.
 */

import type { ToolDefinition } from "../types.js";
import { asObject, textResult } from "../types.js";
import { evaluate, findTradingViewTab } from "../connection.js";

async function requireTvTab(): Promise<string> {
  const tab = await findTradingViewTab();
  if (!tab) throw new Error("TradingView is not open. Use tv_open first.");
  return tab.id;
}

export const drawingTools: ToolDefinition[] = [
  {
    name: "tv_draw_horizontal",
    description:
      "Draw a horizontal line at a specific price level on the chart. Useful for marking support/resistance levels.",
    inputSchema: {
      type: "object",
      properties: {
        price: { type: "number", description: "Price level for the horizontal line" },
        color: { type: "string", description: "Line color (e.g. '#FF0000', 'red'). Default: blue." },
        label: { type: "string", description: "Optional label text for the line" },
        lineStyle: { type: "string", description: "Line style: solid, dashed, dotted. Default: solid." },
      },
      required: ["price"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const input = asObject(args, "tv_draw_horizontal arguments");
      const price = typeof input.price === "number" ? input.price : Number.NaN;
      if (!Number.isFinite(price)) {
        throw new Error("price must be a finite number.");
      }
      const color = typeof input.color === "string" ? input.color : "#2196F3";
      const label = typeof input.label === "string" ? input.label : "";
      const lineStyle = typeof input.lineStyle === "string" ? input.lineStyle : "solid";
      if (!["solid", "dashed", "dotted"].includes(lineStyle)) {
        throw new Error("lineStyle must be one of: solid, dashed, dotted.");
      }
      const tabId = await requireTvTab();

      const lineStyleNum = lineStyle === "dashed" ? 1 : lineStyle === "dotted" ? 2 : 0;

      const result = await evaluate(`(() => {
        const price = ${price};
        const color = ${JSON.stringify(color)};
        const label = ${JSON.stringify(label)};
        const lineStyle = ${lineStyleNum};
        const warnings = [];

        const getChart = () => {
          try {
            const chart = window.TradingViewApi?.activeChart?.();
            if (chart) return { chart, pathUsed: 'tradingview_api' };
          } catch (error) {
            warnings.push('TradingViewApi chart lookup failed: ' + (error?.message || String(error)));
          }
          try {
            const chart = window._exposed_chartWidgetCollection?.activeChartWidget?.value?.activeChart?.()
              || window._exposed_chartWidgetCollection?.activeChartWidget?._value?.activeChart?.();
            if (chart) return { chart, pathUsed: 'active_chart_widget' };
          } catch (error) {
            warnings.push('Active widget chart lookup failed: ' + (error?.message || String(error)));
          }
          return { chart: null, pathUsed: 'none' };
        };

        try {
          const { chart, pathUsed } = getChart();
          if (!chart?.createShape) {
            return { success: false, pathUsed, warnings, hint: 'Chart API not available for drawing' };
          }

          const before = chart.getAllShapes?.() || [];
          const shapeId = chart.createShape(
            { price },
            {
              shape: 'horizontal_line',
              overrides: {
                linecolor: color,
                linestyle: lineStyle,
                linewidth: 2,
                showLabel: !!label,
                text: label,
              },
            },
          );
          const after = chart.getAllShapes?.() || [];

          return {
            success: true,
            shapeId,
            price,
            color,
            label,
            pathUsed,
            countBefore: before.length,
            countAfter: after.length,
            warnings,
          };
        } catch (error) {
          return { success: false, pathUsed: 'none', warnings, error: error?.message || String(error) };
        }
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },

  {
    name: "tv_drawings_list",
    description: "List all drawings on the current chart (trend lines, horizontals, shapes, etc.).",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();

      const drawings = await evaluate(`(() => {
        const warnings = [];
        const getChart = () => {
          try {
            const chart = window.TradingViewApi?.activeChart?.();
            if (chart) return { chart, pathUsed: 'tradingview_api' };
          } catch (error) {
            warnings.push('TradingViewApi chart lookup failed: ' + (error?.message || String(error)));
          }
          try {
            const chart = window._exposed_chartWidgetCollection?.activeChartWidget?.value?.activeChart?.()
              || window._exposed_chartWidgetCollection?.activeChartWidget?._value?.activeChart?.();
            if (chart) return { chart, pathUsed: 'active_chart_widget' };
          } catch (error) {
            warnings.push('Active widget chart lookup failed: ' + (error?.message || String(error)));
          }
          return { chart: null, pathUsed: 'none' };
        };

        try {
          const { chart, pathUsed } = getChart();
          if (!chart?.getAllShapes) {
            return { drawings: [], count: 0, pathUsed, warnings, error: 'Chart drawing API not available' };
          }

          const shapes = chart.getAllShapes?.() || [];
          return {
            drawings: shapes.map((shape, index) => ({
              index,
              id: shape?.id ?? null,
              name: shape?.name || shape?.type || '',
              type: shape?.type || '',
            })),
            count: shapes.length,
            pathUsed,
            warnings,
          };
        } catch (error) {
          return { drawings: [], count: 0, pathUsed: 'none', warnings, error: error?.message || String(error) };
        }
      })();`, tabId);

      return textResult(JSON.stringify(drawings, null, 2));
    },
  },

  {
    name: "tv_drawings_clear",
    description: "Remove all drawings from the current chart.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();

      const result = await evaluate(`(() => {
        const warnings = [];
        const getChart = () => {
          try {
            const chart = window.TradingViewApi?.activeChart?.();
            if (chart) return { chart, pathUsed: 'tradingview_api' };
          } catch (error) {
            warnings.push('TradingViewApi chart lookup failed: ' + (error?.message || String(error)));
          }
          try {
            const chart = window._exposed_chartWidgetCollection?.activeChartWidget?.value?.activeChart?.()
              || window._exposed_chartWidgetCollection?.activeChartWidget?._value?.activeChart?.();
            if (chart) return { chart, pathUsed: 'active_chart_widget' };
          } catch (error) {
            warnings.push('Active widget chart lookup failed: ' + (error?.message || String(error)));
          }
          return { chart: null, pathUsed: 'none' };
        };

        try {
          const { chart, pathUsed } = getChart();
          if (chart?.removeAllShapes) {
            const before = chart.getAllShapes?.() || [];
            chart.removeAllShapes();
            const after = chart.getAllShapes?.() || [];
            return { success: true, pathUsed, countBefore: before.length, countAfter: after.length, warnings };
          }

          const action = window._exposed_chartWidgetCollection?.activeChartWidget?._value?._actions?.paneRemoveAllDrawingTools;
          if (action?.execute) {
            action.execute();
            return { success: true, pathUsed: 'action:paneRemoveAllDrawingTools', warnings };
          }

          return { success: false, pathUsed, warnings, hint: 'Chart drawing clear API not available' };
        } catch (error) {
          return { success: false, pathUsed: 'none', warnings, error: error?.message || String(error) };
        }
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },
];
