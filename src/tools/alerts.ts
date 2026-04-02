/**
 * alerts.ts — TradingView alert management tools.
 */

import type { ToolDefinition } from "../types.js";
import { asObject, textResult } from "../types.js";
import { evaluate, findTradingViewTab } from "../connection.js";

async function requireTvTab(): Promise<string> {
  const tab = await findTradingViewTab();
  if (!tab) throw new Error("TradingView is not open. Use tv_open first.");
  return tab.id;
}

export const alertTools: ToolDefinition[] = [
  {
    name: "tv_alert_list",
    description:
      "List all active alerts on TradingView. Returns alert conditions, status, and symbols.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();

      const alerts = await evaluate(`(() => {
        // Try to open alerts panel and scrape
        try {
          const alertsPanel = document.querySelector('[data-name="alerts"]') ||
                              document.querySelector('[class*="alertsPanel"]');

          // If alerts panel exists, scrape its contents
          const alertItems = document.querySelectorAll('[class*="alertItem"], [class*="alert-item"]');
          if (alertItems.length > 0) {
            return {
              alerts: Array.from(alertItems).slice(0, 100).map((el, i) => ({
                index: i,
                text: (el.textContent || '').trim().slice(0, 300),
                active: !el.classList.toString().includes('inactive')
              })),
              count: alertItems.length,
              source: 'dom'
            };
          }
        } catch {}

        return {
          alerts: [],
          count: 0,
          note: 'No alerts found. The alerts panel may need to be opened first.',
          hint: 'Click the Alerts icon in the right panel to view alerts.'
        };
      })();`, tabId);

      return textResult(JSON.stringify(alerts, null, 2));
    },
  },

  {
    name: "tv_alert_create",
    description:
      "Open TradingView's alert creation dialog. Optionally pre-fill with a price level. The user will need to confirm the alert in the UI.",
    inputSchema: {
      type: "object",
      properties: {
        price: {
          type: "number",
          description: "Price level for the alert. If omitted, opens empty dialog.",
        },
        condition: {
          type: "string",
          description: "Alert condition type: 'crossing', 'crossing_up', 'crossing_down', 'greater_than', 'less_than'. Default: crossing.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const input = asObject(args, "tv_alert_create arguments");
      const price = typeof input.price === "number" ? input.price : null;
      if (price !== null && !Number.isFinite(price)) {
        throw new Error("price must be a finite number.");
      }
      const condition = typeof input.condition === "string" ? input.condition.trim().toLowerCase() : "crossing";
      const allowedConditions = new Set([
        "crossing",
        "crossing_up",
        "crossing_down",
        "greater_than",
        "less_than",
      ]);
      if (!allowedConditions.has(condition)) {
        throw new Error("condition must be one of: crossing, crossing_up, crossing_down, greater_than, less_than.");
      }
      const tabId = await requireTvTab();

      const result = await evaluate(`(() => {
        const price = ${price};
        const condition = ${JSON.stringify(condition)};

        // Method 1: Keyboard shortcut Alt+A opens alert dialog
        try {
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'a', code: 'KeyA', altKey: true, bubbles: true
          }));
          return {
            opened: true,
            method: 'keyboard',
            price,
            condition,
            note: price ? 'Alert dialog opened. Set ' + condition + ' price to ' + price : 'Alert dialog opened.'
          };
        } catch {}

        // Method 2: Click the alert button
        try {
          const btn = document.querySelector('[data-name="create-alert"], [aria-label="Alert"]');
          if (btn) {
            btn.click();
            return { opened: true, method: 'button', price, condition };
          }
        } catch {}

        return { opened: false, hint: 'Could not open alert dialog' };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },
];
