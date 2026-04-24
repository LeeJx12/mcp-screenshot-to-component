/**
 * Pipeline Stage 3: Postprocess
 *
 * Transform a flat list of DetectedRegions into a nested ComponentNode tree.
 *
 * Algorithm:
 *   1. Sort regions by area descending so parents are visited first
 *   2. For each region, find the smallest existing node that fully contains it
 *      → attach as child; else make it a top-level child of root
 *   3. For each container with 2+ children, inspect sibling arrangement
 *      → infer layout_hint (horizontal_stack / vertical_stack / grid / absolute)
 *   4. Detect patterns from layout + geometry
 *      → "card_grid": 3+ siblings with similar size in a grid
 *      → "list": 3+ siblings with similar size stacked vertically
 *      → "top_nav": horizontal band at top of frame
 *      → "sidebar": vertical band on left/right of frame
 */

import type {
  ComponentNode,
  DetectedPattern,
  LayoutHint,
} from "../types/index.js";
import type { DetectedRegion, DetectionResult } from "./detect.js";

export interface TreeResult {
  root: ComponentNode;
  patterns: string[];
  confidence: number;
}

// Tunables
const CONTAINMENT_TOLERANCE = 2; // pixels of slack when checking if bbox A contains B
const SIMILAR_SIZE_RATIO = 0.15; // ±15% size diff is considered "same"
const ALIGNMENT_TOLERANCE = 6; // pixels of slack for axis alignment
const MIN_REPEAT_COUNT = 3;

export function buildComponentTree(detected: DetectionResult): TreeResult {
  const { regions, image_dims } = detected;

  const root: ComponentNode = {
    id: "root",
    type: "container",
    bbox: { x: 0, y: 0, width: image_dims.width, height: image_dims.height },
    layout_hint: "unknown",
    children: [],
  };

  // Sort largest first so parents get created before children
  const sorted = [...regions].sort((a, b) => b.area - a.area);

  // Each node stores its region for containment checks
  const nodes: { node: ComponentNode; region: DetectedRegion }[] = [];

  sorted.forEach((region, idx) => {
    const node: ComponentNode = {
      id: `n${idx}`,
      type: "container",
      bbox: region.bbox,
      layout_hint: "unknown",
      children: [],
    };

    const parent = findSmallestContainer(nodes, region);
    if (parent) {
      parent.node.children!.push(node);
    } else {
      root.children!.push(node);
    }
    nodes.push({ node, region });
  });

  // Bottom-up: infer layout + patterns for every non-leaf node
  const patterns = new Set<string>();
  inferLayoutAndPatterns(root, image_dims, patterns);

  // Run pattern detection for each non-root node (visits the whole tree)
  detectAllPatterns(root, image_dims, patterns, true);

  return {
    root,
    patterns: [...patterns],
    confidence: computeConfidence(regions, patterns.size),
  };
}

// ---------------------------------------------------------------------------
// Containment: does bbox A fully contain bbox B?
// ---------------------------------------------------------------------------

function contains(a: DetectedRegion, b: DetectedRegion): boolean {
  const t = CONTAINMENT_TOLERANCE;
  return (
    b.bbox.x >= a.bbox.x - t &&
    b.bbox.y >= a.bbox.y - t &&
    b.bbox.x + b.bbox.width <= a.bbox.x + a.bbox.width + t &&
    b.bbox.y + b.bbox.height <= a.bbox.y + a.bbox.height + t &&
    !(
      // Reject self-match (same bbox within tolerance)
      Math.abs(b.bbox.x - a.bbox.x) <= t &&
      Math.abs(b.bbox.y - a.bbox.y) <= t &&
      Math.abs(b.bbox.width - a.bbox.width) <= t &&
      Math.abs(b.bbox.height - a.bbox.height) <= t
    )
  );
}

function findSmallestContainer(
  nodes: { node: ComponentNode; region: DetectedRegion }[],
  candidate: DetectedRegion
): { node: ComponentNode; region: DetectedRegion } | null {
  let best: { node: ComponentNode; region: DetectedRegion } | null = null;
  for (const entry of nodes) {
    if (!contains(entry.region, candidate)) continue;
    if (!best || entry.region.area < best.region.area) {
      best = entry;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Layout inference: given siblings, infer horizontal / vertical / grid / absolute
// ---------------------------------------------------------------------------

function inferLayoutAndPatterns(
  node: ComponentNode,
  frame: { width: number; height: number },
  _patterns: Set<string>
): void {
  const children = node.children ?? [];

  // Recurse first so children are finalized before we look at arrangement
  for (const child of children) {
    inferLayoutAndPatterns(child, frame, _patterns);
  }

  if (children.length <= 1) {
    node.layout_hint = "single";
    return;
  }

  node.layout_hint = inferLayout(children);
}

// Walk tree and collect ALL applicable patterns (a node can match multiple).
function detectAllPatterns(
  node: ComponentNode,
  frame: { width: number; height: number },
  patterns: Set<string>,
  isRoot: boolean
): void {
  if (!isRoot) {
    // Check shape-based patterns (sidebar / top_nav) against the node itself
    const shapePattern = detectShapePattern(node, frame);
    if (shapePattern) patterns.add(shapePattern);
  }

  // Check arrangement-based patterns (card_grid / list) against children
  const arrangementPatterns = detectArrangementPatterns(node, isRoot);
  for (const p of arrangementPatterns) patterns.add(p);

  for (const child of node.children ?? []) {
    detectAllPatterns(child, frame, patterns, false);
  }
}

function inferLayout(children: ComponentNode[]): LayoutHint {
  if (children.length < 2) return "single";

  // Sort by y then x so we can scan arrangement
  const sorted = [...children].sort((a, b) => {
    if (Math.abs(a.bbox.y - b.bbox.y) < ALIGNMENT_TOLERANCE) {
      return a.bbox.x - b.bbox.x;
    }
    return a.bbox.y - b.bbox.y;
  });

  // Collect y-bands (rows) and x-bands (columns)
  const rows = groupByAxis(sorted, "y");
  const cols = groupByAxis(sorted, "x");

  // Grid: multiple rows AND multiple columns with consistent sizes
  if (rows.length >= 2 && cols.length >= 2 && hasUniformSizes(children)) {
    return "grid";
  }

  // Horizontal stack: all in same row (one y-band)
  if (rows.length === 1 && cols.length >= 2) {
    return "horizontal_stack";
  }

  // Vertical stack: all in same column (one x-band)
  if (cols.length === 1 && rows.length >= 2) {
    return "vertical_stack";
  }

  // Mixed or overlapping → absolute positioning
  return "absolute";
}

function groupByAxis(
  children: ComponentNode[],
  axis: "x" | "y"
): ComponentNode[][] {
  // Group children whose centers on the given axis fall within tolerance
  const centers = children.map((c) => ({
    child: c,
    center:
      axis === "x"
        ? c.bbox.x + c.bbox.width / 2
        : c.bbox.y + c.bbox.height / 2,
  }));
  centers.sort((a, b) => a.center - b.center);

  const groups: ComponentNode[][] = [];
  let current: ComponentNode[] = [];
  let lastCenter = -Infinity;

  for (const { child, center } of centers) {
    if (center - lastCenter > ALIGNMENT_TOLERANCE * 4) {
      if (current.length) groups.push(current);
      current = [child];
    } else {
      current.push(child);
    }
    lastCenter = center;
  }
  if (current.length) groups.push(current);
  return groups;
}

function hasUniformSizes(children: ComponentNode[]): boolean {
  if (children.length < 2) return false;
  const avgW =
    children.reduce((s, c) => s + c.bbox.width, 0) / children.length;
  const avgH =
    children.reduce((s, c) => s + c.bbox.height, 0) / children.length;
  return children.every(
    (c) =>
      Math.abs(c.bbox.width - avgW) / avgW <= SIMILAR_SIZE_RATIO &&
      Math.abs(c.bbox.height - avgH) / avgH <= SIMILAR_SIZE_RATIO
  );
}

// ---------------------------------------------------------------------------
// Pattern detection
// ---------------------------------------------------------------------------

// Shape-based patterns: determined by the node's own bbox relative to the frame
function detectShapePattern(
  node: ComponentNode,
  frame: { width: number; height: number }
): DetectedPattern | null {
  const { bbox } = node;

  // top_nav: horizontal band across the top
  if (
    bbox.y < frame.height * 0.15 &&
    bbox.width > frame.width * 0.6 &&
    bbox.height < frame.height * 0.2
  ) {
    return "top_nav";
  }

  // sidebar: vertical band on a side, tall and narrow
  const isLeftEdge = bbox.x < frame.width * 0.05;
  const isRightEdge = bbox.x + bbox.width > frame.width * 0.95;
  if (
    (isLeftEdge || isRightEdge) &&
    bbox.height > frame.height * 0.5 &&
    bbox.width < frame.width * 0.3
  ) {
    return "sidebar";
  }

  return null;
}

// Arrangement-based patterns: determined by the node's children
// Returns a Set of patterns because one node can produce multiple patterns
// (e.g., a root with a card_grid cluster AND a list cluster among its children)
function detectArrangementPatterns(
  node: ComponentNode,
  isRoot: boolean
): Set<DetectedPattern> {
  const found = new Set<DetectedPattern>();
  const children = node.children ?? [];
  if (children.length < MIN_REPEAT_COUNT) return found;

  // Node-level: if all children form a grid or vertical stack with uniform sizes
  if (node.layout_hint === "grid" && hasUniformSizes(children)) {
    found.add("card_grid");
  }
  if (node.layout_hint === "vertical_stack" && hasUniformSizes(children)) {
    found.add("list");
  }

  // Root-level: scan sub-clusters of children (e.g., 3 cards here + 3 list items there)
  if (isRoot) {
    const clusters = clusterByProximity(children);
    for (const cluster of clusters) {
      if (cluster.length < MIN_REPEAT_COUNT) continue;
      if (!hasUniformSizes(cluster)) continue;
      const layout = inferLayout(cluster);
      if (layout === "grid" || layout === "horizontal_stack") found.add("card_grid");
      else if (layout === "vertical_stack") found.add("list");
    }
  }

  return found;
}

function clusterByProximity(children: ComponentNode[]): ComponentNode[][] {
  // Group children whose y-ranges overlap (same visual row band) AND that
  // are horizontal neighbors — or whose x-ranges overlap AND that are vertical
  // neighbors. This catches card grids (horizontal row of same-size boxes)
  // and lists (vertical column of same-size boxes) without mixing them.
  const clusters: ComponentNode[][] = [];
  const visited = new Set<string>();

  for (const seed of children) {
    if (visited.has(seed.id)) continue;
    const cluster = [seed];
    visited.add(seed.id);

    for (const other of children) {
      if (visited.has(other.id)) continue;

      const sameRow = rangesOverlap(
        seed.bbox.y,
        seed.bbox.y + seed.bbox.height,
        other.bbox.y,
        other.bbox.y + other.bbox.height
      ) && sizeSimilar(seed, other);

      const sameColumn = rangesOverlap(
        seed.bbox.x,
        seed.bbox.x + seed.bbox.width,
        other.bbox.x,
        other.bbox.x + other.bbox.width
      ) && sizeSimilar(seed, other);

      if (sameRow || sameColumn) {
        cluster.push(other);
        visited.add(other.id);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function sizeSimilar(a: ComponentNode, b: ComponentNode): boolean {
  const wRatio = Math.abs(a.bbox.width - b.bbox.width) / Math.max(a.bbox.width, b.bbox.width);
  const hRatio = Math.abs(a.bbox.height - b.bbox.height) / Math.max(a.bbox.height, b.bbox.height);
  return wRatio <= SIMILAR_SIZE_RATIO && hRatio <= SIMILAR_SIZE_RATIO;
}

function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  return !(a2 < b1 || b2 < a1);
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

function computeConfidence(
  regions: DetectedRegion[],
  patternsFound: number
): number {
  if (regions.length === 0) return 0;

  // Base confidence from per-region fill ratios
  const avgRegionConf =
    regions.reduce((s, r) => s + r.confidence, 0) / regions.length;

  // Boost by number of recognized patterns (each pattern adds evidence)
  const patternBoost = Math.min(0.3, patternsFound * 0.1);

  return Math.min(1, avgRegionConf + patternBoost);
}
