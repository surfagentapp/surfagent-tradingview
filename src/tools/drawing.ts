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

        try {
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (chart && chart.createShape) {
            const shapeId = chart.createShape(
              { price: price },
              {
                shape: 'horizontal_line',
                overrides: {
                  linecolor: color,
                  linestyle: lineStyle,
                  linewidth: 2,
                  showLabel: !!label,
                  text: label
                }
              }
            );
            return { success: true, shapeId, price, color, label, method: 'api' };
          }
        } catch (e) {
          return { success: false, error: e.message };
        }

        return { success: false, hint: 'Chart API not available for drawing' };
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
        try {
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (!chart) return { error: 'Chart API not available' };

          const shapes = chart.getAllShapes?.() || [];
          return {
            drawings: shapes.map(s => ({
              id: s.id,
              name: s.name || s.type || '',
              type: s.type || ''
            })),
            count: shapes.length,
            source: 'api'
          };
        } catch (e) {
          return { error: e.message };
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
        try {
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (chart && chart.removeAllShapes) {
            chart.removeAllShapes();
            return { success: true, method: 'api' };
          }
        } catch (e) {
          return { success: false, error: e.message };
        }
        return { success: false, hint: 'Chart API not available' };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },
];
