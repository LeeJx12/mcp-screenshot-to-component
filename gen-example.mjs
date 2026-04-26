/**
 * Generate output.png and output.json for every example directory.
 *
 * Looks for examples/<name>/input.svg, runs the full pipeline, and writes:
 *   - examples/<name>/input.png (rendered)
 *   - examples/<name>/output.json (component tree)
 *
 * Usage: node gen-examples.mjs    (after `npm run build`)
 */

import sharp from "sharp";
import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";
import { preprocessImage } from "./dist/pipeline/preprocess.js";
import { detectStructure } from "./dist/pipeline/detect.js";
import { buildComponentTree } from "./dist/pipeline/postprocess.js";

const EXAMPLES_DIR = "./examples";

function cleanNode(n) {
  const out = {
    id: n.id,
    type: n.type,
    bbox: n.bbox,
    layout_hint: n.layout_hint,
  };
  if (n.children && n.children.length > 0) {
    out.children = n.children.map(cleanNode);
  }
  return out;
}

async function processExample(name) {
  const dir = join(EXAMPLES_DIR, name);
  const svgPath = join(dir, "input.svg");
  const pngPath = join(dir, "input.png");
  const jsonPath = join(dir, "output.json");

  const svgBuffer = readFileSync(svgPath);
  const pngBuffer = await sharp(svgBuffer).png().toBuffer();
  writeFileSync(pngPath, pngBuffer);

  const base64 = `data:image/png;base64,${pngBuffer.toString("base64")}`;
  const pre = await preprocessImage(base64);
  const det = await detectStructure(pre, "medium");
  const tree = buildComponentTree(det);

  const output = {
    root: cleanNode(tree.root),
    detected_patterns: tree.patterns,
    confidence: Number(tree.confidence.toFixed(2)),
    region_count: det.regions.length,
  };

  writeFileSync(jsonPath, JSON.stringify(output, null, 2));

  return {
    name,
    regions: det.regions.length,
    patterns: tree.patterns,
    confidence: tree.confidence,
  };
}

async function main() {
  const entries = readdirSync(EXAMPLES_DIR);
  const dirs = entries.filter((e) => {
    try {
      return statSync(join(EXAMPLES_DIR, e)).isDirectory();
    } catch {
      return false;
    }
  });

  console.log(`Processing ${dirs.length} examples...\n`);
  for (const name of dirs) {
    try {
      const r = await processExample(name);
      const pat = r.patterns.length ? r.patterns.join(", ") : "(none)";
      console.log(
        `  ${name.padEnd(20)} regions=${r.regions}  patterns=[${pat}]  conf=${r.confidence.toFixed(2)}`
      );
    } catch (err) {
      console.error(`  ${name}: ERROR ${err.message}`);
    }
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
