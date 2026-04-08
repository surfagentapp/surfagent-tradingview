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

      const result = await evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const click = (selector) => {
          const el = document.querySelector(selector);
          if (el instanceof HTMLElement) {
            el.click();
            return true;
          }
          return false;
        };

        if (document.querySelector('[data-name="pine-dialog"]')) {
          return {
            opened: true,
            method: 'already_open',
            dialogVisible: true,
            hasEditorTextarea: !!document.querySelector('[data-name="pine-dialog"] textarea[aria-label*="Editor content"], [data-name="pine-dialog"] textarea.inputarea, textarea.inputarea'),
          };
        }

        let method = 'none';
        if (click('[data-name="pine-dialog-button"]')) {
          method = 'data-name:pine-dialog-button';
        } else if (click('[aria-label="Pine"]')) {
          method = 'aria:Pine';
        } else if (click('[data-name="pine-editor-toggle"]')) {
          method = 'data-name:pine-editor-toggle';
        }

        await wait(300);
        const dialog = document.querySelector('[data-name="pine-dialog"]');
        return {
          opened: !!dialog,
          method,
          dialogVisible: !!dialog,
          hasEditorTextarea: !!document.querySelector('[data-name="pine-dialog"] textarea[aria-label*="Editor content"], [data-name="pine-dialog"] textarea.inputarea, textarea.inputarea'),
        };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },

  {
    name: "tv_pine_set_source",
    description:
      "Set the Pine Script source code in the visible TradingView Pine editor textarea. This is a DOM-backed editor operation, not a native Pine API.",
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
      const encodedCode = Buffer.from(code, "utf8").toString("base64");
      const tabId = await requireTvTab();

      const result = await evaluate(`(async () => {
        const code = (() => {
          const encoded = ${JSON.stringify(encodedCode)};
          const binary = atob(encoded);
          const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
          return new TextDecoder().decode(bytes);
        })();
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const click = (selector) => {
          const el = document.querySelector(selector);
          if (el instanceof HTMLElement) {
            el.click();
            return true;
          }
          return false;
        };

        if (!document.querySelector('[data-name="pine-dialog"]')) {
          click('[data-name="pine-dialog-button"]');
          await wait(250);
        }

        const textarea = document.querySelector('[data-name="pine-dialog"] textarea[aria-label*="Editor content"], [data-name="pine-dialog"] textarea.inputarea, textarea.inputarea');
        if (!(textarea instanceof HTMLTextAreaElement)) {
          return { success: false, method: 'none', hint: 'Could not find Pine editor textarea. Make sure the editor is open.' };
        }

        textarea.focus();
        textarea.select();
        let method = 'execCommand:insertText';
        try {
          document.execCommand('insertText', false, code);
        } catch {
          method = 'setRangeText';
          textarea.setSelectionRange(0, textarea.value.length);
          textarea.setRangeText(code, 0, textarea.value.length, 'end');
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        await wait(500);

        return {
          success: textarea.value === code,
          method,
          lines: code.split('\\n').length,
          chars: code.length,
          verifiedLength: textarea.value.length,
        };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },

  {
    name: "tv_pine_compile",
    description:
      "Trigger the visible Pine editor's Add to chart or Update on chart action. This reports whether the UI action was triggered, not whether TradingView accepted the script cleanly.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();

      const result = await evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const click = (selector) => {
          const el = document.querySelector(selector);
          if (el instanceof HTMLElement) {
            el.click();
            return true;
          }
          return false;
        };
        const text = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();

        if (!document.querySelector('[data-name="pine-dialog"]')) {
          click('[data-name="pine-dialog-button"]');
          await wait(250);
        }

        let method = 'none';
        const buttons = Array.from(document.querySelectorAll('[data-name="pine-dialog"] button, [data-name="pine-dialog"] [role="button"], button[title="Add to chart"], button[title="Update on chart"], [aria-label="Add to chart"], [aria-label="Update on chart"]'));
        const compileButton = buttons.find((button) => {
          const hay = [text(button), button.getAttribute('aria-label') || '', button.getAttribute('title') || '', button.getAttribute('data-name') || ''].join(' ').toLowerCase();
          return hay.includes('add to chart') || hay.includes('update on chart') || hay.includes('apply') || hay.includes('compile');
        });
        if (compileButton instanceof HTMLElement) {
          compileButton.click();
          method = 'button';
        }

        if (method === 'none') {
          const textarea = document.querySelector('[data-name="pine-dialog"] textarea[aria-label*="Editor content"], textarea.inputarea');
          if (textarea instanceof HTMLTextAreaElement) {
            textarea.focus();
            for (const eventType of ['keydown', 'keyup']) {
              textarea.dispatchEvent(new KeyboardEvent(eventType, { key: 'Enter', code: 'Enter', ctrlKey: true, metaKey: true, bubbles: true }));
            }
            method = 'keyboard:ctrl+enter';
          }
        }

        await wait(500);
        const root = document.querySelector('[data-name="pine-dialog"]') || document;
        const errorEls = Array.from(root.querySelectorAll('[role="alert"], [title="Compilation error"], [class*="error"], [class*="notification"], [class*="message"], [class*="problems"]'));
        const errors = errorEls
          .map((el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 300))
          .filter(Boolean);

        return {
          triggered: method !== 'none',
          method,
          errorCount: errors.length,
          errors,
        };
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },

  {
    name: "tv_pine_get_errors",
    description:
      "Read the currently visible Pine editor messages, warnings, and error badges. This reflects visible UI state, which may include stale messages if TradingView has not cleared them yet.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => {
      const tabId = await requireTvTab();

      const result = await evaluate(`(() => {
        const text = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 500);
        try {
          const root = document.querySelector('[data-name="pine-dialog"]') || document;
          const errorEls = Array.from(root.querySelectorAll('[role="alert"], [title="Compilation error"], [class*="error"], [class*="notification"], [class*="message"], [class*="problems"]'));
          const errors = errorEls
            .map((el) => ({
              text: text(el),
              type: el.className.toString().toLowerCase().includes('error') ? 'error' : 'info',
            }))
            .filter((entry) => entry.text);

          return {
            errors,
            hasErrors: errors.some((entry) => entry.type === 'error'),
            count: errors.length,
            dialogVisible: !!document.querySelector('[data-name="pine-dialog"]'),
          };
        } catch (error) {
          return { errors: [], hasErrors: false, count: 0, dialogVisible: false, note: error?.message || String(error) };
        }
      })();`, tabId);

      return textResult(JSON.stringify(result, null, 2));
    },
  },
];
