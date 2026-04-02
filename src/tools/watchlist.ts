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
    description: "Get the current watchlist symbols and their quick stats.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();

      const result = await evaluate(`(() => {
        try {
          const rows = document.querySelectorAll('[class*="watchlist"] [class*="listRow"], [data-name="symbol-list"] [class*="row"]');
          const symbols = Array.from(rows).slice(0, 100).map((row, i) => {
            const symbolEl = row.querySelector('[class*="symbol"], [class*="tickerName"]');
            const priceEl = row.querySelector('[class*="last"], [class*="price"]');
            const changeEl = row.querySelector('[class*="change"]');

            return {
              index: i,
              symbol: symbolEl?.textContent?.trim() || '',
              price: priceEl?.textContent?.trim() || '',
              change: changeEl?.textContent?.trim() || '',
            };
          }).filter(s => s.symbol);

          return { symbols, count: symbols.length, source: 'dom' };
        } catch {}

        return { symbols: [], count: 0, note: 'Watchlist panel may not be visible' };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },

  {
    name: "tv_watchlist_add",
    description: "Add a symbol to the TradingView watchlist.",
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
      const symbol = asString(input.symbol, "symbol");
      const tabId = await requireTvTab();

      const result = await evaluate(`(() => {
        const symbol = ${JSON.stringify(symbol)};

        // Try to find and click the "+" button in watchlist
        try {
          const addBtn = document.querySelector('[class*="watchlist"] [class*="add"], [data-name="add-symbol-button"]');
          if (addBtn) {
            addBtn.click();
            const input = document.querySelector('[class*="search"] input, [data-name="symbol-search-input"]');
            if (input) {
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
              if (!nativeSetter) {
                throw new Error('Input value setter not available');
              }
              nativeSetter.call(input, symbol);
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
              input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
              return { triggered: true, symbol, note: 'Attempted to add symbol to watchlist.' };
            }

            return { triggered: true, symbol, note: 'Watchlist add opened, but symbol input was not found.' };
          }
        } catch {}

        return { triggered: false, symbol, hint: 'Could not find watchlist add button' };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },
];
