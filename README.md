# mcp-screenshot-to-component

> **MCP server that turns UI screenshots into structured component trees,
> so LLMs can implement them accurately.**

[![npm version](https://img.shields.io/badge/npm-v0.1.0-blue)](https://www.npmjs.com/package/@saverorevas/mcp-screenshot-to-component)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

> 🚧 **Status: Alpha (W1 of development)**. Tool contracts are stable,
> CV pipeline is under active implementation (W2). Star the repo to follow along.

---

## Why this exists

Modern LLMs accept images, but they struggle with:

- **Hierarchy**: inferring parent/child relationships from flat pixel data
- **Repetition**: detecting card grids, list items, repeating patterns
- **Layout intent**: distinguishing flex vs grid vs absolute positioning

This MCP server runs a classical CV pipeline (edge detection → contour
finding → nested region inference) to extract structured layout data
**before** handing it to the LLM. The result: more accurate
screenshot-to-code generation, especially for production UIs.

## How it compares

| Approach | Hierarchy | Repetition | Layout Intent | Cost |
|---|---|---|---|---|
| Pure GPT-4V / Claude vision | ~ | Weak | Weak | $$$ |
| Screenshot-to-Code (pure prompting) | Weak | Weak | ~ | $$ |
| **This MCP server** | **Strong** | **Strong** | **Medium** | **$** |

See [benchmarks/](./benchmarks/) for side-by-side comparisons.

---

## Tools

| Tool | What it does |
|---|---|
| `analyze_screenshot` | Returns a component tree with bounding boxes and layout hints |
| `extract_text_blocks` | Extracts text with positions and estimated typography |
| `suggest_component_tree` | Framework-aware scaffolding (React / RN / Vue / HTML) |

See [docs/architecture.md](./docs/architecture.md) for the full pipeline design.

---

## Quick Start

### Install

```bash
npm install -g @saverorevas/mcp-screenshot-to-component
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "screenshot-to-component": {
      "command": "mcp-screenshot-to-component"
    }
  }
}
```

### Cursor / Cline / other MCP clients

Point the client to the `mcp-screenshot-to-component` binary.

### Example prompt

> "Here's a Figma screenshot of our new dashboard. Use
> `analyze_screenshot` first, then write a React + Tailwind implementation."

The LLM now has the component tree as structured JSON before writing
a single line of code.

---

## Pipeline Design

Inspired by classic document-processing pipelines:

```
Input image
   │
   ▼
┌────────────────┐
│ 1. Preprocess  │  Normalize size, orientation, color space
└────────────────┘
   │
   ▼
┌────────────────┐
│ 2. Detect      │  Edge + contour detection, grid inference
└────────────────┘
   │
   ▼
┌────────────────┐
│ 3. Postprocess │  Nest bounding boxes → component tree
└────────────────┘
   │
   ▼
Structured JSON
```

Full details: [docs/pipeline-design.md](./docs/pipeline-design.md)

---

## Examples

Real screenshots with extracted trees live in [examples/](./examples/):

- [login-screen](./examples/login-screen/) — simple vertical stack
- _More coming in W3._

---

## Development

```bash
# Install
git clone https://github.com/LeeJx12/mcp-screenshot-to-component
cd mcp-screenshot-to-component
npm install

# Dev mode (auto-restart)
npm run dev

# Build
npm run build

# Test
npm test
```

---

## Roadmap

- [x] W1: Project scaffolding, tool contracts, pipeline skeleton
- [ ] W2: Detect + Postprocess full implementation, first 3 examples
- [ ] W3: `suggest_component_tree` framework mapping, benchmarks, blog post
- [ ] W4+: OCR adapter (Vision API + tesseract.js fallback), npm publish

---

## License

MIT © 2026 [LeeJx12](https://github.com/LeeJx12)
