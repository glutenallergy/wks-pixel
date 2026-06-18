// ── Export: SVG (vector) + PNG (raster) ──────────────────
// Walks the same buildCells() the canvas uses, so exports match the preview.
// Imported icons are emitted once in <defs> and referenced per-cell with <use>.

import { computeGrid, buildCells } from './render';
import { symbolSVG, drawSymbol } from './symbols';
import { isIcon, getIconDef } from './iconCache';
import type { V2State } from './state';

// 30px export cell echoes the brand's 30px micro-grid heritage.
const EXPORT_CELL = 30;
const r = (n: number) => Math.round(n * 100) / 100;

export function buildSVG(img: HTMLImageElement, s: V2State, cell = EXPORT_CELL): string {
  const g = computeGrid(img, s);
  const cells = buildCells(g, s);
  const w = g.cols * cell;
  const h = g.rows * cell;

  // Collect icon defs (loaded icons only)
  const usedIcons = [...new Set(cells.filter((c) => isIcon(c.kind)).map((c) => c.kind))].filter((id) => getIconDef(id));
  const defIndex = new Map(usedIcons.map((id, i) => [id, i]));
  let defs = '';
  usedIcons.forEach((id, i) => {
    const d = getIconDef(id)!;
    defs += `<symbol id="ic${i}" viewBox="0 0 ${d.w} ${d.h}">${d.body}</symbol>`;
  });

  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`;
  out += `<rect width="${w}" height="${h}" fill="${s.bgColor}"/>\n`;
  if (defs) out += `<defs>${defs}</defs>\n`;

  for (const c of cells) {
    const cx = c.col * cell + cell / 2;
    const cy = c.row * cell + cell / 2;
    if (isIcon(c.kind)) {
      const di = defIndex.get(c.kind);
      if (di === undefined) continue; // not loaded — skip
      const sp = cell * c.scale;
      out += `<use href="#ic${di}" x="${r(cx - sp / 2)}" y="${r(cy - sp / 2)}" width="${r(sp)}" height="${r(sp)}" color="${c.color}" fill="${c.color}"/>\n`;
    } else {
      out += symbolSVG(c.kind, cx, cy, cell, c.color, c.scale) + '\n';
    }
  }
  out += '</svg>';
  return out;
}

function triggerDownload(url: string, name: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
}

export function exportSVG(img: HTMLImageElement, s: V2State): void {
  const svg = buildSVG(img, s);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, 'wks-grid-v2.svg');
  URL.revokeObjectURL(url);
}

export function exportPNG(img: HTMLImageElement, s: V2State, cell = EXPORT_CELL): void {
  const g = computeGrid(img, s);
  const cells = buildCells(g, s);
  const canvas = document.createElement('canvas');
  canvas.width = g.cols * cell;
  canvas.height = g.rows * cell;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = s.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const c of cells) {
    drawSymbol(ctx, c.kind, c.col * cell + cell / 2, c.row * cell + cell / 2, cell, c.color, c.scale);
  }
  triggerDownload(canvas.toDataURL('image/png'), 'wks-grid-v2.png');
}
