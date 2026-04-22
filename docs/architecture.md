# Architecture

## Overview

`mcp-screenshot-to-component` is a stateless MCP server that transforms
UI screenshots into structured component trees. It exposes three tools
to MCP clients (Claude Desktop, Cursor, Cline, etc.) over stdio.

## System Diagram

```
┌──────────────────┐  stdio/JSON-RPC  ┌──────────────────────────┐
│  MCP Client      │◀──────────────▶ │  mcp-screenshot-to-       │
│  (Claude, etc.)  │                  │  component server         │
└──────────────────┘                  │                          │
                                      │  ┌────────────────────┐  │
                                      │  │ Tool Router        │  │
                                      │  └────────┬───────────┘  │
                                      │           ▼              │
                                      │  ┌────────────────────┐  │
                                      │  │ CV Pipeline        │  │
                                      │  │  ① Preprocess      │  │
                                      │  │  ② Detect          │  │
                                      │  │  ③ Postprocess     │  │
                                      │  └────────┬───────────┘  │
                                      │           ▼              │
                                      │  ┌────────────────────┐  │
                                      │  │ Adapters           │  │
                                      │  │  - Vision API      │  │
                                      │  │  - OpenCV (Py)     │  │
                                      │  └────────────────────┘  │
                                      └──────────────────────────┘
```

## Why stdio (not HTTP)?

MCP's reference transport is stdio with JSON-RPC 2.0. Every MCP client
spawns the server as a subprocess. This gives us:

- Zero network exposure (security)
- No port conflicts
- Simple lifecycle (client owns the process)

HTTP is supported by the spec but not needed for this server.

## Why classic CV (not pure ML)?

Running a YOLO-style model would work but adds:

- 200MB+ model weights in the npm package
- GPU-or-slow-CPU dependency
- Opaque failure modes

Classical CV (edges → contours → heuristics) is:

- Fully deterministic, debuggable
- Sub-100ms on CPU for typical screenshots
- Good enough for the "give the LLM structure" goal
  — we're not trying to replace the LLM, we're augmenting it

This mirrors the design choice behind the author's production PV Blur
pipeline, which also used OpenCV + Vision API rather than a custom
ML model.

## Extensibility

Adapters in `src/adapters/` allow swapping OCR backends:

- `vision-api.adapter.ts` — Google Cloud Vision (higher accuracy, costs money)
- `opencv-python.adapter.ts` — local OpenCV via Python sidecar IPC
- (future) `tesseract.adapter.ts` — pure JS fallback, zero dependencies

The pipeline stages communicate via pure data structures (see
`src/types/index.ts`), so new stages can be inserted or swapped without
touching the tool layer.

## References

- [MCP specification](https://modelcontextprotocol.io)
- [Pipeline design details](./pipeline-design.md)
- [Why not pure LLM?](./why-not-pure-llm.md)
