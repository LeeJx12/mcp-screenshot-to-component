/**
 * Tool: suggest_component_tree
 *
 * Given a screenshot, suggest a component tree for a specified framework.
 * Internally composes analyze_screenshot + extract_text_blocks results.
 */

import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

const inputSchema = z.object({
  image_url: z.string().describe("URL or base64-encoded image"),
  framework: z
    .enum(["react", "react-native", "vue", "html"])
    .describe("Target framework for component tree"),
  style_system: z
    .enum(["tailwind", "emotion", "css-modules", "inline"])
    .default("tailwind")
    .describe("Preferred styling system"),
});

export const suggestComponentTreeTool: Tool = {
  name: "suggest_component_tree",
  description:
    "Suggest a framework-aware component tree for a given screenshot. " +
    "Internally analyzes layout and text, then maps to framework conventions.",
  inputSchema: {
    type: "object",
    properties: {
      image_url: {
        type: "string",
        description: "URL or base64-encoded image data",
      },
      framework: {
        type: "string",
        enum: ["react", "react-native", "vue", "html"],
        description: "Target framework",
      },
      style_system: {
        type: "string",
        enum: ["tailwind", "emotion", "css-modules", "inline"],
        default: "tailwind",
        description: "Preferred styling approach",
      },
    },
    required: ["image_url", "framework"],
  },
};

export async function suggestComponentTreeHandler(args: unknown) {
  const input = inputSchema.parse(args);

  // TODO (W3): compose analyze_screenshot + extract_text_blocks,
  // then apply framework-specific scaffolding rules.
  const result = {
    suggestion: "Scaffolding generator not yet implemented",
    input_echo: input,
    next_steps: [
      "W2: Implement analyze_screenshot + extract_text_blocks",
      "W3: Build framework mapping rules (nav → Header, card grid → Card[])",
    ],
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
