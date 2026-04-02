/**
 * capture.ts — TradingView screenshot and chart capture tools.
 */

import type { ToolDefinition } from "../types.js";
import { asObject, asOptionalString, textResult, imageResult } from "../types.js";
import { screenshot, evaluate, findTradingViewTab } from "../connection.js";

async function requireTvTab(): Promise<string> {
  const tab = await findTradingViewTab();
  if (!tab) throw new Error("TradingView is not open. Use tv_open first.");
  return tab.id;
}

export const captureTools: ToolDefinition[] = [
  {
    name: "tv_screenshot",
    description:
      "Take a screenshot of the TradingView chart. Returns the image as base64 PNG.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "Region to capture: 'chart' (chart area only), 'full' (entire page). Default: chart.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const input = asObject(args, "tv_screenshot arguments");
      const region = (asOptionalString(input.region) ?? "chart").trim().toLowerCase();
      if (!["chart", "full"].includes(region)) {
        throw new Error("region must be either 'chart' or 'full'.");
      }
      const tabId = await requireTvTab();

      const base64 = await screenshot(tabId);

      if (!base64) {
        return textResult("Failed to capture screenshot — no image data returned.");
      }

      return imageResult(base64, "image/png");
    },
  },

  {
    name: "tv_export_image",
    description:
      "Use TradingView's built-in chart export to get a high-quality chart image with indicators and drawings preserved.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();

      // Try to trigger TradingView's native screenshot/export
      const result = await evaluate(`(() => {
        try {
          // Method 1: Widget API takeScreenshot
          const chart = window._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
          if (chart && chart.takeScreenshot) {
            chart.takeScreenshot();
            return { triggered: true, method: 'api', note: 'Screenshot triggered via TV API. Check downloads or clipboard.' };
          }
        } catch {}

        // Method 2: Click the camera/screenshot button
        try {
          const cameraBtn = document.querySelector('[data-name="take-screenshot"], [aria-label="Take a snapshot"]');
          if (cameraBtn) {
            cameraBtn.click();
            return { triggered: true, method: 'button_click', note: 'Screenshot button clicked.' };
          }
        } catch {}

        return { triggered: false, note: 'Could not trigger TV export. Use tv_screenshot for a browser screenshot instead.' };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },
];
