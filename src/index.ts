#!/usr/bin/env node
/**
 * mcp-screenshot-to-component
 *
 * MCP server entry point. Registers tools and starts stdio transport.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { analyzeScreenshotTool, analyzeScreenshotHandler } from "./tools/analyze-screenshot.tool.js";
import { extractTextBlocksTool, extractTextBlocksHandler } from "./tools/extract-text.tool.js";
import { suggestComponentTreeTool, suggestComponentTreeHandler } from "./tools/suggest-tree.tool.js";

const server = new Server(
  {
    name: "mcp-screenshot-to-component",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool registry
const tools = [
  { definition: analyzeScreenshotTool, handler: analyzeScreenshotHandler },
  { definition: extractTextBlocksTool, handler: extractTextBlocksHandler },
  { definition: suggestComponentTreeTool, handler: suggestComponentTreeHandler },
];

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => t.definition),
}));

// Route tool calls to handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = tools.find((t) => t.definition.name === name);

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return tool.handler(args ?? {});
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error("mcp-screenshot-to-component server running on stdio");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error:", err);
  process.exit(1);
});
