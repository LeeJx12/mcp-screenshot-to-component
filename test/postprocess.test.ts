import { describe, it, expect } from "vitest";
import { buildComponentTree } from "../src/pipeline/postprocess.js";
import type { DetectedRegion } from "../src/pipeline/detect.js";

function makeRegion(
  x: number,
  y: number,
  w: number,
  h: number
): DetectedRegion {
  return {
    bbox: { x, y, width: w, height: h },
    area: w * h,
    confidence: 0.5,
    kind: "unknown",
  };
}

describe("postprocess.buildComponentTree", () => {
  it("returns empty tree for empty input", () => {
    const result = buildComponentTree({
      regions: [],
      image_dims: { width: 800, height: 600 },
    });

    expect(result.root.type).toBe("container");
    expect(result.root.children).toEqual([]);
    expect(result.patterns).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it("nests small regions inside larger containing regions", () => {
    // Parent 100x100 at (10,10) contains two small children inside
    const regions = [
      makeRegion(10, 10, 200, 200), // parent
      makeRegion(20, 20, 40, 40), // child inside
      makeRegion(80, 80, 50, 50), // child inside
      makeRegion(500, 500, 60, 60), // sibling at root level
    ];

    const result = buildComponentTree({
      regions,
      image_dims: { width: 800, height: 800 },
    });

    expect(result.root.children).toHaveLength(2); // parent + sibling at root

    const parentNode = result.root.children!.find(
      (c) => c.bbox.width === 200
    );
    expect(parentNode).toBeDefined();
    expect(parentNode!.children).toHaveLength(2);
  });

  it("infers horizontal_stack for children in one row", () => {
    const regions = [
      makeRegion(0, 0, 600, 100), // parent (nav band)
      makeRegion(10, 20, 80, 60),
      makeRegion(110, 20, 80, 60),
      makeRegion(210, 20, 80, 60),
    ];
    const result = buildComponentTree({
      regions,
      image_dims: { width: 600, height: 400 },
    });

    const parent = result.root.children!.find((c) => c.bbox.width === 600);
    expect(parent).toBeDefined();
    expect(parent!.layout_hint).toBe("horizontal_stack");
  });

  it("infers vertical_stack for children in one column", () => {
    const regions = [
      makeRegion(0, 0, 200, 600), // parent (sidebar)
      makeRegion(20, 20, 160, 50),
      makeRegion(20, 90, 160, 50),
      makeRegion(20, 160, 160, 50),
    ];
    const result = buildComponentTree({
      regions,
      image_dims: { width: 800, height: 600 },
    });

    const parent = result.root.children!.find((c) => c.bbox.height === 600);
    expect(parent).toBeDefined();
    expect(parent!.layout_hint).toBe("vertical_stack");
  });

  it("infers grid layout for 2x2 uniformly-sized children", () => {
    const regions = [
      makeRegion(0, 0, 500, 500), // parent
      makeRegion(10, 10, 220, 220),
      makeRegion(240, 10, 220, 220),
      makeRegion(10, 240, 220, 220),
      makeRegion(240, 240, 220, 220),
    ];
    const result = buildComponentTree({
      regions,
      image_dims: { width: 500, height: 500 },
    });

    const parent = result.root.children!.find((c) => c.bbox.width === 500);
    expect(parent).toBeDefined();
    expect(parent!.layout_hint).toBe("grid");
  });

  it("detects card_grid pattern for 3 uniformly-sized siblings in a row", () => {
    // 3 cards at root level
    const regions = [
      makeRegion(100, 100, 200, 150),
      makeRegion(320, 100, 200, 150),
      makeRegion(540, 100, 200, 150),
    ];
    const result = buildComponentTree({
      regions,
      image_dims: { width: 1000, height: 500 },
    });

    expect(result.patterns).toContain("card_grid");
  });

  it("detects list pattern for 3 uniformly-sized siblings stacked vertically", () => {
    const regions = [
      makeRegion(0, 0, 240, 600), // sidebar container
      makeRegion(20, 20, 200, 40),
      makeRegion(20, 80, 200, 40),
      makeRegion(20, 140, 200, 40),
    ];
    const result = buildComponentTree({
      regions,
      image_dims: { width: 1200, height: 800 },
    });

    expect(result.patterns).toContain("list");
  });

  it("detects sidebar pattern for tall narrow region on left edge", () => {
    const regions = [
      makeRegion(0, 0, 200, 700), // left sidebar
    ];
    const result = buildComponentTree({
      regions,
      image_dims: { width: 1200, height: 800 },
    });

    expect(result.patterns).toContain("sidebar");
  });

  it("assigns unique ids to every node", () => {
    const regions = [
      makeRegion(0, 0, 400, 400),
      makeRegion(10, 10, 100, 100),
      makeRegion(200, 200, 100, 100),
    ];
    const result = buildComponentTree({
      regions,
      image_dims: { width: 500, height: 500 },
    });

    const ids = new Set<string>();
    function collect(node: { id: string; children?: { id: string; children?: unknown }[] }) {
      expect(ids.has(node.id)).toBe(false);
      ids.add(node.id);
      for (const c of node.children ?? []) collect(c as Parameters<typeof collect>[0]);
    }
    collect(result.root);
    expect(ids.size).toBeGreaterThan(1);
  });
});
