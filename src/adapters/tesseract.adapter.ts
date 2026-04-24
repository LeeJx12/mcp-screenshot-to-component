/**
 * Tesseract OCR Adapter
 *
 * Pure-JS OCR via tesseract.js (WASM build). Zero cloud dependencies.
 *
 * Trade-offs:
 *   - English recognition: good
 *   - Korean recognition: requires 'kor' traineddata (lazy-loaded on first call)
 *   - First run downloads the language model (~10MB), subsequent runs cached
 *   - Slower than Vision API (~1-2s per screenshot) but free and offline-capable
 *
 * This adapter is optional — if tesseract.js import fails, the tool falls
 * back to returning an explicit warning rather than crashing the MCP server.
 */

import type { TextBlock } from "../types/index.js";

export interface OcrOptions {
  /** BCP-47 language codes to load. Defaults to 'eng'. */
  languages?: string[];
  /** Minimum confidence threshold (0-100). Blocks below this are dropped. */
  minConfidence?: number;
}

export async function runTesseract(
  imageBuffer: Buffer,
  options: OcrOptions = {}
): Promise<TextBlock[]> {
  const languages = options.languages ?? ["eng"];
  const minConfidence = options.minConfidence ?? 50;

  // Dynamic import so tesseract.js is only loaded when OCR is actually used.
  // This keeps MCP server startup fast and makes the dep effectively optional.
  const { createWorker } = await import("tesseract.js");

  const worker = await createWorker(languages.join("+"));
  try {
    const { data } = await worker.recognize(imageBuffer);

    const blocks: TextBlock[] = [];

    // Walk the block → paragraph → line → word hierarchy
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) {
          for (const word of line.words ?? []) {
            if (word.confidence < minConfidence) continue;
            if (!word.text.trim()) continue;

            const { x0, y0, x1, y1 } = word.bbox;
            blocks.push({
              text: word.text,
              bbox: {
                x: x0,
                y: y0,
                width: x1 - x0,
                height: y1 - y0,
              },
              confidence: word.confidence / 100,
              font_size_est: estimateFontSize(y1 - y0),
              weight_est: estimateWeight(word.font_name),
            });
          }
        }
      }
    }
    return blocks;
  } finally {
    await worker.terminate();
  }
}

function estimateFontSize(heightPx: number): number {
  // Rough: pixel height ≈ font size in px (cap height is ~70% of font size)
  return Math.round(heightPx / 0.7);
}

function estimateWeight(fontName: string | undefined): "normal" | "bold" {
  if (fontName && fontName.toLowerCase().includes("bold")) return "bold";
  return "normal";
}
