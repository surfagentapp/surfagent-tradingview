import { TOOL_SET } from "./server.js";
import type { ToolDefinition, ToolResponse } from "./types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectText(response: ToolResponse): string {
  const text = response.content.find((item) => item.type === "text");
  assert(text && "text" in text, "Expected text response content.");
  return text.text;
}

async function expectThrows(label: string, run: () => Promise<unknown>, pattern: RegExp) {
  try {
    await run();
    throw new Error(`${label}: expected throw matching ${pattern}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(pattern.test(message), `${label}: unexpected error \"${message}\"`);
  }
}

async function expectToolError(label: string, tool: ToolDefinition, args: unknown, pattern: RegExp) {
  const response = await tool.handler(args);
  assert(response.isError === true, `${label}: expected MCP error response.`);
  const message = expectText(response);
  assert(pattern.test(message), `${label}: unexpected error response \"${message}\"`);
}

function getTool(name: string): ToolDefinition {
  const tool = TOOL_SET.find((entry) => entry.name === name);
  assert(tool, `Missing tool ${name}`);
  return tool;
}

async function main() {
  const names = TOOL_SET.map((tool) => tool.name);
  assert(new Set(names).size === names.length, "Tool names must be unique.");

  const noArgTools = TOOL_SET.filter((tool) => !(tool.inputSchema.required?.length));
  for (const tool of noArgTools) {
    assert(tool.inputSchema.additionalProperties === false, `${tool.name} should reject unknown args.`);
  }

  await expectThrows("tv_set_symbol missing symbol", async () => {
    await getTool("tv_set_symbol").handler({});
  }, /symbol must be a non-empty string\./i);

  await expectThrows("tv_set_timeframe missing interval", async () => {
    await getTool("tv_set_timeframe").handler({});
  }, /interval must be a non-empty string\./i);

  await expectThrows("tv_set_timeframe bad interval", async () => {
    await getTool("tv_set_timeframe").handler({ interval: "0" });
  }, /interval must be a TradingView resolution/i);

  await expectThrows("tv_set_chart_type bad chartType", async () => {
    await getTool("tv_set_chart_type").handler({ chartType: "banana" });
  }, /Unknown chart type: banana/i);

  await expectThrows("tv_ohlcv bad bars", async () => {
    await getTool("tv_ohlcv").handler({ bars: 0 });
  }, /bars must be a positive integer\./i);

  await expectThrows("tv_ohlcv bad format", async () => {
    await getTool("tv_ohlcv").handler({ format: "csv" });
  }, /format must be either 'full' or 'summary'\./i);

  await expectThrows("tv_study_values blank studyName", async () => {
    await getTool("tv_study_values").handler({ studyName: "   " });
  }, /studyName must be a non-empty string\./i);

  await expectThrows("tv_screenshot bad region", async () => {
    await getTool("tv_screenshot").handler({ region: "sidebar" });
  }, /region must be either 'chart' or 'full'\./i);

  await expectThrows("tv_alert_create bad price", async () => {
    await getTool("tv_alert_create").handler({ price: Number.NaN });
  }, /price must be a finite number\./i);

  await expectThrows("tv_alert_create bad condition", async () => {
    await getTool("tv_alert_create").handler({ condition: "telepathy" });
  }, /condition must be one of:/i);

  await expectThrows("tv_draw_horizontal missing price", async () => {
    await getTool("tv_draw_horizontal").handler({});
  }, /price must be a finite number\./i);

  await expectThrows("tv_draw_horizontal bad lineStyle", async () => {
    await getTool("tv_draw_horizontal").handler({ price: 1, lineStyle: "zigzag" });
  }, /lineStyle must be one of:/i);

  await expectThrows("tv_pine_set_source missing code", async () => {
    await getTool("tv_pine_set_source").handler({});
  }, /code must be a non-empty string\./i);

  await expectThrows("tv_watchlist_add missing symbol", async () => {
    await getTool("tv_watchlist_add").handler({});
  }, /symbol must be a non-empty string\./i);

  await expectToolError(
    "unknown tool response contract",
    {
      name: "unknown_tool_probe",
      description: "probe",
      inputSchema: { type: "object", additionalProperties: false },
      handler: async () => ({ isError: true, content: [{ type: "text", text: "synthetic error" }] }),
    },
    {},
    /synthetic error/i,
  );

  console.log(JSON.stringify({
    ok: true,
    validatedTools: TOOL_SET.length,
    checks: [
      "tool uniqueness",
      "schema additionalProperties on no-arg tools",
      "argument validation failure modes",
      "MCP error response shape",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error("Contract smoke failed:", error);
  process.exit(1);
});
