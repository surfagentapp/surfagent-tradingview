/**
 * server.ts — surfagent-tradingview MCP server.
 *
 * TradingView site adapter for SurfAgent. Provides chart control,
 * Pine Script development, data extraction, alerts, drawings, and watchlist
 * management tools via MCP.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolDefinition } from "./types.js";
import { errorResult } from "./types.js";

import { healthTools } from "./tools/health.js";
import { chartTools } from "./tools/chart.js";
import { dataTools } from "./tools/data.js";
import { captureTools } from "./tools/capture.js";
import { alertTools } from "./tools/alerts.js";
import { drawingTools } from "./tools/drawing.js";
import { pineTools } from "./tools/pine.js";
import { watchlistTools } from "./tools/watchlist.js";

const TOOL_SET: ToolDefinition[] = [
  ...healthTools,
  ...chartTools,
  ...dataTools,
  ...captureTools,
  ...alertTools,
  ...drawingTools,
  ...pineTools,
  ...watchlistTools,
];

function ensureUniqueNames(): void {
  const names = new Set<string>();
  for (const tool of TOOL_SET) {
    if (names.has(tool.name)) {
      throw new Error(`Duplicate tool name: ${tool.name}`);
    }
    names.add(tool.name);
  }
}

export function createTradingViewServer(): Server {
  ensureUniqueNames();

  const server = new Server(
    {
      name: "surfagent-tradingview",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_SET.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = TOOL_SET.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
      };
    }

    try {
      return await tool.handler(request.params.arguments ?? {});
    } catch (error) {
      return errorResult(error);
    }
  });

  return server;
}
