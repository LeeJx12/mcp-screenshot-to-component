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
}

const MAX_DIMENSION = 2048;

export async function preprocessImage(imageUrl: string): Promise<PreprocessedImage> {
  const buffer = await loadImageBuffer(imageUrl);
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read image dimensions");
  }

  const needsResize =
    metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION;

  const processed = needsResize
    ? await image
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .raw()
        .toBuffer({ resolveWithObject: true })
    : await image.raw().toBuffer({ resolveWithObject: true });

  return {
    buffer: processed.data,
    width: processed.info.width,
    height: processed.info.height,
    channels: processed.info.channels,
    original_size: { width: metadata.width, height: metadata.height },
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
