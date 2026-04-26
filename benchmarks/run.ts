/**
 * Benchmark runner — measures detection accuracy against ground truth.
 *
 * Metrics per fixture:
 *   - bbox_recall:   fraction of ground-truth rects matched (IoU >= 0.5)
 *   - bbox_precision: fraction of detected regions that matched a truth
 *   - pattern_f1:    F1 over expected vs detected patterns
 *   - detect_ms:     time spent in detect pipeline
 *   - postprocess_ms: time spent building the tree
 *
 * Usage: tsx benchmarks/run.ts  (from repo root, after `npm run build`)
 */

import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { preprocessImage } from "../dist/pipeline/preprocess.js";
import { detectStructure } from "../dist/pipeline/detect.js";
import { buildComponentTree } from "../dist/pipeline/postprocess.js";
import { FIXTURES } from "./fixtures.js";
import type { GroundTruthRect } from "./fixtures.js";
import type { BoundingBox } from "../dist/types/index.js";

const IOU_THRESHOLD = 0.5;

interface FixtureResult {
  name: string;
  gt_rect_count: number;
  detected_region_count: number;
  bbox_recall: number;
  bbox_precision: number;
  expected_patterns: string[];
  detected_patterns: string[];
  pattern_precision: number;
  pattern_recall: number;
  pattern_f1: number;
  detect_ms: number;
  postprocess_ms: number;
}

async function runFixture(
  fixture: (typeof FIXTURES)[number]
): Promise<FixtureResult> {
  const pngBuffer = await sharp(Buffer.from(fixture.svg)).png().toBuffer();
  const base64 = `data:image/png;base64,${pngBuffer.toString("base64")}`;

  const pre = await preprocessImage(base64);

  const t1 = Date.now();
  const det = await detectStructure(pre, "medium");
  const detect_ms = Date.now() - t1;

  const t2 = Date.now();
  const tree = buildComponentTree(det);
  const postprocess_ms = Date.now() - t2;

  const matches = matchByIou(
    fixture.truth.rects,
    det.regions.map((r) => r.bbox)
  );

  const recall = fixture.truth.rects.length
    ? matches.matchedTruth / fixture.truth.rects.length
    : 1;
  const precision = det.regions.length
    ? matches.matchedDetected / det.regions.length
    : 1;

  const patternMetrics = scorePatterns(
    fixture.truth.patterns,
    tree.patterns
  );

  return {
    name: fixture.name,
    gt_rect_count: fixture.truth.rects.length,
    detected_region_count: det.regions.length,
    bbox_recall: +recall.toFixed(3),
    bbox_precision: +precision.toFixed(3),
    expected_patterns: fixture.truth.patterns,
    detected_patterns: tree.patterns,
    pattern_precision: +patternMetrics.precision.toFixed(3),
    pattern_recall: +patternMetrics.recall.toFixed(3),
    pattern_f1: +patternMetrics.f1.toFixed(3),
    detect_ms,
    postprocess_ms,
  };
}

function iou(a: GroundTruthRect, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  const inter = (x2 - x1) * (y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return inter / union;
}

function matchByIou(
  truth: GroundTruthRect[],
  detected: BoundingBox[]
): { matchedTruth: number; matchedDetected: number } {
  const usedDetected = new Set<number>();
  let matchedTruth = 0;

  for (const t of truth) {
    let bestIdx = -1;
    let bestIou = IOU_THRESHOLD;
    detected.forEach((d, i) => {
      if (usedDetected.has(i)) return;
      const score = iou(t, d);
      if (score > bestIou) {
        bestIou = score;
        bestIdx = i;
      }
    });
    if (bestIdx >= 0) {
      matchedTruth++;
      usedDetected.add(bestIdx);
    }
  }

  return { matchedTruth, matchedDetected: usedDetected.size };
}

function scorePatterns(
  expected: string[],
  detected: string[]
): { precision: number; recall: number; f1: number } {
  const expSet = new Set(expected);
  const detSet = new Set(detected);
  const hits = [...detSet].filter((p) => expSet.has(p)).length;

  const precision = detSet.size ? hits / detSet.size : expSet.size ? 0 : 1;
  const recall = expSet.size ? hits / expSet.size : 1;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

// ---------------------------------------------------------------------------
// Aggregate + render markdown
// ---------------------------------------------------------------------------

function renderReport(results: FixtureResult[]): string {
  const avg = (pick: (r: FixtureResult) => number) =>
    +(results.reduce((s, r) => s + pick(r), 0) / results.length).toFixed(3);

  const avgRecall = avg((r) => r.bbox_recall);
  const avgPrecision = avg((r) => r.bbox_precision);
  const avgPatternF1 = avg((r) => r.pattern_f1);
  const avgDetectMs = avg((r) => r.detect_ms);
  const avgPostMs = avg((r) => r.postprocess_ms);

  const rows = results
    .map(
      (r) =>
        `| ${r.name} | ${r.gt_rect_count} | ${r.detected_region_count} | ${r.bbox_recall} | ${r.bbox_precision} | ${r.pattern_f1} | ${r.detect_ms} | ${r.postprocess_ms} |`
    )
    .join("\n");

  return `# Accuracy Benchmark

Synthetic UI fixtures with known ground-truth bboxes and expected patterns.
See [\`fixtures.ts\`](./fixtures.ts) for definitions.

Methodology:
- Each fixture is rendered to PNG and fed through the full pipeline.
- A detected region matches a ground-truth rect if their **IoU ≥ 0.5**.
- **bbox_recall** = matched truths ÷ total truths.
- **bbox_precision** = matched detections ÷ total detections.
- **pattern_f1** = F1 of expected vs detected pattern sets.
- Timings measured on the run that produced this file.

## Per-fixture results

| Fixture | GT rects | Detected | Recall | Precision | Pattern F1 | Detect ms | Postproc ms |
|---|---:|---:|---:|---:|---:|---:|---:|
${rows}

## Aggregate

| Metric | Value |
|---|---:|
| Avg bbox recall | **${avgRecall}** |
| Avg bbox precision | **${avgPrecision}** |
| Avg pattern F1 | **${avgPatternF1}** |
| Avg detect latency | ${avgDetectMs} ms |
| Avg postprocess latency | ${avgPostMs} ms |

## Detected patterns per fixture

| Fixture | Expected | Detected |
|---|---|---|
${results
  .map(
    (r) =>
      `| ${r.name} | ${r.expected_patterns.join(", ") || "(none)"} | ${r.detected_patterns.join(", ") || "(none)"} |`
  )
  .join("\n")}

## Notes

- These fixtures use solid fills and clear borders, which is a friendly
  case for a Sobel-based detector. Real UIs with anti-aliased text and
  subtle strokes will skew bbox recall lower; adjust \`EDGE_THRESHOLD\` in
  \`src/pipeline/detect.ts\` when tuning for specific datasets.
- Pattern detection is intentionally conservative — only configurations
  with 3+ uniform siblings are flagged as \`card_grid\` / \`list\`.
- This benchmark measures **structure detection**, not downstream LLM
  code-generation quality. An end-to-end generation benchmark
  (GPT-4V vs MCP-augmented) is planned.

_Run: \`npx tsx benchmarks/run.ts\` (after \`npm run build\`)_
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Running benchmark on ${FIXTURES.length} fixtures...\n`);

  const results: FixtureResult[] = [];
  for (const fixture of FIXTURES) {
    const r = await runFixture(fixture);
    results.push(r);
    console.log(
      `${r.name.padEnd(24)} recall=${r.bbox_recall.toFixed(2)}  prec=${r.bbox_precision.toFixed(2)}  patF1=${r.pattern_f1.toFixed(2)}  (${r.detect_ms + r.postprocess_ms}ms)`
    );
  }

  const report = renderReport(results);
  const outPath = "benchmarks/accuracy.md";
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, report);
  console.log(`\nReport written: ${outPath}`);

  const jsonPath = "benchmarks/accuracy.json";
  writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`Raw JSON: ${jsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
