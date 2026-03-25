# WKS Grid Engine — Claude Code Handoff

## Project Overview

An interactive generative design toolkit for the **Worst Kept Secret (WKS)** brand identity. The tool renders the WKS logo lockup on a pixel grid and lets the user apply noise-driven animations, symbol patterns, color gradients, and layered compositions to explore brand pattern assets.

This is a creative/design tool for an ad agency creative director. It needs to feel responsive, look polished, and export production-quality SVG/PNG.

---

## Grid System Mathematics

The entire identity is built on a unified **15px micro-grid unit**.

### Icon (WKS Monogram)
- **6×6 macro cells**, each macro cell = **4 micro units** (60px)
- Icon total = **24×24 micro units** (360×360px)
- The W sits on top (rows 0–7), K and S sit below (rows 8–23)

### Wordmark (WORST KEPT SECRET)
- Three stacked word lines, each **6 micro units tall** (3 character cells × 2 micro units per character cell)
- Character cell = **30px = 2 micro units**
- **Gap between word lines = 3 micro units (45px)**
- Total height: 6 + 3 + 6 + 3 + 6 = **24 micro units** (matches icon height exactly)
- This is the key design constraint — the three lines + two equal gaps tile perfectly into the icon height

### Full Lockup
- **70 × 24 micro units** (1050 × 360px)
- Icon occupies cols 0–23, wordmark occupies cols 24–69
- No gap between icon and wordmark in the SVG (they share the boundary)

### Source SVGs
- `newWKS.svg` — the redesigned full lockup SVG (1050×360, all 30×30 rects)
- `wks.svg` — the original icon-only SVG (420×420, 70×70 rects, old grid system — kept for reference but superseded)
- `FullWordMark.svg` — the original wordmark SVG (1225×420, old grid system — superseded by newWKS.svg)

Note: `newWKS.svg` has some sub-pixel x positions (540.646, 570.646, etc.) from Figma snapping drift. These round correctly to the 30px grid but should be cleaned up if precision matters.

---

## Current State (v5 — last working version)

The v5 HTML file was accidentally deleted during a v6 rewrite attempt, but the architecture is fully documented here. The app was a single HTML file with inline JS — no build system, no dependencies.

### What v5 had working:
1. **Canvas rendering** — HTML5 Canvas with retina support (2x DPR when cells ≥ 4px)
2. **Mask system** — Full Lockup (70×24), Icon Only (24×24), Full Grid (no mask). Masks stored as string arrays parsed to 2D number arrays.
3. **Resolution slider** — 1× to 4× subdivision of the base grid
4. **Padding** — 3 base-grid-cells of whitespace around the mask content, scaling with resolution
5. **12 symbol types** — solid, plus, circle, donut, diamond, checker, hlines, vlines, cross, triangle, ring, dot. Each is a draw function: `(ctx, x, y, cellSize, color, strokeWeight, scale) => void`
6. **Simplex noise engine** — 2D+3D simplex noise with fractal brownian motion (octaves). Uses the z-axis as time for animation.
7. **4 noise-driven channels**, each independently toggleable:
   - **Symbol type** — noise value picks which symbol from the active set
   - **Scale** — maps noise 0–1 to a min/max scale range per cell
   - **Color** — maps noise 0–1 to a position on a multi-stop gradient
   - **Fill threshold** — below a cutoff value, cells go empty (organic dissolving edges)
8. **Multi-stop color gradient** — draggable stops, color picker, add/remove stops, 8 presets
9. **Stable non-driven channels** — when a channel isn't noise-driven, it uses spatially-seeded static noise (no time component) so it doesn't flicker during animation
10. **Export** — PNG (canvas.toDataURL) and SVG (programmatic string construction)
11. **Click-to-toggle** — click any cell to manually flip filled/empty

### Key noise parameters:
- **Scale** (1–100) — controls spatial frequency. Lower = larger blobs, higher = tighter texture. Internally: `freq = 1 / (noiseScale/100 * max(cols,rows) + 1)`
- **Speed** (0–200) — time increment per frame. Set very low (0.00002 × speed per rAF) for cloud-like drift
- **Octaves** (1–4) — fractal detail layers
- **Fill cutoff** (0–1) — threshold below which noise-driven fill goes empty
- **Scale min/max** — range for noise-driven cell scaling

### Noise channel offsets (to keep channels correlated but not identical):
- Color: base noise (nx, ny, nz)
- Symbol: offset (+7.3, +3.7)
- Scale: offset (+13.1, +11.9), time × 0.9
- Fill: offset (+19.7, +17.3), time × 1.1
- Static symbol: offset (+41.2, +37.5), time = 0
- Static color: offset (+53.6, +47.1), time = 0
- Static density: offset (+31.4, +27.8), time = 0

---

## What Needs to Be Built Next (v6)

### 1. Background Color
Simple — let the user pick a canvas background color (currently hardcoded `#f5f2eb`). A color picker in the panel.

### 2. Layer System (the big one)

**Architecture:** 3–4 layers max, each with its own complete set of settings:
- Own noise parameters (on/off, scale, speed, octaves, channel drives)
- Own symbol set (which symbols are active)
- Own color gradient
- Own fill density / scale / stroke
- Z-order (drag to reorder)
- Blend mode (normal, multiply, overlay, screen, etc.)
- Visibility toggle
- Opacity

**Rendering approach:**
Each layer renders to its own offscreen canvas. Layers composite bottom-to-top onto the main canvas using `globalCompositeOperation` for blend modes and `globalAlpha` for opacity.

**Important:** Many symbols are "see-through" (donut, cross, hlines, vlines, ring, checker). When layers stack, you should see lower layers through the gaps in upper-layer symbols. This means each layer's offscreen canvas needs a transparent background, and blend modes apply to the composited result.

**UI approach:**
The panel becomes a layer stack. Each layer is a collapsible accordion section with a header showing: layer name, visibility eye icon, blend mode dropdown, opacity slider, up/down reorder buttons. Expanding a layer reveals all its noise/symbol/gradient/fill controls (same UI as v5 but scoped to that layer).

A "+" button adds a new layer (up to 4 max). Each new layer starts as a copy of the default settings.

**The mask is shared across all layers** — it defines the overall shape (lockup / icon / full). Layers control what fills the cells within that shape.

### Layer compositing pseudocode:
```
mainCtx.fillStyle = backgroundColor
mainCtx.fillRect(0, 0, w, h)

for each layer (bottom to top):
  if !layer.visible: skip
  
  // Render layer to its offscreen canvas (transparent bg)
  layerCtx.clearRect(0, 0, w, h)
  for each cell:
    sample layer's noise at (col, row, layer.time)
    determine fill, symbol, scale, color from layer's settings
    draw symbol to layerCtx
  
  // Composite onto main canvas
  mainCtx.globalAlpha = layer.opacity
  mainCtx.globalCompositeOperation = layer.blendMode
  mainCtx.drawImage(layerCanvas, 0, 0)

mainCtx.globalAlpha = 1
mainCtx.globalCompositeOperation = 'source-over'

// Draw grid lines and macro grid on top
```

### Blend modes to support:
`normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`

These map directly to Canvas2D `globalCompositeOperation` values.

---

## Mask Data

### Full Lockup (70×24 at 15px micro)
```javascript
const LOCKUP = [
  "1111000011110000111100001100110011001111110011111100111100111111000000",
  "1111000011110000111100001100110011001111110011111100111100111111000000",
  "1111000011110000111100001111111111001100110011000000110000001100000000",
  "1111000011110000111100001111111111001100110011000000110000001100000000",
  "1111111111111111111100000011001100001111110011000011110000001100000000",
  "1111111111111111111100000011001100001111110011000011110000001100000000",
  "1111111111111111111100000000000000000000000000000000000000000000000000",
  "1111111111111111111100000000000000000000000000000000000000000000000000",
  "0000111100001111000000000000000000000000000000000000000000000000000000",
  "0000111100001111000000000000110011001111110011111100111111000000000000",
  "0000111100001111000000000000110011001111110011111100111111000000000000",
  "0000111100001111000000000000111100001111000011111100001100000000000000",
  "1111000011110000111111110000111100001111000011111100001100000000000000",
  "1111000011110000111111110000110011001111110011000000001100000000000000",
  "1111000011110000111111110000110011001111110011000000001100000000000000",
  "1111000011110000111111110000000000000000000000000000000000000000000000",
  "1111111100000000111100000000000000000000000000000000000000000000000000",
  "1111111100000000111100000000000000000000000000000000000000000000000000",
  "1111111100000000111100000011110011111100111111001111110011111100111111",
  "1111111100000000111100000011110011111100111111001111110011111100111111",
  "1111000011111111111100000011000011110000110000001100000011110000001100",
  "1111000011111111111100000011000011110000110000001100000011110000001100",
  "1111000011111111111100001111000011111100111111001100000011111100001100",
  "1111000011111111111100001111000011111100111111001100000011111100001100",
].map(s => s.split('').map(Number));
```

### Icon Only (24×24 at 15px micro)
```javascript
const ICON = [
  "111100001111000011110000","111100001111000011110000",
  "111100001111000011110000","111100001111000011110000",
  "111111111111111111110000","111111111111111111110000",
  "111111111111111111110000","111111111111111111110000",
  "000011110000111100000000","000011110000111100000000",
  "000011110000111100000000","000011110000111100000000",
  "111100001111000011111111","111100001111000011111111",
  "111100001111000011111111","111100001111000011111111",
  "111111110000000011110000","111111110000000011110000",
  "111111110000000011110000","111111110000000011110000",
  "111100001111111111110000","111100001111111111110000",
  "111100001111111111110000","111100001111111111110000",
].map(s => s.split('').map(Number));
```

---

## Tech Recommendations for Claude Code

### Suggested stack:
- **Vite + vanilla TypeScript** — fast iteration, no framework overhead needed
- **HTML5 Canvas** for rendering (not SVG DOM — too many elements at high res)
- **Single-page app**, no routing
- Structure:
  ```
  src/
    main.ts          — entry, init, animation loop
    state.ts         — layer state, global state, defaults
    noise.ts         — simplex noise + fbm
    symbols.ts       — symbol draw functions
    gradient.ts      — gradient sampling, stop management
    renderer.ts      — per-layer rendering, compositing
    masks.ts         — LOCKUP, ICON data + mask generation
    ui/
      panel.ts       — panel rendering, layer accordion
      controls.ts    — slider/toggle/gradient UI bindings
    export.ts        — PNG + SVG export
  ```

### Performance notes:
- At 1× resolution, lockup = 76×30 grid with padding = ~2,280 cells. Trivial.
- At 4× resolution = ~36,480 cells × 4 layers = ~146k symbol draws per frame. Canvas handles this fine at 60fps.
- Offscreen canvases for layers: create once, resize with layout changes.
- The noise sampling is the bottleneck at high res/octaves. Consider caching the noise field and only recomputing when time ticks (not every rAF).

### Future phases (not for this build, but keep the architecture open):
- **Phase 3: Image-to-grid dithering** — drop an image, sample it to grid resolution, map to symbol/color
- **Phase 4: Grid editor** — click-to-draw letterforms, save/load states
- **Video export** — record animation frames to WebM/MP4

---

## Design / UI Notes

- Panel is dark (`#0a0a0a` / `#111111`), canvas background defaults to `#f5f2eb` (warm off-white)
- Font: Space Mono (monospace, fits the pixel-grid aesthetic)
- Controls are compact — 10–11px labels, small toggles, thin range sliders
- The layer accordion should be the primary organizational element in the panel
- Keep the overall panel width around 320–330px
- Badge overlay on canvas shows current grid dimensions

---

## Inspiration References

These images were shared during the design process (not included in repo, but describe the aesthetic targets):

1. **Grid pattern tiles** — 6×6 squares filled with different geometric patterns (plus, circle, donut, checkerboard, lines, etc.) in monochrome. Like QR codes but decorative.
2. **Felipe Pantone-style pixel gradients** — bold color bands (blue, cyan, white, yellow, red, black) rendered as pixel grids, creating dithered color transitions.
3. **Generative portrait** — a photograph "pixelated" through a symbol grid, where each cell uses a different symbol (circles, crosses, squares, lines) and the symbol density/size maps to the image's tonal values. Multiple colors.
4. **Layered pixel "M" letterforms** — the letter M rendered in multiple overlapping pixel layers in red, green, blue, black — showing how layered grids create depth and visual complexity.
5. **Yellow/black noise-driven pattern** — WKS-style grid where symbol type and size vary smoothly across the grid driven by noise. Zones of solid fills blend into checkerboards into dots into empty space. Single color (yellow on black).
6. **Spoon album art** — clean circle grid where dot size follows a smooth gradient (likely radial or diagonal noise), creating an elegant size-modulation pattern. White on black.
