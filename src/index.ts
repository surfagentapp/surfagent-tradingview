#!/usr/bin/env node

/**
 * surfagent-tradingview — TradingView MCP adapter for SurfAgent.
 *
 * Gives AI agents 20+ TradingView-specific tools: chart control, Pine Script dev,
 * real-time data, alerts, drawings, watchlist management.
 *
 * Requires SurfAgent daemon running on port 7201 with Chrome on port 9222.
 *
 * Usage:
 *   npx surfagent-tradingview
 *
 * Or add to MCP config:
 *   { "command": "npx", "args": ["-y", "surfagent-tradingview"] }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTradingViewServer } from "./server.js";

async function main() {
  const server = createTradingViewServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
