import type { LayerState } from './state';
import type { LayoutInfo } from './renderer';
import { SimplexNoise } from './noise';
import { getMaskData } from './masks';
import type { AppState } from './state';
import { sampleGradient } from './gradient';

interface Point { x: number; y: number }
interface Segment { a: Point; b: Point }

// ── Noise helpers (mirrored from renderer) ────
const OFF = {
  fill:       { x: 19.7, y: 17.3 },
  staticFill: { x: 31.4, y: 27.8 },
};

function sample(
  n: SimplexNoise, col: number, row: number, freq: number,
  time: number, ox: number, oy: number, octaves: number, ts: number = 1,
): number {
  const raw = n.fbm3D(col * freq + ox, row * freq + oy, time * ts, octaves);
  return Math.max(0, Math.min(1, (raw + 1) / 2));
}

// ── Build fill grid (for export path — renderer uses inline version) ──
export function buildFillGrid(
  layer: LayerState,
  layout: LayoutInfo,
  maskLookup: Uint8Array,
  n: SimplexNoise,
): Uint8Array {
  const { totalCols, totalRows } = layout;
  const maxDim = Math.max(totalCols, totalRows);
  const freq = layer.noiseScale / (10 * maxDim);
  const lo = layer.noiseOffset;
  const loY = lo * 0.7;
  const grid = new Uint8Array(totalCols * totalRows);

  for (let row = 0; row < totalRows; row++) {
    for (let col = 0; col < totalCols; col++) {
      if (!maskLookup[row * totalCols + col]) continue;

      if (layer.fillDriven) {
        if (sample(n, col, row, freq, layer.time, OFF.fill.x + lo, OFF.fill.y + loY, layer.noiseOctaves, 1.1) < layer.fillCutoff) continue;
      } else {
        if (sample(n, col, row, freq, 0, OFF.staticFill.x + lo, OFF.staticFill.y + loY, layer.noiseOctaves) < layer.fillCutoff) continue;
      }

      grid[row * totalCols + col] = 1;
    }
  }

  return grid;
}

// ── Pad grid with zeros ───────────────────────
function padGrid(grid: Uint8Array, cols: number, rows: number): { padded: Uint8Array; pCols: number; pRows: number } {
  const pCols = cols + 2;
  const pRows = rows + 2;
  const padded = new Uint8Array(pCols * pRows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      padded[(r + 1) * pCols + (c + 1)] = grid[r * cols + c];
    }
  }
  return { padded, pCols, pRows };
}

// ── Marching squares segment extraction ───────
//
// Corner layout for each 2×2 block at (i, j):
//   TL = (i,   j)     TR = (i+1, j)
//   BL = (i,   j+1)   BR = (i+1, j+1)
//
// Case index = TL*8 + TR*4 + BR*2 + BL*1
//
// Edge midpoints:
//   top    = (i+0.5, j)
//   right  = (i+1,   j+0.5)
//   bottom = (i+0.5, j+1)
//   left   = (i,     j+0.5)

type Edge = 'top' | 'right' | 'bottom' | 'left';

function edgeMidpoint(i: number, j: number, edge: Edge): Point {
  switch (edge) {
    case 'top':    return { x: i + 0.5, y: j };
    case 'right':  return { x: i + 1,   y: j + 0.5 };
    case 'bottom': return { x: i + 0.5, y: j + 1 };
    case 'left':   return { x: i,       y: j + 0.5 };
  }
}

// Case table: each case maps to 0–2 segments defined by edge pairs
const CASES: [Edge, Edge][][] = [
  /* 0  0000 */ [],
  /* 1  0001 */ [['left', 'bottom']],
  /* 2  0010 */ [['bottom', 'right']],
  /* 3  0011 */ [['left', 'right']],
  /* 4  0100 */ [['top', 'right']],
  /* 5  0101 */ [['top', 'left'], ['bottom', 'right']],   // saddle
  /* 6  0110 */ [['top', 'bottom']],
  /* 7  0111 */ [['top', 'left']],
  /* 8  1000 */ [['top', 'left']],
  /* 9  1001 */ [['top', 'bottom']],
  /* 10 1010 */ [['top', 'right'], ['left', 'bottom']],   // saddle
  /* 11 1011 */ [['top', 'right']],
  /* 12 1100 */ [['left', 'right']],
  /* 13 1101 */ [['bottom', 'right']],
  /* 14 1110 */ [['left', 'bottom']],
  /* 15 1111 */ [],
];

function extractSegments(padded: Uint8Array, pCols: number, pRows: number): Segment[] {
  const segments: Segment[] = [];
  for (let j = 0; j < pRows - 1; j++) {
    for (let i = 0; i < pCols - 1; i++) {
      const tl = padded[j * pCols + i];
      const tr = padded[j * pCols + (i + 1)];
      const br = padded[(j + 1) * pCols + (i + 1)];
      const bl = padded[(j + 1) * pCols + i];
      const caseIdx = tl * 8 + tr * 4 + br * 2 + bl;
      const edges = CASES[caseIdx];
      for (const [e1, e2] of edges) {
        segments.push({
          a: edgeMidpoint(i, j, e1),
          b: edgeMidpoint(i, j, e2),
        });
      }
    }
  }
  return segments;
}

// ── Chain segments into closed polylines ──────
function ptKey(p: Point): string {
  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
}

function chainSegments(segments: Segment[]): Point[][] {
  if (segments.length === 0) return [];

  // Build adjacency: point → list of (segmentIndex, otherEndpoint)
  const adj = new Map<string, { segIdx: number; other: Point }[]>();
  for (let si = 0; si < segments.length; si++) {
    const s = segments[si];
    const ka = ptKey(s.a);
    const kb = ptKey(s.b);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka)!.push({ segIdx: si, other: s.b });
    adj.get(kb)!.push({ segIdx: si, other: s.a });
  }

  const visited = new Uint8Array(segments.length);
  const polylines: Point[][] = [];

  for (let si = 0; si < segments.length; si++) {
    if (visited[si]) continue;

    const chain: Point[] = [segments[si].a, segments[si].b];
    visited[si] = 1;

    // Walk forward from chain end
    let walking = true;
    while (walking) {
      walking = false;
      const endKey = ptKey(chain[chain.length - 1]);
      const neighbors = adj.get(endKey);
      if (neighbors) {
        for (const n of neighbors) {
          if (!visited[n.segIdx]) {
            visited[n.segIdx] = 1;
            chain.push(n.other);
            walking = true;
            break;
          }
        }
      }
    }

    // Walk backward from chain start
    walking = true;
    while (walking) {
      walking = false;
      const startKey = ptKey(chain[0]);
      const neighbors = adj.get(startKey);
      if (neighbors) {
        for (const n of neighbors) {
          if (!visited[n.segIdx]) {
            visited[n.segIdx] = 1;
            chain.unshift(n.other);
            walking = true;
            break;
          }
        }
      }
    }

    // Remove duplicate closing point if chain is closed
    if (chain.length > 2 && ptKey(chain[0]) === ptKey(chain[chain.length - 1])) {
      chain.pop();
    }

    if (chain.length >= 3) {
      polylines.push(chain);
    }
  }

  return polylines;
}

// ── Public: compute contours from fill grid ───
export function computeContours(
  fillGrid: Uint8Array,
  cols: number,
  rows: number,
): Point[][] {
  const { padded, pCols, pRows } = padGrid(fillGrid, cols, rows);
  const segments = extractSegments(padded, pCols, pRows);
  return chainSegments(segments);
}

// ── Render contours to Canvas2D ───────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function renderContours(
  ctx: CanvasRenderingContext2D,
  contours: Point[][],
  cellSize: number,
  layer: LayerState,
): void {
  if (contours.length === 0) return;

  ctx.strokeStyle = layer.outlineColor;
  ctx.lineWidth = layer.outlineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const poly of contours) {
    if (poly.length < 3) continue;

    const n = poly.length;
    // Convert from padded grid coords to pixel coords
    // Subtract 1 to undo the padding offset
    const px = (p: Point) => (p.x - 1) * cellSize;
    const py = (p: Point) => (p.y - 1) * cellSize;

    ctx.beginPath();

    if (layer.outlineSmooth <= 0) {
      // Angular: straight segments
      ctx.moveTo(px(poly[0]), py(poly[0]));
      for (let i = 1; i < n; i++) {
        ctx.lineTo(px(poly[i]), py(poly[i]));
      }
      ctx.closePath();
    } else {
      // Bezier smoothing: vertices become control points,
      // curve endpoints are midpoints between consecutive vertices
      const smooth = layer.outlineSmooth;
      const lastPx = px(poly[n - 1]);
      const lastPy = py(poly[n - 1]);
      const firstPx = px(poly[0]);
      const firstPy = py(poly[0]);

      const startX = lerp(lastPx, firstPx, 0.5);
      const startY = lerp(lastPy, firstPy, 0.5);
      ctx.moveTo(startX, startY);

      for (let i = 0; i < n; i++) {
        const currPx = px(poly[i]);
        const currPy = py(poly[i]);
        const nextPx = px(poly[(i + 1) % n]);
        const nextPy = py(poly[(i + 1) % n]);

        const endX = lerp(currPx, nextPx, 0.5);
        const endY = lerp(currPy, nextPy, 0.5);

        if (smooth >= 1) {
          ctx.quadraticCurveTo(currPx, currPy, endX, endY);
        } else {
          // Partial smooth: interpolate control point toward line midpoint
          const prevEnd = i === 0
            ? { x: startX, y: startY }
            : { x: lerp(px(poly[i - 1]), currPx, 0.5), y: lerp(py(poly[i - 1]), currPy, 0.5) };
          const lineMidX = lerp(prevEnd.x, endX, 0.5);
          const lineMidY = lerp(prevEnd.y, endY, 0.5);
          const cpx = lerp(lineMidX, currPx, smooth);
          const cpy = lerp(lineMidY, currPy, smooth);
          ctx.quadraticCurveTo(cpx, cpy, endX, endY);
        }
      }
      ctx.closePath();
    }

    ctx.stroke();
  }
}

// ── SVG contour path export ───────────────────
export function contoursToSVG(
  contours: Point[][],
  cellSize: number,
  layer: LayerState,
): string {
  let svg = '';

  for (const poly of contours) {
    if (poly.length < 3) continue;

    const n = poly.length;
    const tx = (p: Point) => (p.x - 1) * cellSize;
    const ty = (p: Point) => (p.y - 1) * cellSize;

    let d: string;

    if (layer.outlineSmooth <= 0) {
      d = `M ${tx(poly[0])},${ty(poly[0])}`;
      for (let i = 1; i < n; i++) {
        d += ` L ${tx(poly[i])},${ty(poly[i])}`;
      }
      d += ' Z';
    } else {
      const lastX = tx(poly[n - 1]);
      const lastY = ty(poly[n - 1]);
      const firstX = tx(poly[0]);
      const firstY = ty(poly[0]);

      const sx = lerp(lastX, firstX, 0.5);
      const sy = lerp(lastY, firstY, 0.5);
      d = `M ${sx},${sy}`;

      for (let i = 0; i < n; i++) {
        const cx = tx(poly[i]);
        const cy = ty(poly[i]);
        const nx = tx(poly[(i + 1) % n]);
        const ny = ty(poly[(i + 1) % n]);
        const ex = lerp(cx, nx, 0.5);
        const ey = lerp(cy, ny, 0.5);
        d += ` Q ${cx},${cy} ${ex},${ey}`;
      }
      d += ' Z';
    }

    svg += `<path d="${d}" fill="none" stroke="${layer.outlineColor}" stroke-width="${layer.outlineWidth}" stroke-linejoin="round" stroke-linecap="round"/>\n`;
  }

  return svg;
}
