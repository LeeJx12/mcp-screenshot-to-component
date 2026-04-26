# Example: Signup Form

A standard signup form card with title, four labeled input fields
(name, email, password, confirm password), and a submit button.

## Input

![signup form](./input.png)

The input is a synthetic 800×700 form layout (see `input.svg` for the source).

## Output

See [`output.json`](./output.json) for the full structured tree.

### What the pipeline extracted

- **12 regions** detected — outer card, title, subtitle, 4 label/input pairs,
  and the submit button
- **All 4 input boxes have nearly identical bbox dimensions** (320×44),
  giving the LLM a strong hint that they should share a single component
- **Patterns list is empty** — and that's correct. A form with mixed-size
  labels and a CTA button doesn't fit `card_grid` / `list`. A future
  `form` pattern could detect label-input pairings explicitly.

### What the LLM would see

```json
{
  "region_count": 12,
  "root": {
    "children": [{
      "bbox": { "x": 198, "y": 58, "width": 404, "height": 584 },
      "layout_hint": "absolute",
      "children": [
        // title, subtitle
        // 4× input boxes (uniform size — share one component)
        // submit button
      ]
    }]
  }
}
```

The four uniform input bboxes plus the absolute-positioned card structure
give the LLM enough to emit a single `<FormField>` component reused four
times, rather than four duplicated divs.

## Reproduce

```bash
npm run build
node gen-examples.mjs
```
