/**
 * Tool: extract_text_blocks
 *
 * Extract text content with positions and estimated typography info.
 * Uses tesseract.js under the hood; no cloud dependencies.
 */

import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { loadImageBufferForOcr } from "../pipeline/preprocess.js";
import { runTesseract } from "../adapters/tesseract.adapter.js";

const inputSchema = z.object({
  image_url: z.string().describe("URL or base64-encoded image"),
  languages: z
    .array(z.string())
    .default(["eng"])
    .describe(
      "Tesseract language codes. Add 'kor' for Korean, 'jpn' for Japanese, etc."
    ),
  min_confidence: z
    .number()
    .min(0)
    .max(100)
    .default(50)
    .describe("Drop blocks below this confidence (0-100)"),
  merge_proximity: z
    .number()
    .min(0)
    .max(50)
    .default(8)
    .describe("Pixel threshold for merging adjacent words into blocks"),
});

export const extractTextBlocksTool: Tool = {
  name: "extract_text_blocks",
  description:
    "Extract text content from an image with positions and estimated typography. " +
    "Useful for identifying labels, headings, and body text in UI screenshots. " +
    "Uses local OCR (tesseract.js) — no external API calls.",
  inputSchema: {
    type: "object",
    properties: {
      image_url: {
        type: "string",
        description: "URL or base64-encoded image data",
      },
      languages: {
        type: "array",
        items: { type: "string" },
        default: ["eng"],
        description:
          "OCR language codes (e.g., ['eng'], ['eng', 'kor'])",
      },
      min_confidence: {
        type: "number",
        default: 50,
        description: "Minimum word confidence 0-100",
      },
      merge_proximity: {
        type: "number",
        default: 8,
        description: "Pixel threshold for merging nearby words",
      },
    },
    required: ["image_url"],
  },
};

export async function extractTextBlocksHandler(args: unknown) {
  const input = inputSchema.parse(args);

  try {
    const imageBuffer = await loadImageBufferForOcr(input.image_url);
    const blocks = await runTesseract(imageBuffer, {
      languages: input.languages,
      minConfidence: input.min_confidence,
    });

    const result = {
      blocks,
      block_count: blocks.length,
      languages_used: input.languages,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "OCR failed",
              detail: message,
              hint: "Ensure the image URL/base64 is valid and the language data is available.",
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
