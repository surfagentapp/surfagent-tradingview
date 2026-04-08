/**
 * connection.ts — SurfAgent daemon connection layer.
 *
 * Unlike the base surfagent-mcp which uses raw CDP, adapters prefer the
 * daemon REST API for browser control. This gives us auth, lifecycle management,
 * and tab coordination out of the box.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DAEMON_URL = process.env.SURFAGENT_DAEMON_URL ?? "http://127.0.0.1:7201";
const TOKEN_PATH = join(homedir(), ".surfagent", "daemon-token.txt");

let cachedToken: string | null | undefined;

async function readDaemonError(path: string, res: Response): Promise<never> {
  const text = await res.text();
  if (res.status === 401) {
    throw new Error(
      `${path} failed (HTTP 401): Unauthorized. Check SURFAGENT_AUTH_TOKEN or ~/.surfagent/daemon-token.txt.`,
    );
  }
  throw new Error(`${path} failed (HTTP ${res.status}): ${text}`);
}

function getAuthToken(): string | null {
  if (cachedToken !== undefined) return cachedToken;

  const envToken = process.env.SURFAGENT_AUTH_TOKEN?.trim();
  if (envToken) {
    cachedToken = envToken;
    return cachedToken;
  }

  try {
    const raw = readFileSync(TOKEN_PATH, "utf-8").trim();
    if (raw) {
      cachedToken = raw;
      return cachedToken;
    }
  } catch {
    // File doesn't exist
  }

  cachedToken = null;
  return cachedToken;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAuthToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export interface EvalResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface TabInfo {
  id: string;
  title: string;
  url: string;
}

/**
 * Evaluate JavaScript in the browser via the daemon API.
 */
export async function evaluate(expression: string, tabId?: string): Promise<unknown> {
  const body: Record<string, unknown> = { expression };
  if (tabId) body.tabId = tabId;

  const res = await fetch(`${DAEMON_URL}/browser/evaluate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) await readDaemonError("/browser/evaluate", res);

  const data = (await res.json()) as EvalResult;
  if (!data.ok) {
    throw new Error(`Evaluate error: ${data.error ?? "Unknown browser evaluation failure"}`);
  }

  return data.result;
}

/**
 * Navigate a tab to a URL.
 */
export async function navigateTab(url: string, tabId?: string): Promise<TabInfo> {
  const body: Record<string, unknown> = { url };
  if (tabId) body.tabId = tabId;

  const res = await fetch(`${DAEMON_URL}/browser/navigate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) await readDaemonError("/browser/navigate", res);

  const data = (await res.json()) as { ok: boolean; tab?: TabInfo; error?: string };
  if (!data.ok || !data.tab) {
    throw new Error(`Navigate failed: ${data.error ?? "No tab returned by daemon"}`);
  }
  return data.tab;
}

/**
 * Take a screenshot via the daemon.
 */
export async function screenshot(tabId?: string): Promise<string> {
  const body: Record<string, unknown> = {};
  if (tabId) body.tabId = tabId;

  const res = await fetch(`${DAEMON_URL}/browser/screenshot`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) await readDaemonError("/browser/screenshot", res);

  const data = (await res.json()) as { ok: boolean; image?: string; screenshot?: string; error?: string };
  const imageData = data.image ?? data.screenshot;
  if (!data.ok || !imageData) {
    throw new Error(`Screenshot failed: ${data.error ?? "No image data returned by daemon"}`);
  }
  return imageData;
}

/**
 * List open tabs.
 */
export async function listTabs(): Promise<TabInfo[]> {
  const res = await fetch(`${DAEMON_URL}/browser/tabs`, {
    headers: headers(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) await readDaemonError("/browser/tabs", res);

  const data = (await res.json()) as { ok: boolean; tabs?: TabInfo[]; error?: string };
  if (!data.ok) {
    throw new Error(`List tabs failed: ${data.error ?? "Daemon returned an invalid tabs response"}`);
  }
  return data.tabs ?? [];
}

/**
 * Open a new tab.
 */
export async function openTab(url: string): Promise<TabInfo> {
  const res = await fetch(`${DAEMON_URL}/browser/navigate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) await readDaemonError("/browser/navigate", res);

  const data = (await res.json()) as { ok: boolean; tab?: TabInfo; error?: string };
  if (!data.ok || !data.tab) {
    throw new Error(`Open tab failed: ${data.error ?? "No tab returned by daemon"}`);
  }
  return data.tab;
}

/**
 * Close a tab by ID.
 */
export async function closeTab(tabId: string): Promise<void> {
  const res = await fetch(`${DAEMON_URL}/browser/tabs/${tabId}`, {
    method: "DELETE",
    headers: headers(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) await readDaemonError(`/browser/tabs/${tabId}`, res);
}

/**
 * Wait for a condition by polling an expression.
 */
export async function waitFor(
  expression: string,
  timeoutMs = 10_000,
  pollMs = 300,
  tabId?: string,
): Promise<unknown> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(expression, tabId);
    if (result) return result;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`Timed out waiting for condition after ${timeoutMs}ms`);
}

/**
 * Check if TradingView is loaded in any tab.
 */
export async function findTradingViewTab(): Promise<TabInfo | null> {
  const tabs = await listTabs();
  return tabs.find((t) => /tradingview\.com/i.test(t.url)) ?? null;
}
