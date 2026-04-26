/**
 * Benchmark dataset — 10 synthetic UIs with ground-truth bboxes + patterns.
 *
 * Each fixture defines:
 *   - svg: the rendered input
 *   - truth.rects: bboxes we expect to be detected (drawn shapes)
 *   - truth.patterns: which DetectedPatterns we expect to surface
 *
 * Naming convention for fixtures: snake_case, descriptive of layout.
 */

export interface GroundTruthRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Fixture {
  name: string;
  width: number;
  height: number;
  svg: string;
  truth: {
    rects: GroundTruthRect[];
    patterns: string[];
  };
}

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    rx?: number;
  } = {}
): { svg: string; truth: GroundTruthRect } {
  const fill = opts.fill ?? "#ffffff";
  const stroke = opts.stroke ?? "none";
  const strokeWidth = opts.strokeWidth ?? 0;
  const rx = opts.rx ?? 0;
  const svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="${rx}" />`;
  return { svg, truth: { x, y, width: w, height: h } };
}

function buildSvg(width: number, height: number, parts: string[], bg = "#f9fafb"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<rect width="100%" height="100%" fill="${bg}"/>
${parts.join("\n")}
</svg>`;
}

// ---------------------------------------------------------------------------
// Fixture 1: single centered card
// ---------------------------------------------------------------------------
function fx1SingleCard(): Fixture {
  const card = rect(200, 150, 400, 300, { fill: "#ffffff", stroke: "#e5e7eb", strokeWidth: 1 });
  return {
    name: "01_single_card",
    width: 800,
    height: 600,
    svg: buildSvg(800, 600, [card.svg]),
    truth: { rects: [card.truth], patterns: [] },
  };
}

// ---------------------------------------------------------------------------
// Fixture 2: three-card grid (horizontal row)
// ---------------------------------------------------------------------------
function fx2CardGrid3(): Fixture {
  const cards = [100, 420, 740].map((x) =>
    rect(x, 200, 280, 200, { fill: "#ffffff", stroke: "#e5e7eb", strokeWidth: 1 })
  );
  return {
    name: "02_card_grid_3",
    width: 1120,
    height: 600,
    svg: buildSvg(1120, 600, cards.map((c) => c.svg)),
    truth: { rects: cards.map((c) => c.truth), patterns: ["card_grid"] },
  };
}

// ---------------------------------------------------------------------------
// Fixture 3: 2x2 card grid
// ---------------------------------------------------------------------------
function fx3CardGrid2x2(): Fixture {
  const cards: ReturnType<typeof rect>[] = [];
  for (const y of [100, 380]) {
    for (const x of [100, 460]) {
      cards.push(
        rect(x, y, 300, 240, { fill: "#ffffff", stroke: "#e5e7eb", strokeWidth: 1 })
      );
    }
  }
  return {
    name: "03_card_grid_2x2",
    width: 900,
    height: 700,
    svg: buildSvg(900, 700, cards.map((c) => c.svg)),
    truth: { rects: cards.map((c) => c.truth), patterns: ["card_grid"] },
  };
}

// ---------------------------------------------------------------------------
// Fixture 4: vertical list (4 items)
// ---------------------------------------------------------------------------
function fx4VerticalList(): Fixture {
  const items = [0, 1, 2, 3].map((i) =>
    rect(100, 100 + i * 80, 600, 60, { fill: "#ffffff", stroke: "#e5e7eb", strokeWidth: 1 })
  );
  return {
    name: "04_vertical_list",
    width: 800,
    height: 500,
    svg: buildSvg(800, 500, items.map((c) => c.svg)),
    truth: { rects: items.map((c) => c.truth), patterns: ["list"] },
  };
}

// ---------------------------------------------------------------------------
// Fixture 5: sidebar + main
// ---------------------------------------------------------------------------
function fx5SidebarMain(): Fixture {
  const sidebar = rect(0, 0, 240, 800, { fill: "#1f2937" });
  const main = rect(280, 40, 880, 720, {
    fill: "#ffffff",
    stroke: "#e5e7eb",
    strokeWidth: 1,
  });
  return {
    name: "05_sidebar_main",
    width: 1200,
    height: 800,
    svg: buildSvg(1200, 800, [sidebar.svg, main.svg]),
    truth: {
      rects: [sidebar.truth, main.truth],
      patterns: ["sidebar"],
    },
  };
}

// ---------------------------------------------------------------------------
// Fixture 6: top nav + content
// ---------------------------------------------------------------------------
function fx6TopNav(): Fixture {
  const nav = rect(0, 0, 1200, 72, { fill: "#1f2937" });
  const hero = rect(100, 140, 1000, 300, {
    fill: "#ffffff",
    stroke: "#e5e7eb",
    strokeWidth: 1,
  });
  return {
    name: "06_top_nav",
    width: 1200,
    height: 600,
    svg: buildSvg(1200, 600, [nav.svg, hero.svg]),
    truth: { rects: [nav.truth, hero.truth], patterns: ["top_nav"] },
  };
}

// ---------------------------------------------------------------------------
// Fixture 7: dashboard — top nav + sidebar + card grid + main area
// ---------------------------------------------------------------------------
function fx7Dashboard(): Fixture {
  const nav = rect(0, 0, 1200, 64, { fill: "#1f2937" });
  const sidebar = rect(0, 64, 240, 736, {
    fill: "#ffffff",
    stroke: "#e5e7eb",
    strokeWidth: 1,
  });
  const cards = [272, 572, 872].map((x) =>
    rect(x, 96, 280, 200, { fill: "#ffffff", stroke: "#e5e7eb", strokeWidth: 1 })
  );
  const main = rect(272, 320, 880, 400, {
    fill: "#ffffff",
    stroke: "#e5e7eb",
    strokeWidth: 1,
  });
  return {
    name: "07_dashboard",
    width: 1200,
    height: 800,
    svg: buildSvg(
      1200,
      800,
      [nav.svg, sidebar.svg, ...cards.map((c) => c.svg), main.svg]
    ),
    truth: {
      rects: [nav.truth, sidebar.truth, ...cards.map((c) => c.truth), main.truth],
      patterns: ["top_nav", "sidebar", "card_grid"],
    },
  };
}

// ---------------------------------------------------------------------------
// Fixture 8: form with labeled inputs
// ---------------------------------------------------------------------------
function fx8Form(): Fixture {
  const card = rect(200, 80, 400, 440, {
    fill: "#ffffff",
    stroke: "#e5e7eb",
    strokeWidth: 1,
  });
  const inputs = [
    rect(240, 160, 320, 44, { fill: "#ffffff", stroke: "#d1d5db", strokeWidth: 1 }),
    rect(240, 240, 320, 44, { fill: "#ffffff", stroke: "#d1d5db", strokeWidth: 1 }),
    rect(240, 320, 320, 44, { fill: "#ffffff", stroke: "#d1d5db", strokeWidth: 1 }),
  ];
  const button = rect(240, 410, 320, 48, { fill: "#3b82f6" });
  return {
    name: "08_form",
    width: 800,
    height: 600,
    svg: buildSvg(800, 600, [card.svg, ...inputs.map((i) => i.svg), button.svg]),
    truth: {
      rects: [card.truth, ...inputs.map((i) => i.truth), button.truth],
      patterns: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Fixture 9: card grid with sidebar (combined patterns)
// ---------------------------------------------------------------------------
function fx9SidebarCardGrid(): Fixture {
  const sidebar = rect(0, 0, 200, 600, { fill: "#1f2937" });
  const cards = [240, 540, 840].map((x) =>
    rect(x, 80, 240, 180, { fill: "#ffffff", stroke: "#e5e7eb", strokeWidth: 1 })
  );
  return {
    name: "09_sidebar_card_grid",
    width: 1120,
    height: 600,
    svg: buildSvg(1120, 600, [sidebar.svg, ...cards.map((c) => c.svg)]),
    truth: {
      rects: [sidebar.truth, ...cards.map((c) => c.truth)],
      patterns: ["sidebar", "card_grid"],
    },
  };
}

// ---------------------------------------------------------------------------
// Fixture 10: nav + list (menu items) — mixed
// ---------------------------------------------------------------------------
function fx10NavList(): Fixture {
  const nav = rect(0, 0, 1000, 60, { fill: "#1f2937" });
  const items = [0, 1, 2, 3].map((i) =>
    rect(100, 120 + i * 80, 800, 60, {
      fill: "#ffffff",
      stroke: "#e5e7eb",
      strokeWidth: 1,
    })
  );
  return {
    name: "10_nav_list",
    width: 1000,
    height: 600,
    svg: buildSvg(1000, 600, [nav.svg, ...items.map((i) => i.svg)]),
    truth: {
      rects: [nav.truth, ...items.map((i) => i.truth)],
      patterns: ["top_nav", "list"],
    },
  };
}

export const FIXTURES: Fixture[] = [
  fx1SingleCard(),
  fx2CardGrid3(),
  fx3CardGrid2x2(),
  fx4VerticalList(),
  fx5SidebarMain(),
  fx6TopNav(),
  fx7Dashboard(),
  fx8Form(),
  fx9SidebarCardGrid(),
  fx10NavList(),
];
