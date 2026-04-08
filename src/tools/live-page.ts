import { evaluate, findTradingViewTab } from "../connection.js";

export type LivePageState = {
  ready: boolean;
  symbol: string | null;
  interval: string | null;
  chartType: string | null;
  exchange: string | null;
  indicators: Array<Record<string, unknown>>;
  lastBar: Record<string, unknown> | null;
  url: string;
  title: string;
  hasWidget: boolean;
  hasApi: boolean;
  pathUsed: "tradingview_api" | "widget_collection" | "dom" | "none";
  warnings: string[];
  diagnostics: {
    tradingViewApi: boolean;
    widgetCollection: boolean;
    activeChart: boolean;
    getSymbolInterval: boolean;
    domSymbol: boolean;
    domInterval: boolean;
  };
};

export async function requireTradingViewTab(): Promise<string> {
  const tab = await findTradingViewTab();
  if (!tab) {
    throw new Error("TradingView is not open. Use tv_open first.");
  }
  return tab.id;
}

export const LIVE_PAGE_STATE_SCRIPT = `(() => {
  const w = window;
  const warnings = [];
  const diagnostics = {
    tradingViewApi: !!w.TradingViewApi,
    widgetCollection: !!w._exposed_chartWidgetCollection,
    activeChart: false,
    getSymbolInterval: false,
    domSymbol: false,
    domInterval: false,
  };

  const out = {
    ready: false,
    symbol: null,
    interval: null,
    chartType: null,
    exchange: null,
    indicators: [],
    lastBar: null,
    url: w.location.href,
    title: document.title,
    hasWidget: !!(w.TradingViewApi || w.TradingView || w.tvWidget || document.querySelector('.chart-container, .layout__area--center')),
    hasApi: false,
    pathUsed: 'none',
    warnings,
    diagnostics,
  };

  const safeValue = (value) => {
    if (value == null) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    try { return JSON.parse(JSON.stringify(value)); } catch { return String(value); }
  };

  const collectFromChart = (chart, pathUsed) => {
    if (!chart) return false;
    diagnostics.activeChart = true;
    out.hasApi = true;
    out.pathUsed = pathUsed;

    try { out.symbol = safeValue(chart.symbol?.()) || out.symbol; } catch {}
    try { out.interval = safeValue(chart.resolution?.()) || out.interval; } catch {}
    try { out.chartType = safeValue(chart.chartType?.()) || out.chartType; } catch {}
    try {
      const ext = chart.symbolExt?.() || {};
      out.exchange = safeValue(ext.exchange || ext.listed_exchange) || out.exchange;
    } catch {}
    try {
      const studies = chart.getAllStudies?.() || [];
      out.indicators = studies.map((study) => ({
        id: safeValue(study?.id),
        name: safeValue(study?.name || study?.title || ''),
        type: safeValue(study?.type || ''),
      }));
    } catch {}
    try {
      const series = chart.getSeries?.();
      const bars = series?.bars?.();
      const lastBar = bars?.last?.();
      if (lastBar) {
        out.lastBar = {
          time: safeValue(lastBar.time),
          open: safeValue(lastBar.open),
          high: safeValue(lastBar.high),
          low: safeValue(lastBar.low),
          close: safeValue(lastBar.close),
          volume: safeValue(lastBar.volume),
        };
      }
    } catch {}
    return true;
  };

  try {
    const api = w.TradingViewApi;
    const chart = api?.activeChart?.();
    if (chart) {
      collectFromChart(chart, 'tradingview_api');
      try {
        const symbolInterval = api?.getSymbolInterval?.();
        if (symbolInterval) {
          diagnostics.getSymbolInterval = true;
          out.symbol = safeValue(symbolInterval.symbol) || out.symbol;
          out.interval = safeValue(symbolInterval.interval) || out.interval;
        }
      } catch {}
    }
  } catch (error) {
    warnings.push('TradingViewApi lookup failed: ' + (error?.message || String(error)));
  }

  if (out.pathUsed === 'none') {
    try {
      const chart = w._exposed_chartWidgetCollection?.getActive?.()?.activeChart?.();
      if (chart) {
        collectFromChart(chart, 'widget_collection');
      }
    } catch (error) {
      warnings.push('Widget collection lookup failed: ' + (error?.message || String(error)));
    }
  }

  if (!out.symbol) {
    try {
      const symbolEl = document.querySelector('[data-symbol-short], [data-name="legend-source-item"] [title], [data-name="legend-source-item"]');
      const symbol = symbolEl?.getAttribute?.('data-symbol-short') || symbolEl?.getAttribute?.('title') || symbolEl?.textContent?.trim() || null;
      if (symbol) {
        diagnostics.domSymbol = true;
        out.symbol = symbol;
        if (out.pathUsed === 'none') out.pathUsed = 'dom';
      }
    } catch {}
  }

  if (!out.interval) {
    try {
      const intervalEl = document.querySelector('[data-value][class*="isActive"], button[data-value][aria-pressed="true"], [data-name="header-intervals"] button[aria-pressed="true"]');
      const interval = intervalEl?.getAttribute?.('data-value') || intervalEl?.textContent?.trim() || null;
      if (interval) {
        diagnostics.domInterval = true;
        out.interval = interval;
        if (out.pathUsed === 'none') out.pathUsed = 'dom';
      }
    } catch {}
  }

  if (!out.symbol) warnings.push('Active symbol could not be resolved.');
  if (!out.interval) warnings.push('Active interval could not be resolved.');
  if (!out.hasApi) warnings.push('TradingView chart API not detected; DOM fallbacks may be stale.');

  out.ready = !!(out.symbol && out.interval);
  return out;
})();`;

export async function getLivePageState(tabId: string): Promise<LivePageState> {
  return (await evaluate(LIVE_PAGE_STATE_SCRIPT, tabId)) as LivePageState;
}
