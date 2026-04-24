/**
 * Pipeline Stage 2: Detect
 *
 * Detect candidate component regions using classical CV techniques.
 *
 * Pipeline:
 *   1. Grayscale (sharp)
 *   2. Gaussian blur to suppress noise
 *   3. Sobel edge detection via kernel convolution
 *   4. Threshold to binary edge map
 *   5. Connected-components labeling via iterative flood-fill
 *   6. Bounding boxes + size/aspect filtering
 *
 * Why this approach:
 *   - No native CV dependencies (opencv4nodejs requires compilation)
 *   - sharp is already in the deps; everything else is pure TS
 *   - Deterministic, sub-100ms on 2K screenshots
 *   - Good enough for "give the LLM structured context" goal
 */

import sharp from "sharp";
import type { PreprocessedImage } from "./preprocess.js";
import type { BoundingBox } from "../types/index.js";

export interface DetectedRegion {
  bbox: BoundingBox;
  confidence: number;
  kind: "block" | "text_region" | "repeat_unit" | "unknown";
  area: number;
}

export interface DetectionResult {
  regions: DetectedRegion[];
  grid_hint?: {
    columns: number;
    gutter_px: number;
  };
  image_dims: { width: number; height: number };
}

// Tunables — exposed as constants for easy experimentation
const EDGE_THRESHOLD = 20; // 0-255, lower = more edges
const MIN_REGION_AREA_RATIO = 0.0005; // 0.05% of image area
const MAX_REGION_AREA_RATIO = 0.9; // drop full-frame blobs
const MIN_REGION_DIMENSION = 12; // drop slivers

export async function detectStructure(
  image: PreprocessedImage,
  detailLevel: "low" | "medium" | "high"
): Promise<DetectionResult> {
  const edgeMap = await buildEdgeMap(image);
  const binary = binarize(edgeMap, image.width, image.height, EDGE_THRESHOLD);

  const labelMap = labelConnectedComponents(binary, image.width, image.height);
  const rawRegions = extractBoundingBoxes(labelMap, image.width, image.height);

  const regions = filterRegions(rawRegions, image.width, image.height, detailLevel);

  return {
    regions,
    image_dims: { width: image.width, height: image.height },
  };
}

// ---------------------------------------------------------------------------
// Stage: Edge map via sharp's grayscale + blur + Sobel convolution
// ---------------------------------------------------------------------------

async function buildEdgeMap(image: PreprocessedImage): Promise<Uint8Array> {
  // Use sharp for the parts it's good at: grayscale + blur.
  // Then do Sobel in pure JS so we have full control over output format.
  //
  // We convert to a single PNG encode/decode round-trip to force 1-channel
  // output reliably (sharp's raw pipeline sometimes preserves channels even
  // after grayscale; going through PNG and reading as 1-channel is robust).
  const grayPng = await sharp(image.buffer, {
    raw: {
      width: image.width,
      height: image.height,
      channels: image.channels as 1 | 2 | 3 | 4,
    },
  })
    .grayscale()
    .blur(1.0)
    .png()
    .toBuffer();

  const { data: gray, info } = await sharp(grayPng)
    .extractChannel(0) // take only the luminance channel
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const out = new Uint8Array(width * height);

  // Sobel kernels applied in place. |Gx| + |Gy| approximation of gradient magnitude.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p00 = gray[(y - 1) * width + (x - 1)];
      const p01 = gray[(y - 1) * width + x];
      const p02 = gray[(y - 1) * width + (x + 1)];
      const p10 = gray[y * width + (x - 1)];
      const p12 = gray[y * width + (x + 1)];
      const p20 = gray[(y + 1) * width + (x - 1)];
      const p21 = gray[(y + 1) * width + x];
      const p22 = gray[(y + 1) * width + (x + 1)];

      const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
      const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;

      const mag = Math.abs(gx) + Math.abs(gy);
      out[y * width + x] = mag > 255 ? 255 : mag;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stage: Binarization
// ---------------------------------------------------------------------------

function binarize(
  edgeMap: Uint8Array,
  width: number,
  height: number,
  threshold: number
): Uint8Array {
  const bin = new Uint8Array(width * height);
  for (let i = 0; i < edgeMap.length; i++) {
    bin[i] = edgeMap[i] >= threshold ? 1 : 0;
  }
  return bin;
}

// ---------------------------------------------------------------------------
// Stage: Connected-components labeling (iterative flood fill, 4-connectivity)
// ---------------------------------------------------------------------------

function labelConnectedComponents(
  binary: Uint8Array,
  width: number,
  height: number
): Int32Array {
  const labels = new Int32Array(width * height); // 0 = background
  let nextLabel = 1;
  const stack: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binary[idx] === 0 || labels[idx] !== 0) continue;

      const currentLabel = nextLabel++;
      stack.push(idx);

      while (stack.length > 0) {
        const i = stack.pop()!;
        if (labels[i] !== 0) continue;
        if (binary[i] === 0) continue;
        labels[i] = currentLabel;

        const cx = i % width;
        const cy = (i - cx) / width;

        if (cx > 0) stack.push(i - 1);
        if (cx < width - 1) stack.push(i + 1);
        if (cy > 0) stack.push(i - width);
        if (cy < height - 1) stack.push(i + width);
      }
    }
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Stage: Bounding box extraction per label
// ---------------------------------------------------------------------------

function extractBoundingBoxes(
  labels: Int32Array,
  width: number,
  height: number
): DetectedRegion[] {
  const map = new Map<
    number,
    { minX: number; minY: number; maxX: number; maxY: number; count: number }
  >();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const label = labels[y * width + x];
      if (label === 0) continue;
      const existing = map.get(label);
      if (!existing) {
        map.set(label, { minX: x, minY: y, maxX: x, maxY: y, count: 1 });
      } else {
        if (x < existing.minX) existing.minX = x;
        if (x > existing.maxX) existing.maxX = x;
        if (y < existing.minY) existing.minY = y;
        if (y > existing.maxY) existing.maxY = y;
        existing.count++;
      }
    }
  }

  const regions: DetectedRegion[] = [];
  for (const stats of map.values()) {
    const w = stats.maxX - stats.minX + 1;
    const h = stats.maxY - stats.minY + 1;
    regions.push({
      bbox: { x: stats.minX, y: stats.minY, width: w, height: h },
      area: w * h,
      confidence: Math.min(1, stats.count / (w * h)),
      kind: "unknown",
    });
  }
  return regions;
}

// ---------------------------------------------------------------------------
// Stage: Filter noise and oversized regions
// ---------------------------------------------------------------------------

function filterRegions(
  regions: DetectedRegion[],
  imageWidth: number,
  imageHeight: number,
  detailLevel: "low" | "medium" | "high"
): DetectedRegion[] {
  const totalArea = imageWidth * imageHeight;
  const minArea = totalArea * MIN_REGION_AREA_RATIO;
  const maxArea = totalArea * MAX_REGION_AREA_RATIO;

  const dimFloor =
    detailLevel === "high"
      ? Math.floor(MIN_REGION_DIMENSION / 2)
      : detailLevel === "low"
        ? MIN_REGION_DIMENSION * 2
        : MIN_REGION_DIMENSION;

  return regions
    .filter((r) => r.area >= minArea)
    .filter((r) => r.area <= maxArea)
    .filter((r) => r.bbox.width >= dimFloor && r.bbox.height >= dimFloor)
    .sort((a, b) => b.area - a.area);
}
