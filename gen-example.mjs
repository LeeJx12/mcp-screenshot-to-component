import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { preprocessImage } from "./dist/pipeline/preprocess.js";
import { detectStructure } from "./dist/pipeline/detect.js";
import { buildComponentTree } from "./dist/pipeline/postprocess.js";

const svgBuffer = readFileSync("./examples/login-screen/input.svg");
const pngBuffer = await sharp(svgBuffer).png().toBuffer();
writeFileSync("./examples/login-screen/input.png", pngBuffer);

const base64 = `data:image/png;base64,${pngBuffer.toString("base64")}`;
const pre = await preprocessImage(base64);
const det = await detectStructure(pre, "medium");
const tree = buildComponentTree(det);

function cleanNode(n) {
  const out = {
    id: n.id,
    type: n.type,
    bbox: n.bbox,
    layout_hint: n.layout_hint,
  };
  if (n.children && n.children.length > 0) out.children = n.children.map(cleanNode);
  return out;
}

const output = {
  root: cleanNode(tree.root),
  detected_patterns: tree.patterns,
  confidence: Number(tree.confidence.toFixed(2)),
  region_count: det.regions.length,
};

writeFileSync(
  "./examples/login-screen/output.json",
  JSON.stringify(output, null, 2)
);

console.log("=== login-screen example generated ===");
console.log(`Regions: ${det.regions.length}`);
console.log(`Patterns: ${tree.patterns.join(", ") || "(none)"}`);
console.log(`Confidence: ${tree.confidence.toFixed(2)}`);
