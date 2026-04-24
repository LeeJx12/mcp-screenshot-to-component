# Example: Login Screen

A standard centered login card with logo, title, subtitle, two labeled inputs,
a "forgot password" link, and a submit button.

## Input

![login screen](./input.png)

The input is a synthetic 800×600 screenshot (see `input.svg` for the source).

## Output

See [`output.json`](./output.json) for the full structured tree.

### What the pipeline extracted

- **9 regions** detected (1 card container + 8 interior elements)
- **Nesting worked correctly**: all 8 interior elements were placed as
  children of the outer card, not as siblings at root level
- `layout_hint: "absolute"` on the card — correct, because form fields,
  labels, and a logo don't fit a pure stack/grid pattern

### What the LLM would see

Instead of raw pixels, the LLM receives:

```json
{
  "root": {
    "layout_hint": "single",
    "children": [
      {
        "bbox": { "x": 238, "y": 118, "width": 324, "height": 404 },
        "layout_hint": "absolute",
        "children": [
          // 8 interior elements with bbox + layout_hint each
        ]
      }
    ]
  }
}
```

From this, a follow-up prompt like
_"generate a React login component matching this structure"_
produces a much tighter implementation than passing the raw image alone.

## Why patterns list is empty

The login form doesn't match any of the implemented arrangement patterns
(`card_grid`, `list`, `sidebar`, `top_nav`). This is expected and correct —
a login card is a one-off layout, not a repeating structure.

Future iterations may add a `form` pattern to recognize label/input pairings.

## Reproduce

```bash
npm run build
node gen-example.mjs
```
