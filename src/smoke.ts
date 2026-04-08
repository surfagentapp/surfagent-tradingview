import { TOOL_SET, createTradingViewServer } from "./server.js";

const EXPECTED_TOOLS = [
  "tv_health_check",
  "tv_open",
  "tv_chart_state",
  "tv_set_symbol",
  "tv_set_timeframe",
  "tv_set_chart_type",
  "tv_quote",
  "tv_ohlcv",
  "tv_indicators",
  "tv_study_values",
  "tv_screenshot",
  "tv_export_image",
  "tv_alert_list",
  "tv_alert_create",
  "tv_draw_horizontal",
  "tv_drawings_list",
  "tv_drawings_clear",
  "tv_pine_open_editor",
  "tv_pine_set_source",
  "tv_pine_compile",
  "tv_pine_get_errors",
  "tv_watchlist",
  "tv_watchlist_add",
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main() {
  const toolNames = TOOL_SET.map((tool) => tool.name);
  const uniqueNames = new Set(toolNames);

  assert(toolNames.length === uniqueNames.size, "Duplicate tool names detected.");

  for (const name of EXPECTED_TOOLS) {
    assert(toolNames.includes(name), `Missing expected tool: ${name}`);
  }

  for (const tool of TOOL_SET) {
    assert(typeof tool.description === "string" && tool.description.trim().length > 0, `Tool ${tool.name} is missing a description.`);
    assert(tool.inputSchema?.type === "object", `Tool ${tool.name} must expose an object input schema.`);
    assert(typeof tool.handler === "function", `Tool ${tool.name} is missing a handler.`);
  }

  const server = createTradingViewServer();
  assert(!!server, "Failed to create MCP server instance.");

  console.log(JSON.stringify({ ok: true, toolCount: toolNames.length, toolNames }, null, 2));
}

main();
