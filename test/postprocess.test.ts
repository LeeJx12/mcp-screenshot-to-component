import { describe, it, expect } from "vitest";
import { buildComponentTree } from "../src/pipeline/postprocess.js";

describe("postprocess.buildComponentTree", () => {
  it("returns a root container with image dimensions", () => {
    const result = buildComponentTree({
      regions: [],
      image_dims: { width: 1440, height: 900 },
    });

    expect(result.root.type).toBe("container");
    expect(result.root.bbox).toEqual({
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
    });
  });

  it("starts with empty patterns and zero confidence", () => {
    const result = buildComponentTree({
      regions: [],
      image_dims: { width: 100, height: 100 },
    });

    expect(result.patterns).toEqual([]);
    expect(result.confidence).toBe(0);
  });
});
