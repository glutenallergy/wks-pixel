// ── Symbol library ───────────────────────────────────────
// Each shape is defined ONCE as a list of primitives in a 0..1 cell space.
// Canvas drawing and SVG export both render those primitives, so they always
// match. `density` ≈ ink coverage, used to order the ramp (dark → dense).
// Imported Iconify icons (ids like "icon:tabler:star") are drawn via raster.

import { isIcon, getRaster } from './iconCache';

export type SymbolKind = 'solid' | 'circle' | 'ring' | 'square' | 'checker' | 'cross';

type Prim =
  | { t: 'rect'; x: number; y: number; w: number; h: number }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'ring'; cx: number; cy: number; r: number; sw: number }
  | { t: 'rectStroke'; x: number; y: number; w: number; h: number; sw: number }
  | { t: 'poly'; pts: [number, number][] }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; sw: number }
  | { t: 'semi'; cx: number; cy: number; r: number };

interface SymbolDef {
  kind: SymbolKind;
  label: string;
  density: number; // 0..1, for ramp ordering
  prims: Prim[];
}

export const SYMBOLS: SymbolDef[] = [
  { kind: 'solid', label: 'Solid', density: 1.0, prims: [{ t: 'rect', x: 0, y: 0, w: 1, h: 1 }] },
  { kind: 'circle', label: 'Circle', density: 0.8, prims: [{ t: 'circle', cx: 0.5, cy: 0.5, r: 0.5 }] },
  { kind: 'ring', label: 'Stroke Circle', density: 0.42, prims: [{ t: 'ring', cx: 0.5, cy: 0.5, r: 0.4, sw: 0.18 }] },
  { kind: 'square', label: 'Stroke Square', density: 0.3, prims: [{ t: 'rectStroke', x: 0.1, y: 0.1, w: 0.8, h: 0.8, sw: 0.14 }] },
  { kind: 'checker', label: 'Checker', density: 0.55, prims: [
    { t: 'rect', x: 0, y: 0, w: 0.34, h: 0.34 }, { t: 'rect', x: 0.66, y: 0, w: 0.34, h: 0.34 },
    { t: 'rect', x: 0.33, y: 0.33, w: 0.34, h: 0.34 },
    { t: 'rect', x: 0, y: 0.66, w: 0.34, h: 0.34 }, { t: 'rect', x: 0.66, y: 0.66, w: 0.34, h: 0.34 },
  ] },
  { kind: 'cross', label: 'X', density: 0.3, prims: [{ t: 'line', x1: 0.12, y1: 0.12, x2: 0.88, y2: 0.88, sw: 0.16 }, { t: 'line', x1: 0.88, y1: 0.12, x2: 0.12, y2: 0.88, sw: 0.16 }] },
];

/** Pick `n` random distinct symbols, returned densest → sparsest (a sensible default ramp). */
export function pickRandomSymbols(n: number): SymbolKind[] {
  const pool = [...SYMBOLS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length)).sort((a, b) => b.density - a.density).map((s) => s.kind);
}

const BY_KIND = new Map<SymbolKind, SymbolDef>(SYMBOLS.map((s) => [s.kind, s]));

export const ALL_SYMBOLS: SymbolKind[] = SYMBOLS.map((s) => s.kind);

// Imported icons (ids like "icon:tabler:star") have no native density; place
// them mid-ramp so they sit among the geometric shapes.
function densityOf(id: string): number {
  return BY_KIND.get(id as SymbolKind)?.density ?? 0.5;
}

/** Order a set of symbols/icons by density, densest first (for the dark→light ramp). */
export function orderByDensity(kinds: string[]): string[] {
  return [...kinds].sort((a, b) => densityOf(b) - densityOf(a));
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Draw a symbol/icon centered at (cx,cy), sized to `size`, scaled by `scale` (halftone). */
export function drawSymbol(
  ctx: CanvasRenderingContext2D,
  kind: string,
  cx: number,
  cy: number,
  size: number,
  color: string,
  scale = 1,
): void {
  const s = size * scale;
  if (s <= 0.5) return;

  if (isIcon(kind)) {
    const raster = getRaster(kind, color);
    if (raster) ctx.drawImage(raster, cx - s / 2, cy - s / 2, s, s);
    return;
  }

  const def = BY_KIND.get(kind as SymbolKind);
  if (!def) return;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-0.5, -0.5);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const p of def.prims) {
    switch (p.t) {
      case 'rect':
        ctx.fillRect(p.x, p.y, p.w, p.h);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'ring':
        ctx.lineWidth = p.sw;
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'rectStroke':
        ctx.lineWidth = p.sw;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        break;
      case 'poly':
        ctx.beginPath();
        p.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
        ctx.fill();
        break;
      case 'line':
        ctx.lineWidth = p.sw;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
        break;
      case 'semi':
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, p.r, Math.PI, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        break;
    }
  }
  ctx.restore();
}

/** SVG markup for one native symbol (matches drawSymbol geometry).
 *  Icons are exported separately via <defs>/<use> in exportArt, so this
 *  returns '' for icon ids. */
export function symbolSVG(
  kind: string,
  cx: number,
  cy: number,
  size: number,
  color: string,
  scale = 1,
): string {
  const s = size * scale;
  if (s <= 0.5) return '';
  const def = BY_KIND.get(kind as SymbolKind);
  if (!def) return '';
  const ox = cx - s / 2;
  const oy = cy - s / 2;
  const X = (x: number) => r2(ox + x * s);
  const Y = (y: number) => r2(oy + y * s);
  const L = (v: number) => r2(v * s);

  const out: string[] = [];
  for (const p of def.prims) {
    switch (p.t) {
      case 'rect':
        out.push(`<rect x="${X(p.x)}" y="${Y(p.y)}" width="${L(p.w)}" height="${L(p.h)}" fill="${color}"/>`);
        break;
      case 'circle':
        out.push(`<circle cx="${X(p.cx)}" cy="${Y(p.cy)}" r="${L(p.r)}" fill="${color}"/>`);
        break;
      case 'ring':
        out.push(`<circle cx="${X(p.cx)}" cy="${Y(p.cy)}" r="${L(p.r)}" fill="none" stroke="${color}" stroke-width="${L(p.sw)}"/>`);
        break;
      case 'rectStroke':
        out.push(`<rect x="${X(p.x)}" y="${Y(p.y)}" width="${L(p.w)}" height="${L(p.h)}" fill="none" stroke="${color}" stroke-width="${L(p.sw)}"/>`);
        break;
      case 'poly':
        out.push(`<polygon points="${p.pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}" fill="${color}"/>`);
        break;
      case 'line':
        out.push(`<line x1="${X(p.x1)}" y1="${Y(p.y1)}" x2="${X(p.x2)}" y2="${Y(p.y2)}" stroke="${color}" stroke-width="${L(p.sw)}" stroke-linecap="round"/>`);
        break;
      case 'semi':
        out.push(`<path d="M ${X(p.cx - p.r)} ${Y(p.cy)} A ${L(p.r)} ${L(p.r)} 0 0 1 ${X(p.cx + p.r)} ${Y(p.cy)} Z" fill="${color}"/>`);
        break;
    }
  }
  return out.join('');
}
