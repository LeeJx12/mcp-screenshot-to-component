/**
 * Pipeline Stage 3: Postprocess
 *
 * Build a component tree from flat detected regions.
 *
 * Current status: SKELETON. Full nesting algorithm to be implemented in W2.
 *
 * Core algorithm (to be written):
 *   1. Sort regions by area (descending) so parents come first
 *   2. For each region, find smallest enclosing region already in tree
 *      → attach as child; else attach to root
 *   3. For each container, inspect children arrangement
 *      → infer layout_hint (horizontal_stack / vertical_stack / grid)
 *   4. Detect repeating siblings (similar size + spacing)
 *      → mark pattern as "card_grid" / "list"
 */

import type { ComponentNode } from "../types/index.js";
import type { DetectionResult } from "./detect.js";

export interface TreeResult {
  root: ComponentNode;
  patterns: string[];
  confidence: number;
}

export function buildComponentTree(detected: DetectionResult): TreeResult {
  // TODO(W2): implement bbox nesting + layout inference
  // Minimal shape for now:
  const root: ComponentNode = {
    id: "root",
    type: "container",
    bbox: {
      x: 0,
      y: 0,
      width: detected.image_dims.width,
      height: detected.image_dims.height,
    },
    layout_hint: "unknown",
    children: [],
  };

  return {
    root,
    patterns: [],
    confidence: 0,
  };
}
