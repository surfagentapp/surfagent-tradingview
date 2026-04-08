/**
 * watchlist.ts — TradingView watchlist management tools.
 */

import type { ToolDefinition } from "../types.js";
import { asObject, asString, textResult } from "../types.js";
import { evaluate, findTradingViewTab } from "../connection.js";

async function requireTvTab(): Promise<string> {
  const tab = await findTradingViewTab();
  if (!tab) throw new Error("TradingView is not open. Use tv_open first.");
  return tab.id;
}

export const watchlistTools: ToolDefinition[] = [
  {
    name: "tv_watchlist",
    description: "Inspect the currently visible TradingView watchlist surface and extract any visible symbols and quick stats. This is a UI-backed best-effort read.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();

      const result = await evaluate(`(async () => {
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
        try {
          if (!document.querySelector('[data-name="add-symbol-button"], [aria-label="Add symbol"]')) {
            click('[data-name="base"]');
            await wait(100);
            click('[data-name="watchlists-button"]');
            await wait(250);
          }

          const rows = Array.from(document.querySelectorAll('[data-name="symbol-list-wrap"] [data-symbol-short], [data-name="symbol-list-wrap"] [data-symbol-full], .widgetbar-widget-watchlist [data-symbol-short], .widgetbar-widget-watchlist [data-symbol-full]')).slice(0, 100);
          const seen = new Set();
          const symbols = rows.map((row, index) => {
            const rawText = (row.textContent || '').trim().replace(/\s+/g, ' ');
            const symbol = row.getAttribute('data-symbol-short')
              || row.getAttribute('data-symbol-full')
              || row.querySelector?.('[data-name="list-item-title"]')?.textContent?.trim()
              || rawText.match(/[A-Z][A-Z0-9._:-]{1,19}/)?.[0]
              || rawText.split(/\s+/)[0]
              || '';
            const last = rawText.match(/[-+]?\d[\d,]*(?:\.\d+)?/)?.[0] || null;
            const changePercent = rawText.match(/[-+−]?\d+(?:\.\d+)?%/)?.[0] || null;
            return {
              index,
              symbol: symbol.toUpperCase(),
              rawText,
              last,
              changePercent,
            };
          }).filter((row) => {
            if (!row.symbol || !/^[A-Z0-9._:-]{2,20}$/.test(row.symbol) || seen.has(row.symbol)) return false;
            seen.add(row.symbol);
            return true;
          });

          return {
            symbols,
            count: symbols.length,
            panelVisible: !!document.querySelector('[data-name="symbol-list-wrap"], .widgetbar-widget-watchlist'),
            pathUsed: 'dom:data-symbol-short',
            warnings,
          };
        } catch (error) {
          warnings.push(error?.message || String(error));
          return { symbols: [], count: 0, panelVisible: false, pathUsed: 'none', warnings };
        }
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },

  {
    name: "tv_watchlist_add",
    description: "Attempt to add a symbol through TradingView's visible watchlist add-symbol dialog, then check whether it appears in the visible watchlist.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Symbol to add (e.g. BTCUSD, AAPL)" },
      },
      required: ["symbol"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const input = asObject(args, "tv_watchlist_add arguments");
      const symbol = asString(input.symbol, "symbol").trim().toUpperCase();
      const tabId = await requireTvTab();

      const result = await evaluate(`(async () => {
        const symbol = ${JSON.stringify(symbol)};
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
        const findVisibleSymbol = () => Array.from(document.querySelectorAll('[data-name="symbol-list-wrap"] [data-symbol-short], [data-name="symbol-list-wrap"] [data-symbol-full], .widgetbar-widget-watchlist [data-symbol-short], .widgetbar-widget-watchlist [data-symbol-full]'))
          .map((el) => (el.getAttribute('data-symbol-short') || el.getAttribute('data-symbol-full') || '').trim().toUpperCase())
          .filter(Boolean)
          .includes(symbol);

        try {
          if (findVisibleSymbol()) {
            return { success: true, symbol, pathUsed: 'already_visible', dialogVisible: false, nowVisibleInWatchlist: true, warnings };
          }

          let addOpened = click('[data-name="add-symbol-button"]') || click('[aria-label="Add symbol"]');
          if (!addOpened) {
            click('[data-name="base"]');
            await wait(100);
            if (!document.querySelector('[data-name="add-symbol-button"], [aria-label="Add symbol"]')) {
              click('[data-name="watchlists-button"]');
              await wait(150);
            }
            addOpened = click('[data-name="add-symbol-button"]') || click('[aria-label="Add symbol"]');
          }
          if (!addOpened) {
            return { success: false, symbol, pathUsed: 'none', warnings, hint: 'Could not find watchlist add button' };
          }

          await wait(300);
          const input = document.querySelector('[data-name="watchlist-symbol-search-dialog"] input[data-qa-id="symbol-search-input"], [data-name="watchlist-symbol-search-dialog"] input, input[placeholder*="Symbol"], input[placeholder*="CUSIP"], input[placeholder*="ISIN"]');
          if (!(input instanceof HTMLInputElement)) {
            return { success: false, symbol, pathUsed: 'watchlist_dialog', warnings, hint: 'Watchlist symbol search input was not found' };
          }

          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (!setter) {
            throw new Error('Input value setter not available');
          }
          setter.call(input, symbol);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await wait(500);

          const results = Array.from(document.querySelectorAll('[data-name="watchlist-symbol-search-dialog"] [data-name="symbol-search-dialog-content-item"]'));
          const matchedResult = results.find((row) => {
            const title = row.querySelector('[data-name="list-item-title"]')?.textContent?.trim()?.toUpperCase() || '';
            const text = (row.textContent || '').trim().replace(/\s+/g, ' ').toUpperCase();
            return title === symbol || text.includes(symbol);
          });
          if (matchedResult instanceof HTMLElement) {
            matchedResult.click();
          } else if (results[0] instanceof HTMLElement) {
            results[0].click();
          } else {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
          }
          await wait(1200);

          return {
            success: findVisibleSymbol(),
            symbol,
            pathUsed: 'watchlist_dialog',
            dialogVisible: !!document.querySelector('[data-name="watchlist-symbol-search-dialog"]'),
            nowVisibleInWatchlist: findVisibleSymbol(),
            warnings,
          };
        } catch (error) {
          warnings.push(error?.message || String(error));
          return { success: false, symbol, pathUsed: 'none', warnings };
        }
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },
];
