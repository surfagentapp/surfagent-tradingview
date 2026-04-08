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
      "Inspect the currently visible TradingView alerts surface. Returns alert rows when the alerts panel is already open, otherwise reports visible alert UI state without pretending hidden alerts were listed.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();

      const alerts = await evaluate(`(() => {
        const warnings = [];

        try {
          const panel = document.querySelector('.widgetbar-widget-alerts, [data-qa-id="alerts-editor-header-title"], [role="dialog"]');
          const rows = panel
            ? Array.from(panel.querySelectorAll('[class*="alertItem"], [class*="alert-item"], [data-name*="alert-row"], [data-name*="alert-item"]')).slice(0, 100)
            : [];
          const alerts = rows.map((el, index) => ({
            index,
            text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 300),
            active: !el.className.toString().toLowerCase().includes('inactive'),
          })).filter((row) => row.text);

          const emptyState = Array.from((panel || document).querySelectorAll('button, [role="button"]'))
            .map((el) => (el.textContent || '').trim().replace(/\s+/g, ' '))
            .filter(Boolean)
            .slice(0, 20);

          return {
            alerts,
            count: alerts.length,
            panelVisible: !!panel,
            emptyStateHints: emptyState,
            pathUsed: 'dom:alerts-panel',
            warnings,
          };
        } catch (error) {
          warnings.push(error?.message || String(error));
          return { alerts: [], count: 0, panelVisible: false, pathUsed: 'none', warnings };
        }
      })();`, tabId);

      return textResult(JSON.stringify(alerts, null, 2));
    },
  },

  {
    name: "tv_alert_create",
    description:
      "Open TradingView's alert creation dialog and report what became visible. This is a best-effort UI helper, not a guaranteed end-to-end alert creation API.",
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

      const result = await evaluate(`(async () => {
        const price = ${price};
        const condition = ${JSON.stringify(condition)};
        const warnings = [];
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const click = (selector) => {
          const el = document.querySelector(selector);
          if (el instanceof HTMLElement) {
            el.click();
            return true;
          }
          return false;
        };

        let method = 'none';
        if (click('button[aria-label="Create alert"]') || click('[data-name="create-alert"]')) {
          method = 'button:create-alert';
        }
        if (method === 'none' && click('[data-name="alerts"]')) {
          method = 'button:alerts-panel';
        }
        if (method === 'none') {
          try {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', altKey: true, bubbles: true }));
            method = 'keyboard:alt+a';
          } catch (error) {
            warnings.push('Alt+A dispatch failed: ' + (error?.message || String(error)));
          }
        }

        await wait(500);

        const dialog = document.querySelector('[data-qa-id="alerts-editor-header-title"]')?.closest('[role="dialog"]') || document.querySelector('[role="dialog"], .widgetbar-widget-alerts');
        const buttons = Array.from((dialog || document).querySelectorAll('button, [role="button"]'))
          .map((el) => (el.textContent || '').trim().replace(/\s+/g, ' '))
          .filter(Boolean)
          .slice(0, 20);

        let prefillApplied = false;
        if (price !== null) {
          const numericInput = document.querySelector('[role="dialog"] input[data-qa-id*="Input-input"], [role="dialog"] input[type="number"], [role="dialog"] input[inputmode="decimal"], [role="dialog"] input:not([type]), .widgetbar-widget-alerts input[type="number"]');
          if (numericInput instanceof HTMLInputElement) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (setter) {
              setter.call(numericInput, String(price));
              numericInput.dispatchEvent(new Event('input', { bubbles: true }));
              numericInput.dispatchEvent(new Event('change', { bubbles: true }));
              prefillApplied = numericInput.value === String(price);
            }
          } else {
            warnings.push('No alert price field was found to prefill.');
          }
        }

        return {
          opened: !!dialog,
          method,
          condition,
          price,
          prefillApplied,
          dialogVisible: !!dialog,
          visibleButtons: buttons,
          warnings,
        };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },
];
