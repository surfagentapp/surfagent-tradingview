/**
 * pine.ts — TradingView Pine Script development tools.
 *
 * Write, compile, and apply Pine Script indicators/strategies directly on the chart.
 */

import type { ToolDefinition } from "../types.js";
import { asObject, asString, textResult } from "../types.js";
import { evaluate, findTradingViewTab } from "../connection.js";

async function requireTvTab(): Promise<string> {
  const tab = await findTradingViewTab();
  if (!tab) throw new Error("TradingView is not open. Use tv_open first.");
  return tab.id;
}

export const pineTools: ToolDefinition[] = [
  {
    name: "tv_pine_open_editor",
    description:
      "Open the TradingView Pine Script editor panel. Required before writing or compiling Pine code.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();

      const result = await evaluate(`(() => {
        // Try clicking the Pine Editor tab
        try {
          const tabs = Array.from(document.querySelectorAll('[class*="tabs"] button, [data-name="pine-editor"]'));
          const pineTab = tabs.find(t => (t.textContent || '').toLowerCase().includes('pine'));
          if (pineTab) {
            pineTab.click();
            return { opened: true, method: 'tab_click' };
          }
        } catch {}

        // Try the bottom panel toggle
        try {
          const toggle = document.querySelector('[data-name="pine-editor-toggle"]');
          if (toggle) {
            toggle.click();
            return { opened: true, method: 'toggle' };
          }
        } catch {}

        return { opened: false, hint: 'Pine Editor tab not found. It may already be open or the layout may differ.' };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },

  {
    name: "tv_pine_set_source",
    description:
      "Set the Pine Script source code in the editor. Replaces all existing code. Call tv_pine_open_editor first.",
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "Pine Script source code to set in the editor",
        },
      },
      required: ["code"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const input = asObject(args, "tv_pine_set_source arguments");
      const code = asString(input.code, "code");
      const tabId = await requireTvTab();

      const result = await evaluate(`(() => {
        const code = ${JSON.stringify(code)};

        // Find the CodeMirror / Monaco editor instance
        try {
          // TradingView uses their own editor based on CodeMirror
          const editorEl = document.querySelector('[class*="pine-editor"] .view-lines, [class*="pine-editor"] .CodeMirror');

          // Try CodeMirror API
          const cm = editorEl?.closest('.CodeMirror')?.CodeMirror;
          if (cm) {
            cm.setValue(code);
            return { success: true, method: 'codemirror', lines: code.split('\\n').length };
          }
        } catch {}

        // Try Monaco editor
        try {
          const monacoEditors = window.monaco?.editor?.getEditors?.() || [];
          if (monacoEditors.length > 0) {
            monacoEditors[0].setValue(code);
            return { success: true, method: 'monaco', lines: code.split('\\n').length };
          }
        } catch {}

        // Try textarea fallback
        try {
          const textarea = document.querySelector('[class*="pine-editor"] textarea');
          if (textarea) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            if (!nativeInputValueSetter) {
              throw new Error('Textarea value setter not available');
            }
            nativeInputValueSetter.call(textarea, code);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            return { success: true, method: 'textarea', lines: code.split('\\n').length };
          }
        } catch {}

        return { success: false, hint: 'Could not find Pine Script editor. Make sure it is open (use tv_pine_open_editor).' };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },

  {
    name: "tv_pine_compile",
    description:
      "Compile (Add to Chart) the current Pine Script in the editor. Returns compilation status.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();

      const result = await evaluate(`(() => {
        // Click "Add to Chart" button
        try {
          const buttons = Array.from(document.querySelectorAll('[class*="pine-editor"] button, [class*="scriptEditor"] button'));
          const addBtn = buttons.find(b => {
            const text = (b.textContent || '').toLowerCase();
            return text.includes('add to chart') || text.includes('apply') || text.includes('update');
          });

          if (addBtn) {
            addBtn.click();
            return { triggered: true, method: 'button_click', note: 'Compilation triggered. Check for errors in the editor output.' };
          }
        } catch {}

        return { triggered: false, hint: 'Could not find the compile/add button. The Pine Editor may not be open.' };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },

  {
    name: "tv_pine_get_errors",
    description:
      "Get any compilation errors from the Pine Script editor.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();

      const result = await evaluate(`(() => {
        try {
          // Look for error messages in the Pine editor output
          const errorEls = document.querySelectorAll('[class*="pine-editor"] [class*="error"], [class*="scriptEditor"] [class*="error"], [class*="consoleRow"]');
          const errors = Array.from(errorEls).map(el => ({
            text: (el.textContent || '').trim().slice(0, 500),
            type: el.classList.toString().includes('error') ? 'error' : 'info'
          })).filter(e => e.text);

          return {
            errors,
            hasErrors: errors.some(e => e.type === 'error'),
            count: errors.length
          };
        } catch {}

        return { errors: [], hasErrors: false, count: 0, note: 'Could not read editor output' };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },
];
