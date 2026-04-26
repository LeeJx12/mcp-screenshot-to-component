# Examples

Real input → output pairs from running the pipeline on synthetic UI screenshots.
Each example shows what an LLM client would receive when calling
`analyze_screenshot` on the input image.

| Example | Pattern detected | Region count | Notes |
|---|---|---:|---|
| [login-screen](./login-screen/) | (none) | 9 | Form-like layout, no repeating structure |
| [signup-form](./signup-form/) | (none) | 12 | 4 uniform input bboxes hint reusability |
| [dashboard](./dashboard/) | `card_grid`, `list` | 10 | Both arrangement patterns surfaced |

## Generating examples

```bash
npm run build
node gen-examples.mjs
```

This regenerates `input.png` and `output.json` for every directory under
`examples/`. Add a new example by creating a directory with `input.svg`,
then running the script.

## Why these examples

The pipeline's value is most visible when comparing what the LLM gets:

- **Without MCP**: raw pixels. The LLM has to infer hierarchy from scratch
  every time, often producing flat unstructured DOM or redundant duplication.
- **With MCP**: a tree of bboxes, layout hints, and pattern labels. The
  LLM can emit cleaner JSX with reusable components and proper layout
  primitives (`grid`, `flex`).

The dashboard example is the clearest demonstration: detecting `card_grid`
+ `list` lets the LLM produce a `<Sidebar>` + `<Card />.map()` structure
instead of 6 hand-laid-out divs.
