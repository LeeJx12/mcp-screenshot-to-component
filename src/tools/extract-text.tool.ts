/**
 * Tool: extract_text_blocks
 *
 * Extract text content with positions and estimated typography info.
 */

import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

const inputSchema = z.object({
  image_url: z.string().describe("URL or base64-encoded image"),
  merge_proximity: z
    .number()
    .min(0)
    .max(50)
    .default(8)
    .describe("Pixel threshold for merging adjacent text blocks"),
});

export const extractTextBlocksTool: Tool = {
  name: "extract_text_blocks",
  description:
    "Extract text content from an image with positions and estimated typography. " +
    "Useful for identifying labels, headings, and body text in UI screenshots.",
  inputSchema: {
    type: "object",
    properties: {
      image_url: {
        type: "string",
        description: "URL or base64-encoded image data",
      },
      merge_proximity: {
        type: "number",
        default: 8,
        description: "Pixel threshold for merging nearby text blocks",
      },
    },
    required: ["image_url"],
  },
};

export async function extractTextBlocksHandler(args: unknown) {
  const input = inputSchema.parse(args);

  // TODO (W2): wire up OCR adapter (Vision API or tesseract.js fallback)
  // For now, return a placeholder response so the server contract works.
  const result = {
    blocks: [],
    warning: "OCR adapter not yet implemented",
    input_echo: input,
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
