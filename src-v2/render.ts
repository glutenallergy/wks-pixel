// ── Rendering ─────────────────────────────────────────────
// One pipeline: sample → (quantize to palette) → per-cell spec → draw.
// Canvas render and SVG export both consume buildCells() so they match.

import { sampleImage, adjustBrightness, adjustRGB } from './image';
import { drawSymbol } from './symbols';
import { quantizeRGB, quantizeBrightness } from './dither';
import type { V2State } from './state';

// Stable per-cell pseudo-random (0..1) for scatter mode — no Math.random so
// the result is deterministic across re-renders.
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export interface Grid {
  cols: number;
  rows: number;
  lum: Float32Array; // adjusted, 0..1
  rgb: Float32Array; // adjusted, 0..1, length*3
}

export interface CellSpec {
  col: number;
  row: number;
  kind: string; // native symbol kind, or an "icon:prefix:name" id
  color: string;
  scale: number;
}

const MAX_ROWS = 400;

export function computeGrid(img: HTMLImageElement, s: V2State): Grid {
  const cols = Math.max(2, Math.round(s.gridCols));
  const aspect = img.naturalWidth / img.naturalHeight;
  const rows = Math.min(MAX_ROWS, Math.max(2, Math.round(cols / aspect)));
  const sampled = sampleImage(img, cols, rows);
  const lum = adjustBrightness(sampled.lum, s);
  const rgb = adjustRGB(sampled.rgb, s);
  return { cols, rows, lum, rgb };
}

// ── Color helpers ──
function parseHex(h: string): [number, number, number] {
  let x = h.replace('#', '');
  if (x.length === 3) x = x.split('').map((c) => c + c).join('');
  return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
}
function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function lerpColor(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

/** Quantize tone to N bands, return its position 0..1 (for gradient stepping). */
function bandedTone(tone: number, n: number): number {
  const q = Math.max(0, Math.min(n - 1, Math.floor(tone * n)));
  return n > 1 ? q / (n - 1) : 0;
}

/** Shape (symbol kind + scale) for a cell, from its tone. Null = empty cell. */
function cellShape(tone: number, s: V2State): { kind: string; scale: number } | null {
  if (s.style === 'blocks') return { kind: 'solid', scale: 1 };
  if (s.style === 'halftone') {
    const darkness = 1 - tone;
    if (darkness <= 0.04) return null;
    return { kind: 'circle', scale: darkness };
  }
  // symbols — the active set IS the ramp, in the user's order (symbols[0] =
  // darkest band), plus an empty highlight bucket so the brightest tone reads
  // as blank paper.
  const set = s.symbols;
  const M = set.length;
  if (M === 0) return null;
  const buckets = M + 1;
  const b = Math.max(0, Math.min(buckets - 1, Math.floor(tone * buckets)));
  if (b === M) return null;
  return { kind: set[b], scale: 1 };
}

/** Non-palette color for a cell from its tone. */
function toneColor(tone: number, s: V2State): string {
  if (s.colorMode === 'gradient') return lerpColor(s.colorDark, s.colorLight, bandedTone(tone, s.levels));
  return s.inkColor; // mono
}

/** Build the per-cell draw list for the whole grid. */
export function buildCells(grid: Grid, s: V2State): CellSpec[] {
  const { cols, rows, lum, rgb } = grid;
  const n = cols * rows;

  // tone: 0 = treat-as-dark, 1 = treat-as-light
  const tone = new Float32Array(n);
  for (let i = 0; i < n; i++) tone[i] = s.invert ? 1 - lum[i] : lum[i];

  // Palette field (indices into s.palette), only when needed
  let field: Int32Array | null = null;
  if (s.colorMode === 'palette' && s.palette.length >= 2) {
    field =
      s.paletteMatch === 'rgb'
        ? quantizeRGB(rgb, cols, rows, s.palette, s.dither)
        : quantizeBrightness(tone, cols, rows, s.palette, s.dither);
  }

  const scatter = s.scatter && s.style === 'symbols' && s.symbols.length > 0;

  const cells: CellSpec[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const shape = cellShape(tone[i], s);
      if (!shape) continue;
      // Scatter: keep tone-driven presence (empty highlights) but randomize
      // which symbol fills the cell, for a decorative sprinkle.
      const kind = scatter ? s.symbols[Math.floor(hash2(col, row) * s.symbols.length)] : shape.kind;
      const color = field ? s.palette[field[i]] : toneColor(tone[i], s);
      cells.push({ col, row, kind, color, scale: shape.scale });
    }
  }
  return cells;
}

/** Synthetic dark→light gradient grid for the tone preview. */
export function makePreviewGrid(cols: number, rows: number): Grid {
  const lum = new Float32Array(cols * rows);
  const rgb = new Float32Array(cols * rows * 3);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const v = cols > 1 ? col / (cols - 1) : 0;
      const i = row * cols + col;
      lum[i] = v;
      rgb[i * 3] = v;
      rgb[i * 3 + 1] = v;
      rgb[i * 3 + 2] = v;
    }
  }
  return { cols, rows, lum, rgb };
}

/** Render the current settings across a dark→light gradient into a small canvas. */
export function renderPreview(canvas: HTMLCanvasElement, s: V2State, cols = 40, rows = 6): void {
  const grid = makePreviewGrid(cols, rows);
  const cells = buildCells(grid, s);
  const CP = 10;
  const dpr = window.devicePixelRatio || 1;
  const W = cols * CP;
  const H = rows * CP;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = s.bgColor;
  ctx.fillRect(0, 0, W, H);
  for (const c of cells) {
    drawSymbol(ctx, c.kind, c.col * CP + CP / 2, c.row * CP + CP / 2, CP, c.color, c.scale);
  }
}

/** Render the grid to a display canvas, fitting viewW×viewH with retina support. */
export function renderToCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  s: V2State,
  viewW: number,
  viewH: number,
): Grid {
  const g = computeGrid(img, s);
  const cells = buildCells(g, s);
  const cell = Math.max(1, Math.floor(Math.min(viewW / g.cols, viewH / g.rows)));
  const dpr = window.devicePixelRatio || 1;
  const cssW = g.cols * cell;
  const cssH = g.rows * cell;

  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = s.bgColor;
  ctx.fillRect(0, 0, cssW, cssH);

  for (const c of cells) {
    drawSymbol(ctx, c.kind, c.col * cell + cell / 2, c.row * cell + cell / 2, cell, c.color, c.scale);
  }
  return g;
}
