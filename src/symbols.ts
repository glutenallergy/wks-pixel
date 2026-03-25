import circleSvg from '../icons/Circle.svg?raw';
import donutSvg from '../icons/Donut.svg?raw';
import kSvg from '../icons/K.svg?raw';
import plusSvg from '../icons/Plus.svg?raw';
import punchSvg from '../icons/Punch.svg?raw';
import s1Svg from '../icons/S-1.svg?raw';
import sSvg from '../icons/S.svg?raw';
import smileSvg from '../icons/Smile.svg?raw';
import squareSvg from '../icons/Square.svg?raw';
import starSvg from '../icons/Star.svg?raw';
import targetSvg from '../icons/Target.svg?raw';
import wileySvg from '../icons/Wiley.svg?raw';

// ─── Types ───────────────────────────────────────────────

export type SymbolType =
  | 'square' | 'circle' | 'donut' | 'plus' | 'punch' | 'target'
  | 'smile' | 'star' | 'k' | 's' | 's1' | 'wiley';

export const ALL_SYMBOLS: SymbolType[] = [
  'square', 'circle', 'donut', 'plus', 'punch', 'target',
  'smile', 'star', 'k', 's', 's1', 'wiley',
];

export const SYMBOL_LABELS: Record<SymbolType, string> = {
  square: 'Square', circle: 'Circle', donut: 'Donut', plus: 'Plus',
  punch: 'Punch', target: 'Target', smile: 'Smile', star: 'Star',
  k: 'K', s: 'S', s1: 'S-Alt', wiley: 'Wiley',
};

// ─── Drawing operations ──────────────────────────────────

interface DrawOp {
  path: Path2D;
  fillRule?: CanvasFillRule;
  stroke?: { width: number; lineCap?: CanvasLineCap };
}

// ─── SVG parser ──────────────────────────────────────────

/** Add a rect rotated by `angleDeg` around `(rcx, rcy)` as a polygon to `path`. */
function addRotatedRect(
  path: Path2D,
  x: number, y: number, w: number, h: number,
  angleDeg: number, rcx: number, rcy: number,
) {
  const a = (angleDeg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const corners: [number, number][] = [
    [x, y], [x + w, y], [x + w, y + h], [x, y + h],
  ];
  const rot = corners.map(([px, py]): [number, number] => {
    const dx = px - rcx;
    const dy = py - rcy;
    return [rcx + dx * ca - dy * sa, rcy + dx * sa + dy * ca];
  });
  path.moveTo(rot[0][0], rot[0][1]);
  path.lineTo(rot[1][0], rot[1][1]);
  path.lineTo(rot[2][0], rot[2][1]);
  path.lineTo(rot[3][0], rot[3][1]);
  path.closePath();
}

/** Parse `<rect>` elements with `fill="black"` from raw SVG markup into a Path2D. */
function parseSvgRects(svg: string): Path2D {
  const p = new Path2D();
  const re = /<rect\s([^>]*?)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const a = m[1];
    // Skip white-fill background rects
    if (/fill\s*=\s*"white"/.test(a)) continue;
    const xv = a.match(/\bx="([^"]*)"/);
    const yv = a.match(/\by="([^"]*)"/);
    const wv = a.match(/\bwidth="([^"]*)"/);
    const hv = a.match(/\bheight="([^"]*)"/);
    const tv = a.match(/\btransform="([^"]*)"/);
    const rx = parseFloat(xv?.[1] ?? '0');
    const ry = parseFloat(yv?.[1] ?? '0');
    const rw = parseFloat(wv?.[1] ?? '0');
    const rh = parseFloat(hv?.[1] ?? '0');
    if (rw === 0 || rh === 0) continue;

    if (tv) {
      const rot = tv[1].match(/rotate\(\s*([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)\s*\)/);
      if (rot) {
        addRotatedRect(p, rx, ry, rw, rh, parseFloat(rot[1]), parseFloat(rot[2]), parseFloat(rot[3]));
        continue;
      }
    }
    p.rect(rx, ry, rw, rh);
  }
  return p;
}

/** Extract the black-filled shape elements from SVG as an SVG markup string. */
function extractSvgShapes(svg: string): string {
  const shapes: string[] = [];
  // Rects with fill="black" (with or without transform)
  const re = /<rect\s([^>]*?)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    if (/fill\s*=\s*"white"/.test(m[1])) continue;
    if (!/fill\s*=\s*"black"/.test(m[1]) && !/stroke\s*=\s*"black"/.test(m[1])) continue;
    shapes.push(m[0]);
  }
  // Circles with fill="black" or stroke="black"
  const circleRe = /<circle\s([^>]*?)\/>/g;
  while ((m = circleRe.exec(svg)) !== null) {
    if (/fill\s*=\s*"white"/.test(m[1])) continue;
    shapes.push(m[0]);
  }
  // Paths with fill="black" or stroke="black"
  const pathRe = /<path\s([^>]*?)\/>/g;
  while ((m = pathRe.exec(svg)) !== null) {
    if (/fill\s*=\s*"white"/.test(m[1])) continue;
    shapes.push(m[0]);
  }
  return shapes.join('\n');
}

// ─── Build draw specs ────────────────────────────────────

function buildSpecs(): Record<SymbolType, DrawOp[]> {
  // ── Square ──
  const squarePath = new Path2D();
  squarePath.rect(0, 0, 200, 200);

  // ── Circle ──
  const circlePath = new Path2D();
  circlePath.arc(100, 100, 100, 0, Math.PI * 2);

  // ── Donut (annular ring via evenodd) ──
  // Original: circle r=60 stroke-width=40 → outer r=80, inner r=40
  const donutPath = new Path2D();
  donutPath.arc(100, 100, 80, 0, Math.PI * 2);
  donutPath.arc(100, 100, 40, 0, Math.PI * 2);

  // ── Plus ──
  // Horizontal bar y=73.33→126.67, Vertical bar x=73.33→126.67
  const plusPath = new Path2D();
  plusPath.rect(0, 73.333, 200, 53.334);
  plusPath.rect(73.333, 0, 53.334, 200);

  // ── Punch (square with circle cutout) ──
  const punchPath = new Path2D(
    'M200 200H0V0H200V200Z' +
    'M100 20C55.8172 20 20 55.8172 20 100C20 144.183 55.8172 180 100 180C144.183 180 180 144.183 180 100C180 55.8172 144.183 20 100 20Z'
  );

  // ── Target (punch + inner circle) ──
  const targetOuter = new Path2D(
    'M200 200H0V0H200V200Z' +
    'M100 20C55.8172 20 20 55.8172 20 100C20 144.183 55.8172 180 100 180C144.183 180 180 144.183 180 100C180 55.8172 144.183 20 100 20Z'
  );
  const targetInner = new Path2D();
  targetInner.arc(100, 100, 40, 0, Math.PI * 2);

  // ── Smile (eyes + mouth) ──
  const smileEyes = new Path2D();
  smileEyes.arc(46.667, 46.667, 26.667, 0, Math.PI * 2);
  smileEyes.arc(153.333, 46.667, 26.667, 0, Math.PI * 2);
  const smileMouth = new Path2D(
    'M20 126.667C57.2582 131.324 62.4519 180 100 180C137.548 180 142.742 131.324 180 126.667'
  );

  // ── Parsed from SVG files ──
  const kPath = parseSvgRects(kSvg);
  const sPath = parseSvgRects(sSvg);
  const s1Path = parseSvgRects(s1Svg);
  const starPath = parseSvgRects(starSvg);
  const wileyPath = parseSvgRects(wileySvg);

  return {
    square: [{ path: squarePath }],
    circle: [{ path: circlePath }],
    donut: [{ path: donutPath, fillRule: 'evenodd' }],
    plus: [{ path: plusPath }],
    punch: [{ path: punchPath, fillRule: 'evenodd' }],
    target: [
      { path: targetOuter, fillRule: 'evenodd' },
      { path: targetInner },
    ],
    smile: [
      { path: smileEyes },
      { path: smileMouth, stroke: { width: 36, lineCap: 'round' } },
    ],
    star: [{ path: starPath }],
    k: [{ path: kPath }],
    s: [{ path: sPath }],
    s1: [{ path: s1Path }],
    wiley: [{ path: wileyPath }],
  };
}

// Lazy init — Path2D may not be available at import time in SSR
let _specs: Record<SymbolType, DrawOp[]> | null = null;
function specs(): Record<SymbolType, DrawOp[]> {
  if (!_specs) _specs = buildSpecs();
  return _specs;
}

// ─── SVG export content ──────────────────────────────────

// Pre-extract SVG shape markup for each icon (for SVG export)
const SVG_SHAPES: Record<SymbolType, string> = {
  square: extractSvgShapes(squareSvg),
  circle: extractSvgShapes(circleSvg),
  donut: extractSvgShapes(donutSvg),
  plus: extractSvgShapes(plusSvg),
  punch: extractSvgShapes(punchSvg),
  target: extractSvgShapes(targetSvg),
  smile: extractSvgShapes(smileSvg),
  star: extractSvgShapes(starSvg),
  k: extractSvgShapes(kSvg),
  s: extractSvgShapes(sSvg),
  s1: extractSvgShapes(s1Svg),
  wiley: extractSvgShapes(wileySvg),
};

// ─── Public API ──────────────────────────────────────────

/**
 * Draw a symbol onto the canvas. All icons are defined in 200×200 space
 * and scaled to fit `cellSize * scale`.
 */
export function drawSymbol(
  ctx: CanvasRenderingContext2D,
  type: SymbolType,
  cx: number, cy: number,
  cellSize: number,
  color: string,
  _strokeWeight: number,
  scale: number,
): void {
  const s = cellSize * scale;
  const sc = s / 200;
  const ops = specs()[type];
  if (!ops) return;

  ctx.save();
  ctx.translate(cx - s / 2, cy - s / 2);
  ctx.scale(sc, sc);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  for (const op of ops) {
    if (op.stroke) {
      ctx.lineWidth = op.stroke.width;
      if (op.stroke.lineCap) ctx.lineCap = op.stroke.lineCap;
      ctx.stroke(op.path);
    } else {
      ctx.fill(op.path, op.fillRule ?? 'nonzero');
    }
  }

  ctx.restore();
}

/** Draw a symbol preview into a small canvas (for the UI toggles). */
export function drawSymbolPreview(
  canvas: HTMLCanvasElement,
  type: SymbolType,
  active: boolean,
): void {
  const size = canvas.width;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  const color = active ? '#ffffff' : '#555555';
  drawSymbol(ctx, type, size / 2, size / 2, size * 0.7, color, 1.5, 1);
}

/** Generate SVG markup for a symbol (for SVG export). */
export function symbolToSVG(
  type: SymbolType,
  cx: number, cy: number,
  cellSize: number,
  color: string,
  _strokeWeight: number,
  scale: number,
): string {
  const s = cellSize * scale;
  const half = s / 2;
  const sc = s / 200;
  const shapes = SVG_SHAPES[type]
    .replace(/fill="black"/g, `fill="${color}"`)
    .replace(/stroke="black"/g, `stroke="${color}"`);
  return `<g transform="translate(${cx - half},${cy - half}) scale(${sc})">${shapes}</g>`;
}
