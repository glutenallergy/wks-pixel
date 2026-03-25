import { SimplexNoise } from './noise';
import { getMaskData } from './masks';
import { drawSymbol, type SymbolType } from './symbols';
import { sampleGradient, getSelectedEntries } from './gradient';
import type { PaletteEntry } from './gradient';
import { computeContours, renderContours } from './contour';
import type { AppState, LayerState } from './state';
import { getImageGridDimensions } from './state';
import { getBrightness, adjustBrightness } from './image';

// ── Types ─────────────────────────────────────

export interface CompositingInfo {
  compositingW: number; // CSS pixels
  compositingH: number;
  dpr: number;
  maxRes: number;
  baseCols: number;
  baseRows: number;
}

export interface LayoutInfo {
  totalCols: number;
  totalRows: number;
  cellSize: number; // may be fractional for non-max-res layers
  dpr: number;
  gridW: number;
  gridH: number;
  padding: number;
  baseCols: number;
  baseRows: number;
}

// ── Noise ─────────────────────────────────────

let noise: SimplexNoise | null = null;
let noiseSeed = -1;

function getNoise(seed: number): SimplexNoise {
  if (!noise || noiseSeed !== seed) {
    noise = new SimplexNoise(seed);
    noiseSeed = seed;
  }
  return noise;
}

// ── Offscreen canvases ────────────────────────

const offscreenCanvases = new Map<string, HTMLCanvasElement>();

function getOffscreen(id: string, w: number, h: number): HTMLCanvasElement {
  let c = offscreenCanvases.get(id);
  if (!c || c.width !== w || c.height !== h) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    offscreenCanvases.set(id, c);
  }
  return c;
}

// ── Layout computation ────────────────────────

export function computeCompositingLayout(state: AppState, canvasW: number, canvasH: number): CompositingInfo {
  const imgDim = state.mask === 'image' ? getImageGridDimensions(state.imageGridSize, state.imageAspectRatio) : undefined;
  const maskData = getMaskData(state.mask, state.imageGridSize, imgDim?.cols, imgDim?.rows);
  const baseCols = maskData[0].length;
  const baseRows = maskData.length;

  // Find max resolution across all visible layers (default 1)
  const visibleLayers = state.layers.filter(l => l.visible);
  const maxRes = visibleLayers.length > 0
    ? Math.max(...visibleLayers.map(l => l.resolution))
    : (state.layers[0]?.resolution ?? 1);

  const padding = 3 * maxRes;
  const totalCols = baseCols * maxRes + padding * 2;
  const totalRows = baseRows * maxRes + padding * 2;

  const cellSize = Math.max(1, Math.floor(Math.min(canvasW / totalCols, canvasH / totalRows)));
  const dpr = cellSize >= 4 ? (window.devicePixelRatio || 1) : 1;
  const compositingW = totalCols * cellSize;
  const compositingH = totalRows * cellSize;

  return { compositingW, compositingH, dpr, maxRes, baseCols, baseRows };
}

export function computeLayerLayout(
  layer: LayerState,
  baseCols: number,
  baseRows: number,
  compositingW: number,
  compositingH: number,
  dpr: number,
): LayoutInfo {
  const padding = 3 * layer.resolution;
  const totalCols = baseCols * layer.resolution + padding * 2;
  const totalRows = baseRows * layer.resolution + padding * 2;
  const cellSize = compositingW / totalCols; // may be fractional
  const gridW = compositingW;
  const gridH = compositingH;

  return { totalCols, totalRows, cellSize, dpr, gridW, gridH, padding, baseCols, baseRows };
}

// ── Noise offsets ─────────────────────────────

const OFF = {
  color:        { x: 0,    y: 0 },
  symbol:       { x: 7.3,  y: 3.7 },
  scale:        { x: 13.1, y: 11.9 },
  fill:         { x: 19.7, y: 17.3 },
  staticSymbol: { x: 41.2, y: 37.5 },
  staticColor:  { x: 53.6, y: 47.1 },
  staticFill:   { x: 31.4, y: 27.8 },
  palette:      { x: 67.3, y: 59.1 },
  staticPalette:{ x: 73.8, y: 65.4 },
};

// Loop state — set per frame by render(), read by sample()
let _loopEnabled = false;
let _loopRadius = 0.15;
let _loopZ = 0; // cos(θ) * r
let _loopW = 0; // sin(θ) * r

export function setLoopParams(enabled: boolean, radius: number, phase: number) {
  _loopEnabled = enabled;
  _loopRadius = radius;
  if (enabled) {
    _loopZ = Math.cos(phase * Math.PI * 2) * radius;
    _loopW = Math.sin(phase * Math.PI * 2) * radius;
  }
}

function sample(
  n: SimplexNoise, col: number, row: number, freq: number,
  time: number, ox: number, oy: number, octaves: number, ts: number = 1,
): number {
  let raw: number;
  if (_loopEnabled) {
    // 4D noise sampling on a circle in z-w plane for seamless looping
    // 'time' is ignored — we use the precomputed _loopZ/_loopW instead
    raw = n.fbm4D(col * freq + ox, row * freq + oy, _loopZ * ts, _loopW * ts, octaves);
  } else {
    raw = n.fbm3D(col * freq + ox, row * freq + oy, time * ts, octaves);
  }
  return Math.max(0, Math.min(1, (raw + 1) / 2));
}

// ── Mask lookup (per-layer) ───────────────────

function buildMaskLookup(
  state: AppState,
  layer: LayerState,
  layout: LayoutInfo,
  brightness: Float32Array | null,
): Uint8Array {
  const { totalCols, totalRows, padding, baseCols, baseRows } = layout;
  const imgDim = state.mask === 'image' ? getImageGridDimensions(state.imageGridSize, state.imageAspectRatio) : undefined;
  const maskData = getMaskData(state.mask, state.imageGridSize, imgDim?.cols, imgDim?.rows);
  const lookup = new Uint8Array(totalCols * totalRows);
  const contentCols = baseCols * layer.resolution;

  for (let row = 0; row < totalRows; row++) {
    for (let col = 0; col < totalCols; col++) {
      const inPadding = col < padding || col >= totalCols - padding ||
                        row < padding || row >= totalRows - padding;
      let inMask = false;
      if (!inPadding) {
        if (state.mask === 'image' && brightness) {
          // Image mode: cell is in mask if its brightness falls within this layer's range
          const maskCol = col - padding;
          const maskRow = row - padding;
          if (maskCol >= 0 && maskRow >= 0 && maskCol < contentCols) {
            const idx = maskRow * contentCols + maskCol;
            if (idx >= 0 && idx < brightness.length) {
              const b = brightness[idx];
              inMask = b >= layer.brightnessMin && b <= layer.brightnessMax;
            }
          }
        } else if (state.mask === 'full') {
          inMask = true;
        } else {
          const bCol = Math.floor((col - padding) / layer.resolution);
          const bRow = Math.floor((row - padding) / layer.resolution);
          if (bRow >= 0 && bRow < baseRows && bCol >= 0 && bCol < baseCols) {
            inMask = maskData[bRow][bCol] === 1;
          }
        }
      }
      const key = `${col},${row}`;
      if (layer.toggledCells.has(key)) inMask = !inMask;
      lookup[row * totalCols + col] = inMask ? 1 : 0;
    }
  }
  return lookup;
}

// ── Render layer cells ────────────────────────

function renderLayerCells(
  ctx: CanvasRenderingContext2D,
  layer: LayerState,
  layout: LayoutInfo,
  maskLookup: Uint8Array,
  n: SimplexNoise,
  selectedEntries: PaletteEntry[],
  fillGrid?: Uint8Array,
  brightness?: Float32Array | null,
): void {
  const { totalCols, totalRows, cellSize, padding, baseCols } = layout;
  const maxDim = Math.max(totalCols, totalRows);
  const freq = layer.noiseScale / (10 * maxDim);
  const lo = layer.noiseOffset;
  const loY = lo * 0.7;
  const contentCols = baseCols * layer.resolution;
  const entryCount = selectedEntries.length;

  if (entryCount === 0) return;

  for (let row = 0; row < totalRows; row++) {
    for (let col = 0; col < totalCols; col++) {
      if (!maskLookup[row * totalCols + col]) continue;

      // Image brightness at this cell (if available)
      let imgVal = 0.5;
      if (brightness) {
        const maskCol = col - padding;
        const maskRow = row - padding;
        if (maskCol >= 0 && maskRow >= 0 && maskCol < contentCols) {
          const idx = maskRow * contentCols + maskCol;
          if (idx >= 0 && idx < brightness.length) {
            imgVal = brightness[idx];
          }
        }
      }

      // Fill
      let fillValue: number;
      if (layer.fillSource === 'image' && brightness) {
        fillValue = imgVal;
      } else if (layer.fillDriven) {
        fillValue = sample(n, col, row, freq, layer.time, OFF.fill.x + lo, OFF.fill.y + loY, layer.noiseOctaves, 1.1);
      } else {
        fillValue = sample(n, col, row, freq, 0, OFF.staticFill.x + lo, OFF.staticFill.y + loY, layer.noiseOctaves);
      }
      if (fillValue < layer.fillCutoff) continue;

      if (fillGrid) fillGrid[row * totalCols + col] = 1;

      // Palette entry selection (noise-driven when multiple entries selected)
      let entry: PaletteEntry;
      if (entryCount === 1) {
        entry = selectedEntries[0];
      } else {
        let palValue: number;
        if (layer.colorDriven) {
          palValue = sample(n, col, row, freq, layer.time, OFF.palette.x + lo, OFF.palette.y + loY, layer.noiseOctaves);
        } else {
          palValue = sample(n, col, row, freq, 0, OFF.staticPalette.x + lo, OFF.staticPalette.y + loY, layer.noiseOctaves);
        }
        entry = selectedEntries[Math.min(Math.floor(palValue * entryCount), entryCount - 1)];
      }

      // Color (sample within the selected entry's gradient)
      let colorValue: number;
      if (layer.colorSource === 'image' && brightness) {
        colorValue = imgVal;
      } else if (layer.colorDriven) {
        colorValue = sample(n, col, row, freq, layer.time, OFF.color.x + lo, OFF.color.y + loY, layer.noiseOctaves);
      } else {
        colorValue = sample(n, col, row, freq, 0, OFF.staticColor.x + lo, OFF.staticColor.y + loY, layer.noiseOctaves);
      }
      const color = sampleGradient(entry.stops, colorValue);

      // Symbol
      let sym: SymbolType;
      const syms = layer.activeSymbols;
      if (syms.length <= 1) {
        sym = syms[0] || 'square';
      } else {
        let symValue: number;
        if (layer.symbolSource === 'image' && brightness) {
          symValue = imgVal;
        } else if (layer.symbolDriven) {
          symValue = sample(n, col, row, freq, layer.time, OFF.symbol.x + lo, OFF.symbol.y + loY, layer.noiseOctaves);
        } else {
          symValue = sample(n, col, row, freq, 0, OFF.staticSymbol.x + lo, OFF.staticSymbol.y + loY, layer.noiseOctaves);
        }
        sym = syms[Math.min(Math.floor(symValue * syms.length), syms.length - 1)];
      }

      // Scale
      let scale: number;
      if (layer.scaleDriven || (layer.scaleSource === 'image' && brightness)) {
        let scaleValue: number;
        if (layer.scaleSource === 'image' && brightness) {
          scaleValue = imgVal;
        } else {
          scaleValue = sample(n, col, row, freq, layer.time, OFF.scale.x + lo, OFF.scale.y + loY, layer.noiseOctaves, 0.9);
        }
        scale = layer.scaleMin + scaleValue * (layer.scaleMax - layer.scaleMin);
      } else {
        scale = layer.scaleMax;
      }

      const x = col * cellSize;
      const y = row * cellSize;
      drawSymbol(ctx, sym, x + cellSize / 2, y + cellSize / 2, cellSize, color, layer.strokeWeight, scale);
    }
  }
}

// ── Grid lines ────────────────────────────────

function drawGridLines(
  ctx: CanvasRenderingContext2D,
  layout: LayoutInfo,
  maxRes: number,
): void {
  const { totalCols, totalRows, cellSize, padding } = layout;

  if (cellSize >= 3) {
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.08)';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= totalCols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellSize + 0.5, 0);
      ctx.lineTo(c * cellSize + 0.5, totalRows * cellSize);
      ctx.stroke();
    }
    for (let r = 0; r <= totalRows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellSize + 0.5);
      ctx.lineTo(totalCols * cellSize, r * cellSize + 0.5);
      ctx.stroke();
    }
  }

  if (cellSize >= 3 && maxRes <= 2) {
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.2)';
    ctx.lineWidth = 1;
    const macroStep = 4 * maxRes;
    for (let c = padding; c <= totalCols - padding; c += macroStep) {
      ctx.beginPath();
      ctx.moveTo(c * cellSize + 0.5, padding * cellSize);
      ctx.lineTo(c * cellSize + 0.5, (totalRows - padding) * cellSize);
      ctx.stroke();
    }
    for (let r = padding; r <= totalRows - padding; r += macroStep) {
      ctx.beginPath();
      ctx.moveTo(padding * cellSize, r * cellSize + 0.5);
      ctx.lineTo((totalCols - padding) * cellSize, r * cellSize + 0.5);
      ctx.stroke();
    }
  }
}

// ── Helper: does layer use image source? ──────

function layerUsesImage(layer: LayerState): boolean {
  return layer.fillSource === 'image' ||
         layer.colorSource === 'image' ||
         layer.symbolSource === 'image' ||
         layer.scaleSource === 'image';
}

// ── Main render ───────────────────────────────

export function render(
  mainCanvas: HTMLCanvasElement,
  state: AppState,
  comp: CompositingInfo,
): void {
  const { compositingW, compositingH, dpr, maxRes, baseCols, baseRows } = comp;
  const pixW = compositingW * dpr;
  const pixH = compositingH * dpr;

  const mainCtx = mainCanvas.getContext('2d')!;
  const n = getNoise(state.seed);

  // Set loop parameters for this frame (read by sample())
  if (state.loopEnabled) {
    // In loop mode, layer.time represents the loop phase (0–1 wraps around)
    // Each layer may have different speeds, so we compute phase per-layer in renderLayerCells
    // Here we just enable the flag; phase is set per-layer below
    _loopEnabled = true;
    _loopRadius = state.loopRadius;
  } else {
    _loopEnabled = false;
  }

  // Clear with background
  mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mainCtx.fillStyle = state.backgroundColor;
  mainCtx.fillRect(0, 0, compositingW, compositingH);

  // Clean up stale offscreen canvases
  const activeIds = new Set(state.layers.map(l => l.id));
  for (const id of offscreenCanvases.keys()) {
    if (!activeIds.has(id)) offscreenCanvases.delete(id);
  }

  // Render each layer bottom-to-top
  for (const layer of state.layers) {
    if (!layer.visible) continue;

    // Per-layer layout and mask
    const layerLayout = computeLayerLayout(layer, baseCols, baseRows, compositingW, compositingH, dpr);

    // Get image brightness (needed for image mask AND image channel sources)
    let brightness: Float32Array | null = null;
    if (state.imageElement && (state.mask === 'image' || layerUsesImage(layer))) {
      const contentW = baseCols * layer.resolution;
      const contentH = baseRows * layer.resolution;
      const raw = getBrightness(state.imageElement, contentW, contentH, state.imageScale, state.imagePanX, state.imagePanY);
      brightness = adjustBrightness(
        raw,
        state.imageExposure,
        state.imageLevelsBlack,
        state.imageLevelsWhite,
        state.imageLevelsGamma,
      );
    }

    const maskLookup = buildMaskLookup(state, layer, layerLayout, brightness);

    const offCanvas = getOffscreen(layer.id, pixW, pixH);
    const offCtx = offCanvas.getContext('2d')!;

    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    offCtx.clearRect(0, 0, pixW, pixH);
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Allocate fill grid if outline enabled
    let fillGrid: Uint8Array | undefined;
    if (layer.outlineEnabled) {
      fillGrid = new Uint8Array(layerLayout.totalCols * layerLayout.totalRows);
    }

    // Set per-layer loop phase (layer.time wraps 0→1 in loop mode)
    if (state.loopEnabled) {
      setLoopParams(true, state.loopRadius, layer.time);
    }

    const selectedEntries = getSelectedEntries(layer.colorPalette);
    renderLayerCells(offCtx, layer, layerLayout, maskLookup, n, selectedEntries, fillGrid, brightness);

    if (layer.outlineEnabled && fillGrid) {
      const contours = computeContours(fillGrid, layerLayout.totalCols, layerLayout.totalRows);
      renderContours(offCtx, contours, layerLayout.cellSize, layer);
    }

    // Composite
    mainCtx.save();
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.globalAlpha = layer.opacity;
    mainCtx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
    mainCtx.drawImage(offCanvas, 0, 0);
    mainCtx.restore();
  }

  // Grid lines on top (using maxRes layout)
  if (state.showGrid) {
    const maxLayout = computeLayerLayout(
      { resolution: maxRes } as LayerState,
      baseCols, baseRows, compositingW, compositingH, dpr,
    );
    mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGridLines(mainCtx, maxLayout, maxRes);
  }
}
