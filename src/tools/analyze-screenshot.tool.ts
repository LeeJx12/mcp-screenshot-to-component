/**
 * Tool: analyze_screenshot
 *
 * Analyze a UI screenshot and return a structured component tree
 * with bounding boxes and layout hints.
 */

import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { preprocessImage } from "../pipeline/preprocess.js";
import { detectStructure } from "../pipeline/detect.js";
import { buildComponentTree } from "../pipeline/postprocess.js";

const inputSchema = z.object({
  image_url: z.string().describe("URL or base64-encoded image"),
  detail_level: z
    .enum(["low", "medium", "high"])
    .default("medium")
    .describe("How deeply to infer nested structure"),
});

export const analyzeScreenshotTool: Tool = {
  name: "analyze_screenshot",
  description:
    "Analyze a UI screenshot and return a structured component tree with bounding boxes. " +
    "Use this when the LLM receives an image and needs hierarchical layout information " +
    "before generating implementation code.",
  inputSchema: {
    type: "object",
    properties: {
      image_url: {
        type: "string",
        description: "URL or base64-encoded image data",
      },
      detail_level: {
        type: "string",
        enum: ["low", "medium", "high"],
        default: "medium",
        description: "Depth of hierarchical inference",
      },
    },
    required: ["image_url"],
  },
};

export async function analyzeScreenshotHandler(args: unknown) {
  const input = inputSchema.parse(args);
  const startedAt = Date.now();

  // Pipeline: Preprocess → Detect → Postprocess
  const preprocessed = await preprocessImage(input.image_url);
  const detected = await detectStructure(preprocessed, input.detail_level);
  const tree = buildComponentTree(detected);

  const result = {
    root: tree.root,
    detected_patterns: tree.patterns,
    confidence: tree.confidence,
    processing_time_ms: Date.now() - startedAt,
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
