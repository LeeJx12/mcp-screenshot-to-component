/**
 * Pipeline Stage 1: Preprocess
 *
 * Load an image (URL or base64), normalize size/orientation, and prepare
 * for structural detection. Inspired by the 3-stage pipeline pattern used
 * in production vision systems (e.g., document OCR preprocessing).
 */

import sharp from "sharp";

export interface PreprocessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  channels: number;
  original_size: { width: number; height: number };
  /** Pixels of padding added on each side. Subtract from detected bboxes. */
  padding: number;
}

const MAX_DIMENSION = 2048;
const EDGE_PADDING = 4; // pixels of padding added around the frame so
// rectangles touching the image boundary still produce closed contours.
// The padding is later compensated for in detect output coordinates.

export async function preprocessImage(imageUrl: string): Promise<PreprocessedImage> {
  const buffer = await loadImageBuffer(imageUrl);
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read image dimensions");
  }

  const needsResize =
    metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION;

  // Resize first (if needed), then add a uniform padding ring on all 4 sides.
  // Padding uses a neutral mid-grey so it contrasts with both light and dark
  // boundary-touching components — guaranteeing strong Sobel edges where the
  // real component meets the padding.
  let pipeline = image;
  if (needsResize) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const processed = await pipeline
    .extend({
      top: EDGE_PADDING,
      bottom: EDGE_PADDING,
      left: EDGE_PADDING,
      right: EDGE_PADDING,
      background: { r: 128, g: 128, b: 128, alpha: 1 },
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: processed.data,
    width: processed.info.width,
    height: processed.info.height,
    channels: processed.info.channels,
    original_size: { width: metadata.width, height: metadata.height },
    padding: EDGE_PADDING,
  };
}

/**
 * Load raw image bytes from URL/base64. Exported for use by OCR adapters that
 * prefer the original encoded buffer rather than the preprocessed raw pixels.
 */
export async function loadImageBufferForOcr(imageUrl: string): Promise<Buffer> {
  return loadImageBuffer(imageUrl);
}

async function loadImageBuffer(imageUrl: string): Promise<Buffer> {
  // Base64 data URL
  if (imageUrl.startsWith("data:")) {
    const base64Part = imageUrl.split(",")[1];
    if (!base64Part) throw new Error("Invalid base64 data URL");
    return Buffer.from(base64Part, "base64");
  }

  // HTTP(S) URL
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Assume plain base64
  return Buffer.from(imageUrl, "base64");
}
