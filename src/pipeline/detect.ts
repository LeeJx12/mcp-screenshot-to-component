/**
 * Pipeline Stage 2: Detect
 *
 * Detect candidate component regions using classical CV techniques:
 * edge detection, contour finding, and grid inference.
 *
 * Current status: SKELETON. To be implemented in W2.
 *
 * Strategy:
 *   - Edge map via Sobel/Canny (sharp has kernel conv; OpenCV sidecar
 *     may be added later for accuracy)
 *   - Contour detection to find enclosed regions
 *   - Whitespace analysis to find column/row gutters (grid hint)
 */

import type { PreprocessedImage } from "./preprocess.js";
import type { BoundingBox } from "../types/index.js";

export interface DetectedRegion {
  bbox: BoundingBox;
  confidence: number;
  kind: "block" | "text_region" | "repeat_unit" | "unknown";
}

export interface DetectionResult {
  regions: DetectedRegion[];
  grid_hint?: {
    columns: number;
    gutter_px: number;
  };
  image_dims: { width: number; height: number };
}

export async function detectStructure(
  image: PreprocessedImage,
  _detailLevel: "low" | "medium" | "high"
): Promise<DetectionResult> {
  // TODO(W2): implement edge + contour + grid inference
  // For now, return a minimal shape so the server contract works.
  return {
    regions: [],
    image_dims: { width: image.width, height: image.height },
  };
}
