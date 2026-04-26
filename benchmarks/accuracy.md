# Accuracy Benchmark

Synthetic UI fixtures with known ground-truth bboxes and expected patterns.
See [`fixtures.ts`](./fixtures.ts) for definitions.

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
| 01_single_card | 1 | 1 | 1 | 1 | 1 | 30 | 0 |
| 02_card_grid_3 | 3 | 3 | 1 | 1 | 1 | 19 | 0 |
| 03_card_grid_2x2 | 4 | 4 | 1 | 1 | 1 | 28 | 1 |
| 04_vertical_list | 4 | 4 | 1 | 1 | 1 | 15 | 0 |
| 05_sidebar_main | 2 | 1 | 0.5 | 1 | 0 | 32 | 0 |
| 06_top_nav | 2 | 1 | 0.5 | 1 | 0 | 21 | 0 |
| 07_dashboard | 6 | 4 | 0.667 | 1 | 0.5 | 59 | 0 |
| 08_form | 5 | 5 | 1 | 1 | 0 | 18 | 0 |
| 09_sidebar_card_grid | 4 | 3 | 0.75 | 1 | 0.667 | 21 | 0 |
| 10_nav_list | 5 | 4 | 0.8 | 1 | 0.667 | 19 | 0 |

## Aggregate

| Metric | Value |
|---|---:|
| Avg bbox recall | **0.822** |
| Avg bbox precision | **1** |
| Avg pattern F1 | **0.583** |
| Avg detect latency | 26.2 ms |
| Avg postprocess latency | 0.1 ms |

## Detected patterns per fixture

| Fixture | Expected | Detected |
|---|---|---|
| 01_single_card | (none) | (none) |
| 02_card_grid_3 | card_grid | card_grid |
| 03_card_grid_2x2 | card_grid | card_grid |
| 04_vertical_list | list | list |
| 05_sidebar_main | sidebar | (none) |
| 06_top_nav | top_nav | (none) |
| 07_dashboard | top_nav, sidebar, card_grid | card_grid |
| 08_form | (none) | list |
| 09_sidebar_card_grid | sidebar, card_grid | card_grid |
| 10_nav_list | top_nav, list | list |

## Notes

- These fixtures use solid fills and clear borders, which is a friendly
  case for a Sobel-based detector. Real UIs with anti-aliased text and
  subtle strokes will skew bbox recall lower; adjust `EDGE_THRESHOLD` in
  `src/pipeline/detect.ts` when tuning for specific datasets.
- Pattern detection is intentionally conservative — only configurations
  with 3+ uniform siblings are flagged as `card_grid` / `list`.
- This benchmark measures **structure detection**, not downstream LLM
  code-generation quality. An end-to-end generation benchmark
  (GPT-4V vs MCP-augmented) is planned.

_Run: `npx tsx benchmarks/run.ts` (after `npm run build`)_
