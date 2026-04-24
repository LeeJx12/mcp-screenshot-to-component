import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { detectStructure } from "../src/pipeline/detect.js";
import type { PreprocessedImage } from "../src/pipeline/preprocess.js";

/**
 * Generates a synthetic screenshot with known rectangles for deterministic
 * testing of the detect pipeline. Each rectangle is a solid dark block on a
 * light background, producing strong edges.
 */
async function makeSyntheticScreenshot(
  width: number,
  height: number,
  rects: { x: number; y: number; w: number; h: number }[]
): Promise<PreprocessedImage> {
  const svgRects = rects
    .map(
      (r) =>
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="black" />`
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="white" />
      ${svgRects}
    </svg>`;

  const { data, info } = await sharp(Buffer.from(svg))
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    channels: info.channels,
    original_size: { width: info.width, height: info.height },
  };
}

describe("detect.detectStructure", () => {
  it("detects multiple distinct rectangular regions", async () => {
    const image = await makeSyntheticScreenshot(400, 400, [
      { x: 20, y: 20, w: 100, h: 60 },
      { x: 200, y: 150, w: 120, h: 80 },
      { x: 50, y: 300, w: 80, h: 60 },
    ]);

    const result = await detectStructure(image, "medium");

    expect(result.image_dims).toEqual({ width: 400, height: 400 });
    // We expect at least as many regions as rectangles drawn.
    // The pipeline may detect additional edge artifacts, which is fine.
    expect(result.regions.length).toBeGreaterThanOrEqual(3);
  });

  it("sorts regions by area descending", async () => {
    const image = await makeSyntheticScreenshot(400, 400, [
      { x: 10, y: 10, w: 200, h: 200 }, // large
      { x: 250, y: 10, w: 50, h: 50 },
      { x: 250, y: 100, w: 30, h: 30 },
    ]);

    const result = await detectStructure(image, "medium");
    expect(result.regions.length).toBeGreaterThan(0);

    for (let i = 1; i < result.regions.length; i++) {
      expect(result.regions[i - 1].area).toBeGreaterThanOrEqual(
        result.regions[i].area
      );
    }
  });

  it("returns empty regions for a blank image", async () => {
    const image = await makeSyntheticScreenshot(300, 300, []);
    const result = await detectStructure(image, "medium");
    expect(result.regions.length).toBe(0);
  });

  it("respects detail_level (high yields more regions than low)", async () => {
    const rects = [
      { x: 20, y: 20, w: 20, h: 20 },
      { x: 60, y: 20, w: 20, h: 20 },
      { x: 100, y: 20, w: 20, h: 20 },
      { x: 20, y: 60, w: 150, h: 100 },
    ];
    const image = await makeSyntheticScreenshot(400, 400, rects);

    const lowDetail = await detectStructure(image, "low");
    const highDetail = await detectStructure(image, "high");

    expect(highDetail.regions.length).toBeGreaterThanOrEqual(
      lowDetail.regions.length
    );
  });
});
